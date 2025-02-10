import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum 
} from 'd3-force'; // v3.0.0
import { zoom, ZoomBehavior } from 'd3-zoom'; // v3.0.0
import { drag, DragBehavior } from 'd3-drag'; // v3.0.0
import { select, Selection } from 'd3-selection'; // v3.0.0
import { Node, Edge, NodeType } from '../types/graph';

// Force simulation configuration constants
const FORCE_SIMULATION_CONFIG = {
  STRENGTH: -30,
  DISTANCE: 100,
  ALPHA: 0.3,
  ALPHA_DECAY: 0.0228,
  VELOCITY_DECAY: 0.4,
  COLLISION_STRENGTH: 0.7,
  LINK_STRENGTH: 0.5
} as const;

// Node radius configuration by type
const NODE_RADIUS = {
  MEMBER: 20,
  EVENT: 15,
  METADATA: 10,
  MIN_RADIUS: 5,
  MAX_RADIUS: 30,
  SCALE_FACTOR: 1.5
} as const;

// Zoom behavior configuration
const ZOOM_CONFIG = {
  MIN_SCALE: 0.5,
  MAX_SCALE: 2,
  TRANSITION_DURATION: 750,
  DOUBLE_TAP_DELAY: 300,
  TOUCH_ZOOM_FACTOR: 1.2
} as const;

// Performance optimization configuration
const PERFORMANCE_CONFIG = {
  THROTTLE_DELAY: 16,
  CULLING_MARGIN: 100,
  MAX_NODES_FULL_SIMULATION: 1000
} as const;

interface SimulationConfig {
  strength?: number;
  distance?: number;
  alpha?: number;
  alphaDecay?: number;
  velocityDecay?: number;
  collisionStrength?: number;
  linkStrength?: number;
}

interface ZoomConfig {
  minScale?: number;
  maxScale?: number;
  transitionDuration?: number;
  doubleTapDelay?: number;
  touchZoomFactor?: number;
}

interface DragConfig {
  enabled?: boolean;
  collisionDetection?: boolean;
  snapToGrid?: boolean;
}

/**
 * Creates and configures a D3 force simulation for graph layout
 * @param nodes - Array of graph nodes
 * @param edges - Array of graph edges
 * @param width - Container width
 * @param height - Container height
 * @param config - Optional simulation configuration
 */
export function createForceSimulation(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number,
  config: SimulationConfig = {}
): Simulation<SimulationNodeDatum, SimulationLinkDatum<SimulationNodeDatum>> {
  // Calculate dynamic force strength based on node count
  const dynamicStrength = Math.min(
    FORCE_SIMULATION_CONFIG.STRENGTH,
    -30 * Math.log10(nodes.length)
  );

  // Create simulation with configured parameters
  const simulation = forceSimulation(nodes as SimulationNodeDatum[])
    .force('charge', forceManyBody()
      .strength(config.strength || dynamicStrength))
    .force('link', forceLink(edges as SimulationLinkDatum<SimulationNodeDatum>[])
      .id((d: any) => d.id)
      .distance(config.distance || FORCE_SIMULATION_CONFIG.DISTANCE)
      .strength((d: any) => (d.weight || 1) * (config.linkStrength || FORCE_SIMULATION_CONFIG.LINK_STRENGTH)))
    .force('center', forceCenter(width / 2, height / 2))
    .alpha(config.alpha || FORCE_SIMULATION_CONFIG.ALPHA)
    .alphaDecay(config.alphaDecay || FORCE_SIMULATION_CONFIG.ALPHA_DECAY)
    .velocityDecay(config.velocityDecay || FORCE_SIMULATION_CONFIG.VELOCITY_DECAY);

  // Implement node culling for performance
  if (nodes.length > PERFORMANCE_CONFIG.MAX_NODES_FULL_SIMULATION) {
    simulation.on('tick', () => {
      nodes.forEach((node: any) => {
        node.visible = isNodeInViewport(
          node.x,
          node.y,
          width,
          height,
          PERFORMANCE_CONFIG.CULLING_MARGIN
        );
      });
    });
  }

  return simulation;
}

