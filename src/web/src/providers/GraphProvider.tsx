import { createContext, useContext, ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useGraph } from '../hooks/useGraph';
import { Graph } from '../types/graph';
import { transformGraphData } from '../lib/graph-utils';

/**
 * WebGL configuration options for graph rendering
 */
interface WebGLConfig {
  antialias: boolean;
  preserveDrawingBuffer: boolean;
  alpha: boolean;
  powerPreference: 'high-performance' | 'low-power';
}

/**
 * Performance configuration for graph optimization
 */
interface PerformanceConfig {
  frameRateLimit: number;
  qualityThresholds: {
    high: number;
    medium: number;
    low: number;
  };
  memoryLimit: number;
  batchSize: number;
}

/**
 * Error boundary configuration
 */
interface ErrorBoundaryConfig {
  fallback: ReactNode;
  onError: (error: Error) => void;
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  memoryUsage: number;
  renderTime: number;
}

/**
 * Props for the GraphProvider component
 */
interface GraphProviderProps {
  children: ReactNode;
  webGLConfig?: Partial<WebGLConfig>;
  performanceConfig?: Partial<PerformanceConfig>;
  errorConfig?: ErrorBoundaryConfig;
}

/**
 * Graph context value interface
 */
interface GraphContextValue {
  graph: Graph;
  loading: boolean;
  error: Error | null;
  webGLContext: WebGLRenderingContext | null;
  metrics: PerformanceMetrics;
  fetchGraphData: () => Promise<void>;
  updateGraphLayout: (layout: 'force' | 'circular' | 'hierarchical') => void;
  handleNodeSelection: (nodeId: string) => void;
  initializeWebGL: (canvas: HTMLCanvasElement) => void;
  disposeWebGLResources: () => void;
  handleProgressiveLoading: (levelOfDetail: number) => void;
  optimizeGraphRendering: () => void;
}

// Default configurations
const defaultWebGLConfig: WebGLConfig = {
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
  powerPreference: 'high-performance',
};

const defaultPerformanceConfig: PerformanceConfig = {
  frameRateLimit: 60,
  qualityThresholds: {
    high: 1000,
    medium: 5000,
    low: 10000,
  },
  memoryLimit: 1024 * 1024 * 512, // 512MB
  batchSize: 1000,
};

// Create the context with a default value
const GraphContext = createContext<GraphContextValue | null>(null);

/**
 * Graph Provider component that manages global graph state and operations
 */
function GraphProvider({
  children,
  webGLConfig = {},
  performanceConfig = {},
  errorConfig,
}: GraphProviderProps) {
  const mergedWebGLConfig = { ...defaultWebGLConfig, ...webGLConfig };
  const mergedPerformanceConfig = { ...defaultPerformanceConfig, ...performanceConfig };

  const {
    graph,
    updateGraph,
    queryGraph,
    visualization,
    selectNode,
    updateLayout,
    updateViewport,
    performance: metrics,
    accessibility,
    setAccessibility,
  } = useGraph({
    dimensions: {
      width: window.innerWidth,
      height: window.innerHeight,
      margin: 20,
    },
    nodes: {
      size: 10,
      color: {
        MEMBER: '#4299E1',
        EVENT: '#48BB78',
        SOCIAL_PROFILE: '#ED8936',
        METADATA: '#A0AEC0',
      },
      labelSize: 12,
    },
    edges: {
      width: 1,
      color: {
        KNOWS: '#A0AEC0',
        ATTENDED: '#48BB78',
        HAS_PROFILE: '#ED8936',
        HAS_METADATA: '#A0AEC0',
      },
      opacity: 0.6,
    },
    animation: {
      duration: 0.3,
      ease: 'easeInOut',
      staggerChildren: 0.05,
    },
    interaction: {
      zoomRange: [0.1, 3],
      dragEnabled: true,
    },
    performance: {
      maxNodes: mergedPerformanceConfig.qualityThresholds.high,
      maxEdges: mergedPerformanceConfig.qualityThresholds.high * 2,
    },
  });

  // Context value with all graph operations and state
  const contextValue: GraphContextValue = {
    graph,
    loading: false,
    error: null,
    webGLContext: null,
    metrics,
    fetchGraphData: async () => {
      // Implementation for fetching graph data
    },
    updateGraphLayout: (layout) => {
      updateLayout(layout);
    },
    handleNodeSelection: (nodeId) => {
      selectNode(nodeId);
    },
    initializeWebGL: (canvas) => {
      const context = canvas.getContext('webgl', mergedWebGLConfig);
      if (context) {
        contextValue.webGLContext = context;
      }
    },
    disposeWebGLResources: () => {
      if (contextValue.webGLContext) {
        contextValue.webGLContext.getExtension('WEBGL_lose_context')?.loseContext();
        contextValue.webGLContext = null;
      }
    },
    handleProgressiveLoading: (levelOfDetail) => {
      const transformedGraph = transformGraphData(graph, {
        dimensions: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        progressiveLoading: true,
        levelOfDetail,
      });
      updateGraph(transformedGraph);
    },
    optimizeGraphRendering: () => {
      const { nodeCount } = metrics;
      const { qualityThresholds } = mergedPerformanceConfig;
      
      if (nodeCount > qualityThresholds.high) {
        contextValue.handleProgressiveLoading(0.5);
      } else if (nodeCount > qualityThresholds.medium) {
        contextValue.handleProgressiveLoading(0.75);
      }
    },
  };

  // Wrap provider with error boundary if config is provided
  if (errorConfig) {
    return (
      <ErrorBoundary
        fallback={errorConfig.fallback}
        onError={errorConfig.onError}
      >
        <GraphContext.Provider value={contextValue}>
          {children}
        </GraphContext.Provider>
      </ErrorBoundary>
    );
  }

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
}

/**
 * Custom hook to access graph context with type safety
 */
function useGraphContext(): GraphContextValue {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraphContext must be used within a GraphProvider');
  }
  return context;
}

export { GraphContext, GraphProvider, useGraphContext };
export type { GraphContextValue, GraphProviderProps };