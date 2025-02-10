import { faker } from '@faker-js/faker'; // v8.0.0
import neo4j, { Driver, Session } from 'neo4j-driver'; // v5.12.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Member, Profile, SocialProfile, EntityStatus, DataClassification as MemberDataClassification } from '../../shared/types/member.types';
import { Event, EventPlatform, DataClassification as EventDataClassification, EventValidationStatus, EventMetadata } from '../../shared/types/event.types';

// Configuration constants
const SEED_CONFIG = {
  members: 100,
  events: 50,
  relationshipsPerMember: 10,
  eventsPerMember: 5,
  overlapPercentage: 15
};

const RELATIONSHIP_TYPES = {
  KNOWS: 'KNOWS',
  ATTENDED: 'ATTENDED',
  HAS_PROFILE: 'HAS_PROFILE'
};

interface SeedOptions {
  clearExisting?: boolean;
  seedCount?: Partial<typeof SEED_CONFIG>;
}

/**
 * Generates test member data with overlapping profiles for disambiguation testing
 */
async function generateMembers(count: number): Promise<Member[]> {
  faker.seed(42); // Ensure reproducible data generation
  
  const members: Member[] = [];
  const overlapCount = Math.floor(count * (SEED_CONFIG.overlapPercentage / 100));
  
  for (let i = 0; i < count; i++) {
    const profile: Profile = {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      location: faker.location.city(),
      bio: faker.person.bio(),
      dataClassification: faker.helpers.arrayElement(Object.values(MemberDataClassification))
    };

    const socialProfiles: SocialProfile[] = [
      {
        platform: 'LINKEDIN',
        externalId: faker.string.uuid(),
        authData: { token: faker.string.alphanumeric(32) },
        verified: faker.datatype.boolean(),
        lastSynced: faker.date.past()
      },
      {
        platform: 'GMAIL',
        externalId: faker.string.uuid(),
        authData: { token: faker.string.alphanumeric(32) },
        verified: faker.datatype.boolean(),
        lastSynced: faker.date.past()
      }
    ];

    const entityStatus: EntityStatus = {
      isResolved: true,
      confidence: faker.number.float({ min: 0.7, max: 1 }) as number & { _brand: 'EntityConfidence' },
      lastResolutionDate: faker.date.recent()
    };

    const member: Member = {
      id: uuidv4(),
      profile,
      socialProfiles,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      lastActivity: faker.date.recent(),
      entityStatus
    };

    members.push(member);
  }

  // Generate overlapping profiles for disambiguation testing
  for (let i = 0; i < overlapCount; i++) {
    const sourceMember = members[i];
    const overlappingProfile: Profile = {
      ...sourceMember.profile,
      email: `${sourceMember.profile.name.toLowerCase().replace(' ', '.')}@${faker.internet.domainName()}`,
      dataClassification: MemberDataClassification.CONFIDENTIAL
    };

    members.push({
      ...sourceMember,
      id: uuidv4(),
      profile: overlappingProfile,
      entityStatus: {
        isResolved: false,
        confidence: faker.number.float({ min: 0.3, max: 0.7 }) as number & { _brand: 'EntityConfidence' },
        lastResolutionDate: null
      }
    });
  }

  return members;
}

/**
 * Generates test event data with platform-specific metadata
 */
async function generateEvents(count: number): Promise<Event[]> {
  const events: Event[] = [];

  for (let i = 0; i < count; i++) {
    const startDate = faker.date.future();
    const metadata: EventMetadata = {
      tags: {
        category: { value: faker.helpers.arrayElement(['Tech', 'Social', 'Professional']), validated: true },
        format: { value: faker.helpers.arrayElement(['In-Person', 'Virtual', 'Hybrid']), validated: true }
      },
      categories: faker.helpers.arrayElements(['Networking', 'Workshop', 'Conference', 'Meetup'], 2),
      capacity: faker.number.int({ min: 10, max: 200 }),
      is_private: faker.datatype.boolean(),
      dataClassification: faker.helpers.arrayElement(Object.values(EventDataClassification)),
      lastModifiedBy: uuidv4(),
      lastModifiedAt: faker.date.recent()
    };

    const event: Event = {
      id: uuidv4(),
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      start_date: startDate,
      end_date: faker.date.soon({ refDate: startDate }),
      location: faker.location.city(),
      platform: faker.helpers.arrayElement(Object.values(EventPlatform)),
      external_id: faker.string.uuid(),
      metadata,
      participants: [],
      validationStatus: EventValidationStatus.VALIDATED,
      created_at: faker.date.past(),
      updated_at: faker.date.recent(),
      created_by: uuidv4(),
      updated_by: uuidv4()
    };

    events.push(event);
  }

  return events;
}