/**
 * Configures D3 zoom behavior with smooth transitions and touch support
 * @param container - SVG container element
 * @param zoomGroup - SVG group element for zoom transformation
 * @param config - Optional zoom configuration
 */
export function setupZoomBehavior(
  container: SVGElement,
  zoomGroup: SVGGElement,
  config: ZoomConfig = {}
): ZoomBehavior<SVGElement, unknown> {
  const zoomBehavior = zoom<SVGElement, unknown>()
    .scaleExtent([
      config.minScale || ZOOM_CONFIG.MIN_SCALE,
      config.maxScale || ZOOM_CONFIG.MAX_SCALE
    ])
    .on('zoom', (event) => {
      select(zoomGroup)
        .attr('transform', event.transform);
    });

  // Add touch support with double-tap to zoom
  let lastTap = 0;
  select(container)
    .on('touchend', (event) => {
      const currentTime = new Date().getTime();
      const tapDelay = currentTime - lastTap;
      if (tapDelay < (config.doubleTapDelay || ZOOM_CONFIG.DOUBLE_TAP_DELAY)) {
        const scale = event.transform.k * (config.touchZoomFactor || ZOOM_CONFIG.TOUCH_ZOOM_FACTOR);
        zoomBehavior.scaleTo(select(container), scale);
      }
      lastTap = currentTime;
    });

  return zoomBehavior;
}

/**
 * Configures D3 drag behavior with collision detection
 * @param simulation - D3 force simulation instance
 * @param config - Optional drag configuration
 */
export function setupDragBehavior(
  simulation: Simulation<SimulationNodeDatum, SimulationLinkDatum<SimulationNodeDatum>>,
  config: DragConfig = {}
): DragBehavior<Element, SimulationNodeDatum, SimulationNodeDatum> {
  const dragBehavior = drag<Element, SimulationNodeDatum>()
    .on('start', (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on('drag', (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;

      if (config.collisionDetection) {
        handleCollisions(event.subject, simulation.nodes() as Node[]);
      }
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });

  return dragBehavior;
}

/**
 * Calculates node radius with dynamic sizing and responsive scaling
 * @param type - Node type
 * @param properties - Node properties
 * @param viewportScale - Current viewport scale factor
 */
export function calculateNodeRadius(
  type: NodeType,
  properties: Record<string, any>,
  viewportScale: number
): number {
  let baseRadius: number;

  switch (type) {
    case NodeType.MEMBER:
      baseRadius = NODE_RADIUS.MEMBER;
      break;
    case NodeType.EVENT:
      baseRadius = NODE_RADIUS.EVENT;
      break;
    case NodeType.METADATA:
      baseRadius = NODE_RADIUS.METADATA;
      break;
    default:
      baseRadius = NODE_RADIUS.MIN_RADIUS;
  }

  // Apply property-based modifiers
  if (properties.importance) {
    baseRadius *= (1 + properties.importance * 0.5);
  }

  // Scale radius based on viewport
  const scaledRadius = baseRadius * (viewportScale || 1) * NODE_RADIUS.SCALE_FACTOR;

  // Apply constraints
  return Math.min(
    Math.max(scaledRadius, NODE_RADIUS.MIN_RADIUS),
    NODE_RADIUS.MAX_RADIUS
  );
}

// Helper function to check if node is in viewport
function isNodeInViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number
): boolean {
  return x >= -margin &&
         x <= width + margin &&
         y >= -margin &&
         y <= height + margin;
}

// Helper function for collision detection
function handleCollisions(
  draggedNode: Node,
  nodes: Node[]
): void {
  nodes.forEach((node) => {
    if (node === draggedNode) return;

    const dx = draggedNode.x! - node.x!;
    const dy = draggedNode.y! - node.y!;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = calculateNodeRadius(draggedNode.type, draggedNode.properties, 1) +
                       calculateNodeRadius(node.type, node.properties, 1);

    if (distance < minDistance) {
      const scale = (minDistance - distance) / distance;
      draggedNode.x! += dx * scale * FORCE_SIMULATION_CONFIG.COLLISION_STRENGTH;
      draggedNode.y! += dy * scale * FORCE_SIMULATION_CONFIG.COLLISION_STRENGTH;
    }
  });
}