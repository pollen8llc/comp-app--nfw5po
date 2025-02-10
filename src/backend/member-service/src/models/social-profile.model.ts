import { neo4j, Driver, Session } from 'neo4j-driver'; // v5.12.0
import { z } from 'zod'; // v3.22.0
import retry from 'retry'; // v0.13.0
import winston from 'winston'; // v3.10.0
import CryptoJS from 'crypto-js'; // v4.1.1

import { SocialProfile, socialProfileSchema } from '../../../shared/types/member.types';
import { validateSchema } from '../../../shared/utils/validation';
import { ERROR_CODES, BaseError } from '../../../shared/utils/error-codes';

/**
 * Error class for social profile-specific errors
 */
class SocialProfileError extends BaseError {
  constructor(code: ERROR_CODES, message: string, details?: Record<string, unknown>) {
    super(code, message, details, {
      component: 'SocialProfileModel',
      service: 'member-service',
      additionalMetadata: { modelType: 'social-profile' }
    });
  }
}

/**
 * Interface for user context in operations
 */
interface UserContext {
  userId: string;
  roles: string[];
  dataAccessLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

/**
 * Neo4j-based model for managing social profiles with enhanced security
 */
export class SocialProfileModel {
  private readonly driver: Driver;
  private readonly logger: winston.Logger;
  private readonly encryptionKey: string;
  private readonly operationTimeout: number = 5000;

