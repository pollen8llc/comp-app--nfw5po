import { v4 as uuidv4 } from 'uuid'; // v9.x
import { random } from 'lodash'; // v4.x

import { NodeType, EdgeType, GraphNode, GraphEdge } from '../../web/src/types/graph';
import { generateMockMember, generateMockEvent } from './mock-data';

/**
 * Generates a random graph structure with specified number of nodes and edges for testing
 * @param nodeCount - Number of nodes to generate
 * @param edgeDensity - Edge density between 0 and 1
 * @returns Graph structure with nodes and edges
 */
export function generateRandomGraph(nodeCount: number, edgeDensity: number): { 
  nodes: GraphNode[],
  edges: GraphEdge[] 
} {
  if (nodeCount < 2) throw new Error('Node count must be at least 2');
  if (edgeDensity < 0 || edgeDensity > 1) throw new Error('Edge density must be between 0 and 1');

  // Generate nodes with random types
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, () => ({
    id: uuidv4(),
    type: random([NodeType.MEMBER, NodeType.EVENT, NodeType.METADATA]),
    properties: {
      label: `Node-${uuidv4().slice(0, 8)}`,
      weight: random(0, 1, true)
    }
  }));

  // Calculate target number of edges based on density
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const targetEdgeCount = Math.floor(maxEdges * edgeDensity);

  // Generate edges
  const edges: GraphEdge[] = [];
  while (edges.length < targetEdgeCount) {
    const source = random(0, nodes.length - 1);
    const target = random(0, nodes.length - 1);

    if (source !== target && !edges.some(e => 
      (e.source === nodes[source].id && e.target === nodes[target].id) ||
      (e.source === nodes[target].id && e.target === nodes[source].id)
    )) {
      edges.push({
        id: uuidv4(),
        type: determineEdgeType(nodes[source].type, nodes[target].type),
        source: nodes[source].id,
        target: nodes[target].id
      });
    }
  }

  return { nodes, edges };
}

/**
 * Generates a realistic community graph structure with members and events
 * @param memberCount - Number of member nodes
 * @param eventCount - Number of event nodes
 * @param connectionDensity - Density of connections between members (0-1)
 * @returns Community graph structure
 */
export function generateCommunityGraph(
  memberCount: number,
  eventCount: number,
  connectionDensity: number
): {
  nodes: GraphNode[],
  edges: GraphEdge[]
} {
  // Generate member nodes
  const memberNodes: GraphNode[] = Array.from({ length: memberCount }, () => {
    const mockMember = generateMockMember();
    return {
      id: mockMember.id,
      type: NodeType.MEMBER,
      properties: {
        name: mockMember.profile.name,
        email: mockMember.profile.email,
        location: mockMember.profile.location
      }
    };
  });

  // Generate event nodes
  const eventNodes: GraphNode[] = Array.from({ length: eventCount }, () => {
    const mockEvent = generateMockEvent();
    return {
      id: mockEvent.id,
      type: NodeType.EVENT,
      properties: {
        title: mockEvent.title,
        date: mockEvent.start_date,
        location: mockEvent.location
      }
    };
  });

  const nodes = [...memberNodes, ...eventNodes];
  const edges: GraphEdge[] = [];

  // Generate KNOWS edges between members
  const maxMemberEdges = (memberCount * (memberCount - 1)) / 2;
  const targetMemberEdges = Math.floor(maxMemberEdges * connectionDensity);

  while (edges.filter(e => e.type === EdgeType.KNOWS).length < targetMemberEdges) {
    const source = random(0, memberCount - 1);
    const target = random(0, memberCount - 1);

    if (source !== target && !edges.some(e =>
      e.type === EdgeType.KNOWS &&
      ((e.source === memberNodes[source].id && e.target === memberNodes[target].id) ||
       (e.source === memberNodes[target].id && e.target === memberNodes[source].id))
    )) {
      edges.push({
        id: uuidv4(),
        type: EdgeType.KNOWS,
        source: memberNodes[source].id,
        target: memberNodes[target].id
      });
    }
  }

  // Generate ATTENDED edges between members and events
  eventNodes.forEach(event => {
    const attendeeCount = random(1, Math.max(2, Math.floor(memberCount * 0.3)));
    const attendees = new Set<number>();

    while (attendees.size < attendeeCount) {
      attendees.add(random(0, memberCount - 1));
    }

    attendees.forEach(memberIndex => {
      edges.push({
        id: uuidv4(),
        type: EdgeType.ATTENDED,
        source: memberNodes[memberIndex].id,
        target: event.id
      });
    });
  });

  return { nodes, edges };
}

