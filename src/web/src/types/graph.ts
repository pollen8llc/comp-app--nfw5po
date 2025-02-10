import { Member } from './members';

/**
 * Supported node types in the knowledge graph
 */
export enum NodeType {
  MEMBER = 'MEMBER',
  EVENT = 'EVENT',
  SOCIAL_PROFILE = 'SOCIAL_PROFILE',
  METADATA = 'METADATA'
}

/**
 * Supported edge types (relationships) in the knowledge graph
 */
export enum EdgeType {
  KNOWS = 'KNOWS',
  ATTENDED = 'ATTENDED',
  HAS_PROFILE = 'HAS_PROFILE',
  HAS_METADATA = 'HAS_METADATA'
}

/**
 * Graph node interface with visualization properties
 * @property id - Unique node identifier
 * @property type - Node type classification
 * @property properties - Dynamic node properties
 * @property position - 2D/3D coordinates for visualization
 * @property visible - Visibility state in visualization
 * @property selected - Selection state in visualization
 */
export interface Node {
  id: string;
  type: NodeType;
  properties: Record<string, unknown>;
  position: {
    x: number;
    y: number;
    z?: number;
  };
  visible: boolean;
  selected: boolean;
}

/**
 * Graph edge interface with visualization properties
 * @property id - Unique edge identifier
 * @property type - Edge type classification
 * @property source - Source node identifier
 * @property target - Target node identifier
 * @property properties - Dynamic edge properties
 * @property visible - Visibility state in visualization
 * @property weight - Edge weight for force-directed layout
 */
export interface Edge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  properties: Record<string, unknown>;
  visible: boolean;
  weight: number;
}

/**
 * Complete graph structure with metadata
 * @property nodes - Array of graph nodes
 * @property edges - Array of graph edges
 * @property metadata - Graph version and timestamp
 */
export interface Graph {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    version: string;
    timestamp: number;
  };
}

/**
 * Graph query pattern for advanced filtering and traversal
 * @property nodes - Node patterns with type and condition filters
 * @property relationships - Edge patterns with direction specification
 * @property conditions - Additional filtering conditions
 * @property limit - Maximum number of results
 */
export interface GraphQueryPattern {
  nodes: Array<{
    type: NodeType;
    conditions?: Record<string, unknown>;
  }>;
  relationships: Array<{
    type: EdgeType;
    direction: 'incoming' | 'outgoing' | 'both';
  }>;
  conditions: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  limit: number;
}

/**
 * Comprehensive configuration for graph visualization
 * @property dimensions - Canvas dimensions and margins
 * @property nodes - Node styling and sizing options
 * @property edges - Edge styling and weighting options
 * @property animation - Framer Motion animation configuration
 * @property interaction - User interaction controls
 * @property performance - Rendering optimization settings
 */
export interface GraphVisualizationConfig {
  dimensions: {
    width: number;
    height: number;
    margin: number;
  };
  nodes: {
    size: number;
    color: Record<NodeType, string>;
    labelSize: number;
  };
  edges: {
    width: number;
    color: Record<EdgeType, string>;
    opacity: number;
  };
  animation: {
    duration: number;
    ease: string;
    staggerChildren: number;
  };
  interaction: {
    zoomRange: [number, number];
    dragEnabled: boolean;
  };
  performance: {
    maxNodes: number;
    maxEdges: number;
  };
}