/**
 * Creates relationships between nodes with temporal properties and metadata
 */
async function createRelationships(
  session: Session,
  members: Member[],
  events: Event[]
): Promise<void> {
  // Create KNOWS relationships between members
  for (const member of members) {
    const relationshipCount = faker.number.int({
      min: 1,
      max: SEED_CONFIG.relationshipsPerMember
    });

    const otherMembers = members.filter(m => m.id !== member.id);
    const connections = faker.helpers.arrayElements(otherMembers, relationshipCount);

    for (const connection of connections) {
      const strength = faker.number.float({ min: 0.1, max: 1 });
      await session.run(`
        MATCH (a:Member {id: $memberId}), (b:Member {id: $connectionId})
        CREATE (a)-[r:${RELATIONSHIP_TYPES.KNOWS} {
          strength: $strength,
          created_at: datetime($createdAt),
          last_interaction: datetime($lastInteraction),
          metadata: $metadata
        }]->(b)
      `, {
        memberId: member.id,
        connectionId: connection.id,
        strength,
        createdAt: faker.date.past().toISOString(),
        lastInteraction: faker.date.recent().toISOString(),
        metadata: {
          context: faker.helpers.arrayElement(['Event', 'Referral', 'Platform']),
          confidence: faker.number.float({ min: 0.5, max: 1 })
        }
      });
    }
  }

  // Create ATTENDED relationships between members and events
  for (const member of members) {
    const eventCount = faker.number.int({
      min: 1,
      max: SEED_CONFIG.eventsPerMember
    });

    const memberEvents = faker.helpers.arrayElements(events, eventCount);

    for (const event of memberEvents) {
      await session.run(`
        MATCH (m:Member {id: $memberId}), (e:Event {id: $eventId})
        CREATE (m)-[r:${RELATIONSHIP_TYPES.ATTENDED} {
          role: $role,
          joined_at: datetime($joinedAt),
          metadata: $metadata
        }]->(e)
      `, {
        memberId: member.id,
        eventId: event.id,
        role: faker.helpers.arrayElement(['Attendee', 'Speaker', 'Organizer']),
        joinedAt: faker.date.past().toISOString(),
        metadata: {
          registration_source: event.platform,
          attendance_confirmed: faker.datatype.boolean(),
          feedback_provided: faker.datatype.boolean()
        }
      });
    }
  }
}

/**
 * Main function to seed the database with test data
 */
export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const driver: Driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password'
    )
  );

  const session = driver.session();

  try {
    if (options.clearExisting) {
      await session.run('MATCH (n) DETACH DELETE n');
    }

    const members = await generateMembers(
      options.seedCount?.members || SEED_CONFIG.members
    );
    const events = await generateEvents(
      options.seedCount?.events || SEED_CONFIG.events
    );

    // Create member nodes
    for (const member of members) {
      await session.run(`
        CREATE (m:Member {
          id: $id,
          profile: $profile,
          socialProfiles: $socialProfiles,
          entityStatus: $entityStatus,
          created_at: datetime($createdAt),
          updated_at: datetime($updatedAt),
          last_activity: datetime($lastActivity)
        })
      `, {
        ...member,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        lastActivity: member.lastActivity.toISOString()
      });
    }

    // Create event nodes
    for (const event of events) {
      await session.run(`
        CREATE (e:Event {
          id: $id,
          title: $title,
          description: $description,
          start_date: datetime($startDate),
          end_date: datetime($endDate),
          location: $location,
          platform: $platform,
          external_id: $externalId,
          metadata: $metadata,
          validation_status: $validationStatus,
          created_at: datetime($createdAt),
          updated_at: datetime($updatedAt),
          created_by: $createdBy,
          updated_by: $updatedBy
        })
      `, {
        ...event,
        startDate: event.start_date.toISOString(),
        endDate: event.end_date.toISOString(),
        createdAt: event.created_at.toISOString(),
        updatedAt: event.updated_at.toISOString()
      });
    }

    await createRelationships(session, members, events);

    console.log(`Successfully seeded database with:
      - ${members.length} members
      - ${events.length} events
      - Relationships created with temporal properties and metadata`);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}