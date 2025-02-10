import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import classNames from 'classnames'; // v2.3.2
import NetworkGraph from './NetworkGraph';
import PersistenceDiagram from './PersistenceDiagram';
import TDAControls from './TDAControls';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useGraph } from '../../hooks/useGraph';
import type { TDAParameters } from '../../types/analytics';

// Visualization modes supported by the panel
enum VisualizationMode {
  NETWORK = 'network',
  PERSISTENCE = 'persistence'
}

interface VisualizationPanelProps {
  className?: string;
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  className = '' 
}) => {
  // State management
  const [activeMode, setActiveMode] = useState<VisualizationMode>(VisualizationMode.NETWORK);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const { 
    graph,
    visualization,
    updateGraph,
    selectNode,
    updateViewport,
    performance,
    accessibility
  } = useGraph({
    dimensions: {
      width: 800,
      height: 600,
      margin: 40
    },
    nodes: {
      size: 20,
      color: {
        MEMBER: '#4B5563',
        EVENT: '#3B82F6',
        SOCIAL_PROFILE: '#10B981',
        METADATA: '#6366F1'
      },
      labelSize: 12
    },
    edges: {
      width: 1,
      color: {
        KNOWS: '#9CA3AF',
        ATTENDED: '#60A5FA',
        HAS_PROFILE: '#34D399',
        HAS_METADATA: '#818CF8'
      },
      opacity: 0.6
    },
    animation: {
      duration: 0.5,
      ease: 'easeInOut',
      staggerChildren: 0.05
    },
    interaction: {
      zoomRange: [0.5, 2],
      dragEnabled: true
    },
    performance: {
      maxNodes: 1000,
      maxEdges: 5000
    }
  });

  const {
    tdaParams,
    computeTDA,
    isLoading,
    error: analyticsError
  } = useAnalytics();

  // Handle TDA computation
  const handleTDACompute = useCallback(async (params: TDAParameters) => {
    try {
      setError(null);
      await computeTDA(params);
      setActiveMode(VisualizationMode.PERSISTENCE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute TDA');
    }
  }, [computeTDA]);

  // Handle visualization mode changes
  const handleModeChange = useCallback((mode: VisualizationMode) => {
    setActiveMode(mode);
    setError(null);
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  // Effect to handle analytics errors
  useEffect(() => {
    if (analyticsError) {
      setError(analyticsError);
    }
  }, [analyticsError]);

  const containerClasses = classNames(
    'visualization-panel',
    'relative rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-lg',
    'border border-gray-200 dark:border-gray-700',
    className
  );

  const modeButtonClasses = (mode: VisualizationMode) => classNames(
    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
    {
      'bg-blue-600 text-white': activeMode === mode,
      'bg-gray-100 text-gray-700 hover:bg-gray-200': activeMode !== mode,
      'dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600': activeMode !== mode
    }
  );

  return (
    <motion.div
      className={containerClasses}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="Analytics Visualization Panel"
    >
      {/* Mode Selection Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-4" role="tablist">
          <button
            role="tab"
            aria-selected={activeMode === VisualizationMode.NETWORK}
            aria-controls="network-view"
            className={modeButtonClasses(VisualizationMode.NETWORK)}
            onClick={() => handleModeChange(VisualizationMode.NETWORK)}
          >
            Network Graph
          </button>
          <button
            role="tab"
            aria-selected={activeMode === VisualizationMode.PERSISTENCE}
            aria-controls="persistence-view"
            className={modeButtonClasses(VisualizationMode.PERSISTENCE)}
            onClick={() => handleModeChange(VisualizationMode.PERSISTENCE)}
          >
            Persistence Diagram
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div 
          className="p-4 bg-red-50 dark:bg-red-900 border-l-4 border-red-500"
          role="alert"
        >
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Visualization Area */}
      <div className="relative" style={{ height: '600px' }}>
        <AnimatePresence mode="wait">
          {activeMode === VisualizationMode.NETWORK ? (
            <motion.div
              key="network"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              id="network-view"
              role="tabpanel"
              aria-labelledby="network-tab"
              className="absolute inset-0"
            >
              <NetworkGraph
                graph={graph}
                config={visualization}
                onNodeSelect={handleNodeSelect}
                className="w-full h-full"
                aria-label="Community network visualization"
              />
            </motion.div>
          ) : (
            <motion.div
              key="persistence"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              id="persistence-view"
              role="tabpanel"
              aria-labelledby="persistence-tab"
              className="absolute inset-0"
            >
              <PersistenceDiagram
                data={tdaParams}
                width={800}
                height={600}
                className="w-full h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        {isLoading && (
          <div 
            className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center"
            role="progressbar"
            aria-busy="true"
          >
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* TDA Controls */}
      {activeMode === VisualizationMode.PERSISTENCE && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <TDAControls
            onCompute={handleTDACompute}
            onError={setError}
            className="w-full"
          />
        </div>
      )}

      {/* Accessibility Information */}
      {accessibility.screenReaderLabels && (
        <div className="sr-only" role="status" aria-live="polite">
          {`Current view: ${activeMode === VisualizationMode.NETWORK ? 'Network Graph' : 'Persistence Diagram'}`}
          {performance && ` - ${performance.nodeCount} nodes and ${performance.edgeCount} edges visible`}
        </div>
      )}
    </motion.div>
  );
};

export default VisualizationPanel;