import { Member, CreateMemberInput, ResolveMemberEntityInput } from '../../../shared/types/member.types';
import { Driver, QueryResult, int, DateTime } from 'neo4j-driver'; // v5.12.0

/**
 * Interface for query execution hints to optimize Neo4j performance
 */
interface QueryHints {
  useIndex?: string[];
  forceScan?: boolean;
  useCache?: boolean;
}

/**
 * Interface for query pagination options
 */
interface QueryOptions {
  limit?: number;
  offset?: number;
  depth?: number;
  includeMetadata?: boolean;
}

/**
 * Interface for network query specific options
 */
interface NetworkQueryOptions extends QueryOptions {
  relationshipTypes?: string[];
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  calculateMetrics?: boolean;
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * Interface for resolution metadata tracking
 */
interface ResolutionMetadata {
  confidence: number;
  matchedProperties: string[];
  resolutionDate: Date;
}

/**
 * Interface for network analysis metadata
 */
interface NetworkMetadata {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  clusteringCoefficient?: number;
}

/**
 * Builds an optimized Cypher query for creating a new member node with relationships
 */
export function buildMemberCreateQuery(data: CreateMemberInput) {
  const params: Record<string, any> = {
    id: crypto.randomUUID(),
    profile: {
      ...data.profile,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now()
    },
    socialProfiles: data.socialProfiles.map(profile => ({
      ...profile,
      lastSynced: profile.lastSynced.toISOString()
    }))
  };

  const cypher = `
    CREATE (m:Member {
      id: $id,
      name: $profile.name,
      email: $profile.email,
      location: $profile.location,
      bio: $profile.bio,
      dataClassification: $profile.dataClassification,
      createdAt: $profile.createdAt,
      updatedAt: $profile.updatedAt
    })
    WITH m
    UNWIND $socialProfiles as socialProfile
    CREATE (s:SocialProfile {
      platform: socialProfile.platform,
      externalId: socialProfile.externalId,
      verified: socialProfile.verified,
      lastSynced: datetime(socialProfile.lastSynced)
    })
    CREATE (m)-[:HAS_PROFILE {
      authData: socialProfile.authData
    }]->(s)
    RETURN m
  `;

  const hints: QueryHints = {
    useIndex: ['Member(id)'],
    useCache: true
  };

  return { cypher, params, hints };
}

/**
 * Builds an optimized Cypher query to find a member by ID with configurable depth
 */
export function buildMemberFindByIdQuery(id: string, options: QueryOptions = {}) {
  const { limit = 10, offset = 0, depth = 1, includeMetadata = true } = options;

  const params = {
    id,
    limit: int(limit),
    offset: int(offset),
    depth: int(depth)
  };

  const cypher = `
    MATCH (m:Member {id: $id})
    ${includeMetadata ? `
    OPTIONAL MATCH (m)-[r:HAS_PROFILE]->(s:SocialProfile)
    OPTIONAL MATCH (m)-[mr:HAS_METADATA]->(md:Metadata)
    ` : ''}
    WITH m, 
    ${includeMetadata ? `
      collect(DISTINCT {
        platform: s.platform,
        externalId: s.externalId,
        verified: s.verified,
        lastSynced: s.lastSynced,
        authData: r.authData
      }) as socialProfiles,
      collect(DISTINCT {
        key: md.key,
        value: md.value
      }) as metadata,
    ` : ''}
    m
    RETURN m {
      .*,
      ${includeMetadata ? `
      socialProfiles: socialProfiles,
      metadata: metadata
      ` : '.*'}
    } as member
    SKIP $offset
    LIMIT $limit
  `;

  return { cypher, params };
}

/**
 * Builds a sophisticated Cypher query for resolving and merging duplicate member entities
 */
export function buildEntityResolutionQuery(data: ResolveMemberEntityInput) {
  const params = {
    sourceId: data.sourceId,
    targetId: data.targetId,
    confidence: data.confidence,
    resolutionDate: DateTime.now(),
    metadata: data.resolutionMetadata
  };

  const cypher = `
    MATCH (source:Member {id: $sourceId})
    MATCH (target:Member {id: $targetId})
    WHERE source <> target
    
    // Collect all relationships to transfer
    OPTIONAL MATCH (source)-[r]->(connected)
    WHERE NOT connected:Member
    WITH source, target, collect(DISTINCT {type: type(r), props: properties(r), node: connected}) as outRelations
    
    OPTIONAL MATCH (connected)-[r]->(source)
    WHERE NOT connected:Member
    WITH source, target, outRelations, collect(DISTINCT {type: type(r), props: properties(r), node: connected}) as inRelations
    
    // Create new relationships on target and delete source
    FOREACH (rel IN outRelations |
      MERGE (target)-[newRel:${rel.type} {props}]->(rel.node)
    )
    
    FOREACH (rel IN inRelations |
      MERGE (rel.node)-[newRel:${rel.type} {props}]->(target)
    )
    
    // Create resolution metadata
    CREATE (rm:ResolutionMetadata {
      sourceId: $sourceId,
      targetId: $targetId,
      confidence: $confidence,
      resolutionDate: $resolutionDate,
      metadata: $metadata
    })
    
    // Delete source node and its direct relationships
    DETACH DELETE source
    
    RETURN target
  `;

  const resolutionMetadata: ResolutionMetadata = {
    confidence: data.confidence,
    matchedProperties: Object.keys(data.resolutionMetadata),
    resolutionDate: new Date()
  };

  return { cypher, params, resolutionMetadata };
}

/**
 * Builds an advanced Cypher query for retrieving and analyzing member network connections
 */
export function buildMemberNetworkQuery(id: string, options: NetworkQueryOptions = {}) {
  const {
    depth = 2,
    relationshipTypes = [],
    direction = 'BOTH',
    calculateMetrics = true,
    timeWindow,
    limit = 100
  } = options;

  const params = {
    id,
    depth: int(depth),
    limit: int(limit),
    relationshipTypes: relationshipTypes.length ? relationshipTypes : null,
    timeWindowStart: timeWindow?.start ? DateTime.fromJSDate(timeWindow.start) : null,
    timeWindowEnd: timeWindow?.end ? DateTime.fromJSDate(timeWindow.end) : null
  };

  const relationshipFilter = relationshipTypes.length
    ? `type(r) IN $relationshipTypes`
    : '1=1';

  const timeWindowFilter = timeWindow
    ? 'r.timestamp >= $timeWindowStart AND r.timestamp <= $timeWindowEnd'
    : '1=1';

  const directionPattern = {
    'OUTGOING': '-[r]->',
    'INCOMING': '<-[r]-',
    'BOTH': '-[r]-'
  }[direction];

  const cypher = `
    MATCH path = (m:Member {id: $id})${directionPattern}(connected:Member)
    WHERE ${relationshipFilter}
    AND ${timeWindowFilter}
    AND length(path) <= $depth
    WITH m, connected, r, path
    ${calculateMetrics ? `
    WITH m, 
      count(DISTINCT connected) as nodeCount,
      count(DISTINCT r) as edgeCount,
      avg(size((connected)${directionPattern}(:Member))) as avgDegree
    ` : ''}
    RETURN ${calculateMetrics ? `{
      nodeCount: nodeCount,
      edgeCount: edgeCount,
      averageDegree: avgDegree
    } as networkMetrics,` : ''}
    m as member
    LIMIT $limit
  `;

  const networkMetadata: NetworkMetadata = {
    nodeCount: 0,
    edgeCount: 0,
    averageDegree: 0
  };

  return { cypher, params, networkMetadata };
}