  constructor(driver: Driver) {
    this.driver = driver;
    this.encryptionKey = process.env.SOCIAL_PROFILE_ENCRYPTION_KEY || '';
    
    if (!this.encryptionKey) {
      throw new Error('Social profile encryption key not configured');
    }

    // Configure logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'social-profile-model' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'social-profile-error.log', level: 'error' })
      ]
    });
  }

  /**
   * Encrypts sensitive social profile data
   */
  private encryptSensitiveData(data: Record<string, string>): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
  }

  /**
   * Decrypts sensitive social profile data
   */
  private decryptSensitiveData(encryptedData: string): Record<string, string> {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  /**
   * Creates a new social profile with security measures
   */
  async create(
    memberId: string,
    data: SocialProfile,
    context: UserContext
  ): Promise<SocialProfile> {
    const session = this.driver.session();
    
    try {
      // Validate input data
      await validateSchema(socialProfileSchema, data);

      // Encrypt sensitive auth data
      const encryptedAuthData = this.encryptSensitiveData(data.authData);

      // Retry policy for transient failures
      const operation = retry.operation({
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000
      });

      return new Promise((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
          try {
            const result = await session.executeWrite(async (tx) => {
              // Check for existing profile
              const existing = await tx.run(
                `MATCH (m:Member {id: $memberId})-[:HAS_PROFILE]->(sp:SocialProfile {platform: $platform})
                 RETURN sp`,
                { memberId, platform: data.platform }
              );

              if (existing.records.length > 0) {
                throw new SocialProfileError(
                  ERROR_CODES.VALIDATION_ERROR,
                  `Social profile for platform ${data.platform} already exists`
                );
              }

              // Create social profile with proper indexing
              const createResult = await tx.run(
                `MATCH (m:Member {id: $memberId})
                 CREATE (sp:SocialProfile {
                   id: randomUUID(),
                   platform: $platform,
                   externalId: $externalId,
                   authData: $authData,
                   verified: $verified,
                   lastSynced: datetime(),
                   dataClassification: 'CONFIDENTIAL',
                   createdAt: datetime(),
                   updatedAt: datetime()
                 })
                 CREATE (m)-[:HAS_PROFILE]->(sp)
                 RETURN sp`,
                {
                  memberId,
                  platform: data.platform,
                  externalId: data.externalId,
                  authData: encryptedAuthData,
                  verified: data.verified
                }
              );

              const profile = createResult.records[0].get('sp').properties;
              return {
                ...profile,
                authData: this.decryptSensitiveData(profile.authData)
              };
            });

            this.logger.info('Social profile created', {
              memberId,
              platform: data.platform,
              externalId: data.externalId
            });

            resolve(result);
          } catch (error) {
            if (operation.retry(error as Error)) {
              return;
            }
            reject(error);
          }
        });
      });
    } catch (error) {
      this.logger.error('Error creating social profile', {
        error,
        memberId,
        platform: data.platform
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Retrieves social profiles with role-based access control
   */
  async findByMemberId(
    memberId: string,
    context: UserContext
  ): Promise<SocialProfile[]> {
    const session = this.driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        const query = `
          MATCH (m:Member {id: $memberId})-[:HAS_PROFILE]->(sp:SocialProfile)
          WHERE sp.dataClassification IN $allowedClassifications
          RETURN sp
          ORDER BY sp.createdAt DESC
        `;

        const allowedClassifications = this.getAllowedClassifications(context.dataAccessLevel);
        
        const queryResult = await tx.run(query, {
          memberId,
          allowedClassifications
        });

        return queryResult.records.map(record => {
          const profile = record.get('sp').properties;
          return {
            ...profile,
            authData: this.decryptSensitiveData(profile.authData)
          };
        });
      });

      this.logger.info('Social profiles retrieved', {
        memberId,
        count: result.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error retrieving social profiles', {
        error,
        memberId
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Helper method to determine allowed data classifications based on access level
   */
  private getAllowedClassifications(accessLevel: string): string[] {
    const classifications = {
      'PUBLIC': ['PUBLIC'],
      'INTERNAL': ['PUBLIC', 'INTERNAL'],
      'CONFIDENTIAL': ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
      'RESTRICTED': ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']
    };
    return classifications[accessLevel as keyof typeof classifications] || ['PUBLIC'];
  }

  /**
   * Updates an existing social profile with security checks
   */
  async update(
    memberId: string,
    platform: string,
    data: Partial<SocialProfile>,
    context: UserContext
  ): Promise<SocialProfile> {
    const session = this.driver.session();

    try {
      // Validate update data
      const updateSchema = socialProfileSchema.partial();
      await validateSchema(updateSchema, data);

      let encryptedAuthData: string | undefined;
      if (data.authData) {
        encryptedAuthData = this.encryptSensitiveData(data.authData);
      }

      const result = await session.executeWrite(async (tx) => {
        const updateQuery = `
          MATCH (m:Member {id: $memberId})-[:HAS_PROFILE]->(sp:SocialProfile {platform: $platform})
          SET sp += $updates,
              sp.updatedAt = datetime()
          RETURN sp
        `;

        const updates = {
          ...data,
          authData: encryptedAuthData
        };

        const updateResult = await tx.run(updateQuery, {
          memberId,
          platform,
          updates
        });

        if (updateResult.records.length === 0) {
          throw new SocialProfileError(
            ERROR_CODES.NOT_FOUND_ERROR,
            `Social profile not found for platform ${platform}`
          );
        }

        const profile = updateResult.records[0].get('sp').properties;
        return {
          ...profile,
          authData: this.decryptSensitiveData(profile.authData)
        };
      });

      this.logger.info('Social profile updated', {
        memberId,
        platform
      });

      return result;
    } catch (error) {
      this.logger.error('Error updating social profile', {
        error,
        memberId,
        platform
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Deletes a social profile with security checks
   */
  async delete(
    memberId: string,
    platform: string,
    context: UserContext
  ): Promise<void> {
    const session = this.driver.session();

    try {
      await session.executeWrite(async (tx) => {
        const deleteQuery = `
          MATCH (m:Member {id: $memberId})-[r:HAS_PROFILE]->(sp:SocialProfile {platform: $platform})
          DELETE r, sp
        `;

        const result = await tx.run(deleteQuery, {
          memberId,
          platform
        });

        if (result.summary.counters.nodesDeleted === 0) {
          throw new SocialProfileError(
            ERROR_CODES.NOT_FOUND_ERROR,
            `Social profile not found for platform ${platform}`
          );
        }
      });

      this.logger.info('Social profile deleted', {
        memberId,
        platform
      });
    } catch (error) {
      this.logger.error('Error deleting social profile', {
        error,
        memberId,
        platform
      });
      throw error;
    } finally {
      await session.close();
    }
  }
}