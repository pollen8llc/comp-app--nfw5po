import { NodeType, EdgeType, GraphVisualizationConfig } from '../types/graph';
import colors from 'tailwindcss/colors'; // ^3.0.0

/**
 * Default graph visualization configuration
 */
const DEFAULT_GRAPH_CONFIG: GraphVisualizationConfig = {
  dimensions: {
    width: 1200,
    height: 800,
    margin: 40
  },
  nodes: {
    size: 30,
    color: {
      [NodeType.MEMBER]: colors.blue[500],
      [NodeType.EVENT]: colors.green[500],
      [NodeType.SOCIAL_PROFILE]: colors.purple[500],
      [NodeType.METADATA]: colors.gray[500]
    },
    labelSize: 12
  },
  edges: {
    width: 2,
    color: {
      [EdgeType.KNOWS]: colors.blue[400],
      [EdgeType.ATTENDED]: colors.green[400],
      [EdgeType.HAS_PROFILE]: colors.purple[400],
      [EdgeType.HAS_METADATA]: colors.gray[400]
    },
    opacity: 0.7
  },
  animation: {
    duration: 0.5,
    ease: 'easeInOut',
    staggerChildren: 0.05
  },
  interaction: {
    zoomRange: [0.25, 4],
    dragEnabled: true
  },
  performance: {
    maxNodes: 1000,
    maxEdges: 2000
  }
};

/**
 * Enhanced node color utility with opacity and hover state support
 * @param nodeType - Type of the node
 * @param opacity - Opacity value between 0 and 1
 * @param isHovered - Whether the node is in hover state
 * @returns RGBA color string
 */
export const getNodeColor = (
  nodeType: NodeType,
  opacity: number = 1,
  isHovered: boolean = false
): string => {
  const baseColor = DEFAULT_GRAPH_CONFIG.nodes.color[nodeType] || colors.gray[500];
  const [r, g, b] = baseColor.match(/\d+/g)?.map(Number) || [128, 128, 128];
  const adjustedOpacity = isHovered ? Math.min(opacity * 1.2, 1) : opacity;
  return `rgba(${r}, ${g}, ${b}, ${adjustedOpacity})`;
};

/**
 * Enhanced edge color utility with opacity and highlight support
 * @param edgeType - Type of the edge
 * @param opacity - Opacity value between 0 and 1
 * @param isHighlighted - Whether the edge is highlighted
 * @returns RGBA color string
 */
export const getEdgeColor = (
  edgeType: EdgeType,
  opacity: number = 1,
  isHighlighted: boolean = false
): string => {
  const baseColor = DEFAULT_GRAPH_CONFIG.edges.color[edgeType] || colors.gray[400];
  const [r, g, b] = baseColor.match(/\d+/g)?.map(Number) || [128, 128, 128];
  const adjustedOpacity = isHighlighted ? Math.min(opacity * 1.5, 1) : opacity;
  return `rgba(${r}, ${g}, ${b}, ${adjustedOpacity})`;
};

/**
 * Comprehensive graph visualization configuration
 */
export const graphConfig = {
  layout: DEFAULT_GRAPH_CONFIG,
  
  // Node styling configuration
  nodeColors: DEFAULT_GRAPH_CONFIG.nodes.color,
  
  // Edge styling configuration
  edgeColors: DEFAULT_GRAPH_CONFIG.edges.color,
  
  // Force simulation settings for graph layout
  forceSimulation: {
    strength: -800,
    distance: 150,
    center: 0.1,
    collision: 1,
    decay: 0.1,
    maxIterations: 300
  },
  
  // Zoom and pan configuration
  zoomConfig: {
    scaleExtent: DEFAULT_GRAPH_CONFIG.interaction.zoomRange,
    translateExtent: [
      [-2000, -2000],
      [2000, 2000]
    ],
    duration: 750
  },
  
  // Animation configuration for Framer Motion
  animation: {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    transition: {
      duration: DEFAULT_GRAPH_CONFIG.animation.duration,
      ease: DEFAULT_GRAPH_CONFIG.animation.ease
    }
  },
  
  // Performance optimization settings
  performance: {
    maxNodes: DEFAULT_GRAPH_CONFIG.performance.maxNodes,
    maxEdges: DEFAULT_GRAPH_CONFIG.performance.maxEdges,
    renderThreshold: 100,
    dynamicRendering: true,
    culling: true
  },
  
  // Accessibility settings
  accessibility: {
    ariaLabels: {
      node: (type: NodeType) => `${type.toLowerCase()} node`,
      edge: (type: EdgeType) => `${type.toLowerCase()} connection`
    },
    keyboardNavigation: true,
    highContrastMode: false,
    focusIndicator: true
  }
};

export { getNodeColor, getEdgeColor };