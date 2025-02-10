import { Driver, Session, Transaction } from 'neo4j-driver'; // v5.12.0
import { z } from 'zod'; // v3.22.0
import * as crypto from 'crypto'; // native
import { Logger } from 'winston'; // v3.10.0
import { Redis } from 'ioredis'; // v5.3.2

import { 
  Member, 
  CreateMemberInput, 
  UpdateMemberInput, 
  ResolveMemberEntityInput,
  EntityConfidenceLevel 
} from '../../../shared/types/member.types';
import { memberSchema } from '../../../shared/schemas/member.schema';
import { neo4jConfig } from '../config/neo4j';

// Constants for encryption and caching
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_SIZE = 32;
const CACHE_TTL = 3600; // 1 hour
const CONFIDENCE_THRESHOLD = 0.95;

export class MemberModel {
  private readonly driver: Driver;
  private readonly logger: Logger;
  private readonly cache: Redis;
  private readonly encryptionKey: Buffer;

  constructor(driver: Driver, logger: Logger, cache: Redis) {
    this.driver = driver;
    this.logger = logger;
    this.cache = cache;
    this.encryptionKey = crypto.scryptSync(
      process.env.ENCRYPTION_SECRET!,
      'salt',
      ENCRYPTION_KEY_SIZE
    );
  }

  /**
   * Encrypts sensitive member data fields
   */
  private encryptField(value: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypts sensitive member data fields
   */
  private decryptField(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Creates a new member with optimized performance and security
   */
  async create(data: CreateMemberInput): Promise<Member> {
    const session = this.driver.session({ database: neo4jConfig.database });
    
    try {
      // Validate input data
      const validatedData = memberSchema.parse(data);

      // Encrypt sensitive fields
      const encryptedEmail = this.encryptField(validatedData.profile.email);

      const result = await session.executeWrite(async (tx: Transaction) => {
        // Create member node with encrypted data
        const query = `
          CREATE (m:Member {
            id: $id,
            profile: $profile,
            createdAt: datetime(),
            updatedAt: datetime(),
            lastActivity: datetime(),
            entityStatus: $entityStatus
          })
          WITH m
          UNWIND $socialProfiles as socialProfile
          CREATE (s:SocialProfile {
            platform: socialProfile.platform,
            externalId: socialProfile.externalId,
            authData: socialProfile.authData,
            verified: socialProfile.verified,
            lastSynced: datetime()
          })
          CREATE (m)-[:HAS_PROFILE]->(s)
          RETURN m, collect(s) as socialProfiles
        `;

        const params = {
          id: crypto.randomUUID(),
          profile: {
            ...validatedData.profile,
            email: {
              value: encryptedEmail.encrypted,
              iv: encryptedEmail.iv,
              tag: encryptedEmail.tag
            }
          },
          socialProfiles: validatedData.socialProfiles,
          entityStatus: {
            isResolved: false,
            confidence: 1.0,
            lastResolutionDate: null
          }
        };

        const result = await tx.run(query, params);
        return result.records[0];
      });

      const member = this.transformRecordToMember(result);
      
      // Cache the created member
      await this.cache.setex(
        `member:${member.id}`,
        CACHE_TTL,
        JSON.stringify(member)
      );

      this.logger.info('Member created successfully', { memberId: member.id });
      return member;

    } catch (error) {
      this.logger.error('Error creating member', { error });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Retrieves a member by ID with caching
   */
  async findById(id: string): Promise<Member | null> {
    // Check cache first
    const cached = await this.cache.get(`member:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const session = this.driver.session({ database: neo4jConfig.database });

    try {
      const result = await session.executeRead(async (tx: Transaction) => {
        const query = `
          MATCH (m:Member {id: $id})
          OPTIONAL MATCH (m)-[:HAS_PROFILE]->(s:SocialProfile)
          RETURN m, collect(s) as socialProfiles
        `;

        const result = await tx.run(query, { id });
        return result.records[0];
      });

      if (!result) {
        return null;
      }

      const member = this.transformRecordToMember(result);

      // Cache the result
      await this.cache.setex(
        `member:${id}`,
        CACHE_TTL,
        JSON.stringify(member)
      );

      return member;

    } catch (error) {
      this.logger.error('Error finding member', { error, memberId: id });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Resolves potential duplicate member entities
   */
  async resolveEntity(data: ResolveMemberEntityInput): Promise<Member> {
    const session = this.driver.session({ database: neo4jConfig.database });

    try {
      // Validate confidence threshold
      if (data.confidence < CONFIDENCE_THRESHOLD) {
        throw new Error('Confidence threshold not met for entity resolution');
      }

      const result = await session.executeWrite(async (tx: Transaction) => {
        // Merge members and their relationships
        const query = `
          MATCH (source:Member {id: $sourceId})
          MATCH (target:Member {id: $targetId})
          WITH source, target
          OPTIONAL MATCH (source)-[r:HAS_PROFILE]->(sp:SocialProfile)
          WITH source, target, collect(sp) as sourceProfiles
          OPTIONAL MATCH (target)-[r2:HAS_PROFILE]->(tp:SocialProfile)
          WITH source, target, sourceProfiles, collect(tp) as targetProfiles
          CALL apoc.merge.node(['Member'], {id: $targetId}, {
            profile: target.profile,
            entityStatus: {
              isResolved: true,
              confidence: $confidence,
              lastResolutionDate: datetime()
            },
            updatedAt: datetime()
          }) YIELD node as mergedMember
          WITH mergedMember, sourceProfiles, targetProfiles
          UNWIND sourceProfiles + targetProfiles as profile
          MERGE (mergedMember)-[:HAS_PROFILE]->(profile)
          WITH mergedMember, profile
          RETURN mergedMember, collect(profile) as socialProfiles
        `;

        const result = await tx.run(query, {
          sourceId: data.sourceId,
          targetId: data.targetId,
          confidence: data.confidence
        });

        // Delete the source member after successful merge
        await tx.run(
          'MATCH (m:Member {id: $id}) DETACH DELETE m',
          { id: data.sourceId }
        );

        return result.records[0];
      });

      const resolvedMember = this.transformRecordToMember(result);

      // Invalidate caches
      await Promise.all([
        this.cache.del(`member:${data.sourceId}`),
        this.cache.del(`member:${data.targetId}`)
      ]);

      this.logger.info('Entity resolution completed', {
        sourceId: data.sourceId,
        targetId: data.targetId,
        confidence: data.confidence
      });

      return resolvedMember;

    } catch (error) {
      this.logger.error('Error resolving member entities', { error, data });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Transforms Neo4j record to Member type
   */
  private transformRecordToMember(record: any): Member {
    const memberNode = record.get('m').properties;
    const socialProfiles = record.get('socialProfiles').map((sp: any) => sp.properties);

    // Decrypt sensitive fields
    const emailData = memberNode.profile.email;
    const decryptedEmail = this.decryptField(
      emailData.value,
      emailData.iv,
      emailData.tag
    );

    return {
      id: memberNode.id,
      profile: {
        ...memberNode.profile,
        email: decryptedEmail
      },
      socialProfiles,
      createdAt: new Date(memberNode.createdAt),
      updatedAt: new Date(memberNode.updatedAt),
      lastActivity: new Date(memberNode.lastActivity),
      entityStatus: memberNode.entityStatus
    };
  }
}