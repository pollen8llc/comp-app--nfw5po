import { faker } from '@faker-js/faker'; // v8.x
import { v4 as uuidv4 } from 'uuid'; // v9.x

import { 
  Member, 
  Profile, 
  SocialProfile, 
  SocialPlatform, 
  DataClassification,
  EntityStatus,
  EntityConfidenceLevel 
} from '../../backend/shared/types/member.types';

import {
  Event,
  EventPlatform,
  EventMetadata,
  EventValidationStatus
} from '../../backend/shared/types/event.types';

import {
  TDAParameters,
  DistanceMetric,
  NetworkMetrics,
  TopologicalFeature
} from '../../backend/shared/types/analytics.types';

/**
 * Generates a mock member with realistic profile data
 * @param overrides - Optional overrides for member data
 * @returns Generated mock member data with validation status
 */
export function generateMockMember(overrides: Partial<Member> = {}): Member {
  const socialPlatforms: SocialPlatform[] = ['LINKEDIN', 'GMAIL'];
  
  const profile: Profile = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    location: faker.location.city() + ', ' + faker.location.country(),
    bio: faker.lorem.paragraph(),
    dataClassification: faker.helpers.arrayElement([
      'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
    ] as DataClassification[])
  };

  const socialProfiles: SocialProfile[] = socialPlatforms.map(platform => ({
    platform,
    externalId: uuidv4(),
    authData: {
      accessToken: faker.string.alphanumeric(64),
      refreshToken: faker.string.alphanumeric(64)
    },
    verified: faker.datatype.boolean(),
    lastSynced: faker.date.recent()
  }));

  const entityStatus: EntityStatus = {
    isResolved: faker.datatype.boolean(),
    confidence: faker.number.float({ min: 0, max: 1 }) as EntityConfidenceLevel,
    lastResolutionDate: faker.date.recent()
  };

  const mockMember: Member = {
    id: uuidv4(),
    profile,
    socialProfiles,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    lastActivity: faker.date.recent(),
    entityStatus,
    ...overrides
  };

  return mockMember;
}

/**
 * Generates a mock event with platform-specific data
 * @param overrides - Optional overrides for event data
 * @returns Generated mock event data with platform context
 */
export function generateMockEvent(overrides: Partial<Event> = {}): Event {
  const startDate = faker.date.future();
  const endDate = new Date(startDate.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));

  const metadata: EventMetadata = {
    tags: {
      category: { value: faker.helpers.arrayElement(['Tech', 'Social', 'Workshop']), validated: true },
      format: { value: faker.helpers.arrayElement(['In-Person', 'Virtual', 'Hybrid']), validated: true }
    },
    categories: faker.helpers.arrayElements(['Networking', 'Learning', 'Social', 'Tech'], { min: 1, max: 3 }),
    capacity: faker.number.int({ min: 10, max: 200 }),
    is_private: faker.datatype.boolean(),
    dataClassification: faker.helpers.arrayElement(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']),
    lastModifiedBy: uuidv4(),
    lastModifiedAt: faker.date.recent()
  };

  const mockEvent: Event = {
    id: uuidv4(),
    title: faker.company.catchPhrase(),
    description: faker.lorem.paragraphs(2),
    start_date: startDate,
    end_date: endDate,
    location: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    platform: faker.helpers.arrayElement(Object.values(EventPlatform)),
    external_id: uuidv4(),
    metadata,
    participants: Array.from({ length: faker.number.int({ min: 5, max: 30 }) }, () => uuidv4()),
    validationStatus: faker.helpers.arrayElement(Object.values(EventValidationStatus)),
    created_at: faker.date.past(),
    updated_at: faker.date.recent(),
    created_by: uuidv4(),
    updated_by: uuidv4(),
    ...overrides
  };

  return mockEvent;
}

/**
 * Generates mock TDA computation parameters
 * @param overrides - Optional overrides for TDA parameters
 * @returns Generated mock TDA parameters with validation
 */
export function generateMockTDAParameters(overrides: Partial<TDAParameters> = {}): TDAParameters {
  const mockParameters: TDAParameters = {
    epsilon: faker.number.float({ min: 0.1, max: 1.0, precision: 0.1 }),
    minPoints: faker.number.int({ min: 5, max: 50 }),
    dimension: faker.helpers.arrayElement([2, 3]),
    persistenceThreshold: faker.number.float({ min: 0.1, max: 0.9, precision: 0.1 }),
    distanceMetric: faker.helpers.arrayElement(Object.values(DistanceMetric)),
    ...overrides
  };

  return mockParameters;
}

/**
 * Generates mock graph data with community structure
 * @param nodeCount - Number of nodes to generate
 * @param edgeDensity - Edge density (0.0-1.0)
 * @returns Generated mock graph structure with metrics
 */
export function generateMockGraphData(nodeCount: number, edgeDensity: number): {
  nodes: Array<{ id: string; metadata: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; weight: number }>;
  metrics: NetworkMetrics;
} {
  // Validate input parameters
  if (nodeCount < 2) throw new Error('Node count must be at least 2');
  if (edgeDensity < 0 || edgeDensity > 1) throw new Error('Edge density must be between 0 and 1');

  // Generate nodes
  const nodes = Array.from({ length: nodeCount }, () => ({
    id: uuidv4(),
    metadata: {
      label: faker.word.noun(),
      community: faker.number.int({ min: 1, max: Math.ceil(nodeCount / 10) }),
      weight: faker.number.float({ min: 0, max: 1 })
    }
  }));

  // Generate edges based on density
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const targetEdgeCount = Math.floor(maxEdges * edgeDensity);
  
  const edges = [];
  while (edges.length < targetEdgeCount) {
    const source = faker.helpers.arrayElement(nodes).id;
    const target = faker.helpers.arrayElement(nodes).id;
    
    if (source !== target && !edges.some(e => 
      (e.source === source && e.target === target) || 
      (e.source === target && e.target === source)
    )) {
      edges.push({
        source,
        target,
        weight: faker.number.float({ min: 0, max: 1 })
      });
    }
  }

  // Generate mock network metrics
  const metrics: NetworkMetrics = {
    centralityScores: nodes.reduce((acc, node) => ({
      ...acc,
      [node.id]: faker.number.float({ min: 0, max: 1 })
    }), {}),
    communityMetrics: {
      modularity: faker.number.float({ min: 0, max: 1 }),
      clusteringCoefficient: faker.number.float({ min: 0, max: 1 }),
      averagePath: faker.number.float({ min: 1, max: Math.log(nodeCount) })
    },
    computationTime: faker.date.recent()
  };

  return { nodes, edges, metrics };
}