/**
 * Generates a toroidal graph structure for testing TDA features
 * @param radius - Radius of the torus
 * @param nodeCount - Number of nodes to place on the torus
 * @returns Toroidal graph structure
 */
export function generateToroidalGraph(radius: number, nodeCount: number): {
  nodes: GraphNode[],
  edges: GraphEdge[]
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Generate nodes in a toroidal arrangement
  for (let i = 0; i < nodeCount; i++) {
    const theta = (2 * Math.PI * i) / nodeCount;
    const phi = (2 * Math.PI * i) / nodeCount;
    
    const x = (radius + Math.cos(phi)) * Math.cos(theta);
    const y = (radius + Math.cos(phi)) * Math.sin(theta);
    const z = Math.sin(phi);

    nodes.push({
      id: uuidv4(),
      type: NodeType.MEMBER,
      properties: {
        x, y, z,
        weight: random(0, 1, true)
      }
    });
  }

  // Create edges to form toroidal structure
  for (let i = 0; i < nodeCount; i++) {
    // Connect to next node in major circle
    edges.push({
      id: uuidv4(),
      type: EdgeType.KNOWS,
      source: nodes[i].id,
      target: nodes[(i + 1) % nodeCount].id
    });

    // Connect to node in minor circle
    const minorCircleIndex = (i + Math.floor(nodeCount / 4)) % nodeCount;
    edges.push({
      id: uuidv4(),
      type: EdgeType.KNOWS,
      source: nodes[i].id,
      target: nodes[minorCircleIndex].id
    });
  }

  return { nodes, edges };
}

/**
 * Generates a graph with distinct clusters for testing community detection
 * @param clusterCount - Number of clusters to generate
 * @param nodesPerCluster - Number of nodes in each cluster
 * @param interClusterDensity - Density of connections between clusters (0-1)
 * @returns Clustered graph structure
 */
export function generateClusteredGraph(
  clusterCount: number,
  nodesPerCluster: number,
  interClusterDensity: number
): {
  nodes: GraphNode[],
  edges: GraphEdge[]
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Generate clusters
  for (let c = 0; c < clusterCount; c++) {
    const clusterNodes: GraphNode[] = Array.from({ length: nodesPerCluster }, () => ({
      id: uuidv4(),
      type: NodeType.MEMBER,
      properties: {
        cluster: c,
        weight: random(0, 1, true)
      }
    }));

    // Create dense connections within cluster
    for (let i = 0; i < nodesPerCluster; i++) {
      for (let j = i + 1; j < nodesPerCluster; j++) {
        if (random(0, 1, true) < 0.7) { // High intra-cluster density
          edges.push({
            id: uuidv4(),
            type: EdgeType.KNOWS,
            source: clusterNodes[i].id,
            target: clusterNodes[j].id
          });
        }
      }
    }

    nodes.push(...clusterNodes);
  }

  // Add sparse connections between clusters
  for (let c1 = 0; c1 < clusterCount; c1++) {
    for (let c2 = c1 + 1; c2 < clusterCount; c2++) {
      if (random(0, 1, true) < interClusterDensity) {
        const sourceNode = nodes.find(n => n.properties.cluster === c1)!;
        const targetNode = nodes.find(n => n.properties.cluster === c2)!;
        
        edges.push({
          id: uuidv4(),
          type: EdgeType.KNOWS,
          source: sourceNode.id,
          target: targetNode.id
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Helper function to determine appropriate edge type based on connected node types
 */
function determineEdgeType(sourceType: NodeType, targetType: NodeType): EdgeType {
  if (sourceType === NodeType.MEMBER && targetType === NodeType.MEMBER) {
    return EdgeType.KNOWS;
  }
  if (sourceType === NodeType.MEMBER && targetType === NodeType.EVENT) {
    return EdgeType.ATTENDED;
  }
  if (sourceType === NodeType.MEMBER && targetType === NodeType.METADATA) {
    return EdgeType.HAS_METADATA;
  }
  return EdgeType.KNOWS; // Default case
}