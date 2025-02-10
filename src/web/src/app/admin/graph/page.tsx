'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { GraphVisualization } from '../../../components/graph/GraphVisualization';
import { QueryBuilder } from '../../../components/graph/QueryBuilder';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { EmptyState } from '../../../components/common/EmptyState';
import { useGraph } from '../../../hooks/useGraph';
import type { Node, GraphQueryPattern } from '../../../types/graph';

// Animation configuration
const ANIMATION_CONFIG = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 }
};

// Performance configuration
const GRAPH_CONFIG = {
  dimensions: {
    width: 1200,
    height: 800,
    margin: 24
  },
  nodes: {
    size: 8,
    labelSize: 12,
    color: {
      MEMBER: '#4299E1',
      EVENT: '#48BB78',
      SOCIAL_PROFILE: '#ED8936',
      METADATA: '#A0AEC0'
    }
  },
  edges: {
    width: 1,
    opacity: 0.6
  },
  interaction: {
    zoomRange: [0.5, 2],
    dragEnabled: true
  },
  performance: {
    maxNodes: 10000,
    maxEdges: 50000
  }
};

/**
 * Admin graph page component for knowledge graph exploration and visualization
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
export default function GraphPage() {
  // Graph state management
  const {
    graph,
    updateGraph,
    queryGraph,
    visualization,
    selectNode,
    updateLayout,
    updateViewport,
    performance,
    accessibility,
    setAccessibility
  } = useGraph(GRAPH_CONFIG);

  // Local state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [renderMode, setRenderMode] = useState<'svg' | 'webgl'>(
    typeof window !== 'undefined' && 
    window.WebGLRenderingContext ? 'webgl' : 'svg'
  );

  // Handle query changes with debouncing and validation
  const handleQueryChange = useCallback(async (
    pattern: GraphQueryPattern,
    isValid: boolean
  ) => {
    if (!isValid) return;

    try {
      setIsLoading(true);
      const result = await queryGraph(pattern);
      updateGraph(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to execute query'));
    } finally {
      setIsLoading(false);
    }
  }, [queryGraph, updateGraph]);

  // Handle query execution with performance monitoring
  const handleQueryExecute = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      setIsLoading(true);
      await updateLayout('force');
      
      // Log performance metrics
      const endTime = performance.now();
      console.debug(`Query execution time: ${endTime - startTime}ms`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to execute query'));
    } finally {
      setIsLoading(false);
    }
  }, [updateLayout]);

  // Handle node selection with accessibility support
  const handleNodeSelect = useCallback((node: Node) => {
    setSelectedNode(node);
    selectNode(node.id);

    // Update ARIA live region
    const liveRegion = document.getElementById('graph-live-region');
    if (liveRegion) {
      liveRegion.textContent = `Selected node: ${node.type} - ${node.properties.name || node.id}`;
    }
  }, [selectNode]);

  // Initialize graph visualization
  useEffect(() => {
    const initializeGraph = async () => {
      try {
        setIsLoading(true);
        // Initial graph query to populate visualization
        const initialPattern: GraphQueryPattern = {
          nodes: [{ type: 'MEMBER', conditions: {} }],
          relationships: [],
          conditions: [],
          limit: 100
        };
        const result = await queryGraph(initialPattern);
        updateGraph(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize graph'));
      } finally {
        setIsLoading(false);
      }
    };

    initializeGraph();
  }, [queryGraph, updateGraph]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        updateViewport(1, { x: 0, y: 0 });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateViewport]);

  return (
    <ErrorBoundary>
      <motion.div
        className="flex flex-col h-screen bg-surface"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={ANIMATION_CONFIG}
      >
        {/* Query Builder Section */}
        <div className="p-6 border-b border-outline">
          <QueryBuilder
            onQueryChange={handleQueryChange}
            onExecute={handleQueryExecute}
            onSave={async () => {/* Implement query saving */}}
            onClear={() => updateGraph({ nodes: [], edges: [], metadata: { version: '1.0', timestamp: Date.now() } })}
            disabled={isLoading}
            maxComplexity={100}
            className="w-full"
          />
        </div>

        {/* Graph Visualization Section */}
        <div 
          id="graph-container"
          className="flex-1 relative overflow-hidden"
          role="application"
          aria-label="Knowledge graph visualization"
        >
          {isLoading ? (
            <EmptyState
              title="Loading graph data..."
              iconName="settings"
              variant="default"
              loading={true}
            />
          ) : error ? (
            <EmptyState
              title="Error loading graph"
              description={error.message}
              iconName="close"
              variant="default"
              actionLabel="Retry"
              onAction={handleQueryExecute}
            />
          ) : graph.nodes.length === 0 ? (
            <EmptyState
              title="No graph data available"
              description="Use the query builder above to explore the knowledge graph"
              iconName="graph"
              variant="default"
            />
          ) : (
            <GraphVisualization
              data={graph}
              width={GRAPH_CONFIG.dimensions.width}
              height={GRAPH_CONFIG.dimensions.height}
              onNodeSelect={handleNodeSelect}
              renderMode={renderMode}
              accessibilityMode={accessibility.keyboardNavigation}
              snapToGrid={false}
              highContrastMode={accessibility.highContrastMode}
              className="w-full h-full"
            />
          )}
        </div>

        {/* Accessibility Support */}
        <div
          id="graph-live-region"
          className="sr-only"
          role="status"
          aria-live="polite"
        />
      </motion.div>
    </ErrorBoundary>
  );
}