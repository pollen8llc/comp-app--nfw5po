import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { select } from 'd3-selection'; // v3.0.0
import { createForceSimulation, setupZoomBehavior, setupDragBehavior } from '../../lib/d3-utils';
import { transformGraphData } from '../../lib/graph-utils';
import { GraphControls } from './GraphControls';
import { NodeDetails } from './NodeDetails';
import { Node, Graph } from '../../types/graph';

// Constants for visualization configuration
const ZOOM_SCALE_FACTOR = 1.2;
const ZOOM_TRANSITION_DURATION = 750;
const NODE_COLORS = {
  MEMBER: '#4299E1',
  EVENT: '#48BB78',
  METADATA: '#A0AEC0'
} as const;

const PERFORMANCE_THRESHOLDS = {
  FRAME_BUDGET: 16.67, // ~60fps
  NODE_LIMIT_WEBGL: 10000,
  NODE_LIMIT_SVG: 1000
} as const;

const ACCESSIBILITY_LABELS = {
  ZOOM_IN: 'Zoom in graph visualization',
  ZOOM_OUT: 'Zoom out graph visualization',
  NODE_SELECT: 'Select node in graph'
} as const;

interface GraphVisualizationProps {
  data: Graph;
  width: number;
  height: number;
  onNodeSelect?: (node: Node) => void;
  className?: string;
  renderMode?: 'svg' | 'webgl';
  accessibilityMode?: boolean;
  snapToGrid?: boolean;
  highContrastMode?: boolean;
}

export const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  data,
  width,
  height,
  onNodeSelect,
  className,
  renderMode = 'svg',
  accessibilityMode = false,
  snapToGrid = false,
  highContrastMode = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize visualization with performance optimizations
  useEffect(() => {
    if (!containerRef.current || !svgRef.current || !data) return;

    // Transform data for visualization
    const transformedData = transformGraphData(data, {
      dimensions: { width, height },
      is3D: false,
      useWebGL: renderMode === 'webgl',
      progressiveLoading: true,
      levelOfDetail: transform.k
    });

    // Initialize force simulation
    simulationRef.current = createForceSimulation(
      transformedData.nodes,
      transformedData.edges,
      width,
      height,
      {
        strength: -30,
        distance: 100,
        collisionStrength: snapToGrid ? 1 : 0.7
      }
    );

    // Setup zoom behavior
    const zoom = setupZoomBehavior(
      svgRef.current,
      svgRef.current.querySelector('g.zoom-group') as SVGGElement,
      {
        minScale: 0.5,
        maxScale: 2,
        transitionDuration: ZOOM_TRANSITION_DURATION
      }
    );

    // Setup drag behavior
    const drag = setupDragBehavior(simulationRef.current, {
      enabled: !accessibilityMode,
      collisionDetection: true,
      snapToGrid
    });

    // Apply initial transforms
    select(svgRef.current)
      .call(zoom)
      .call(zoom.transform, transform);

    // Setup nodes and edges with accessibility attributes
    const svg = select(svgRef.current);
    const zoomGroup = svg.select('g.zoom-group');

    // Render nodes with proper ARIA attributes
    const nodes = zoomGroup
      .selectAll('g.node')
      .data(transformedData.nodes)
      .join('g')
      .attr('class', 'node')
      .attr('role', 'button')
      .attr('aria-label', d => `${d.type} node: ${d.properties.name || d.id}`)
      .attr('tabindex', accessibilityMode ? 0 : -1)
      .call(drag as any);

    nodes
      .append('circle')
      .attr('r', d => d.properties.size || 5)
      .attr('fill', d => NODE_COLORS[d.type] || NODE_COLORS.METADATA)
      .attr('stroke', highContrastMode ? '#000000' : 'none')
      .attr('stroke-width', highContrastMode ? 2 : 0);

    // Render edges with proper styling
    zoomGroup
      .selectAll('line.edge')
      .data(transformedData.edges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', highContrastMode ? '#000000' : '#E2E8F0')
      .attr('stroke-width', highContrastMode ? 2 : 1)
      .attr('stroke-opacity', 0.6);

    setIsInitialized(true);

    // Cleanup
    return () => {
      simulationRef.current?.stop();
    };
  }, [data, width, height, renderMode, snapToGrid, highContrastMode, accessibilityMode]);

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current) return;
    const newScale = transform.k * ZOOM_SCALE_FACTOR;
    setTransform(prev => ({ ...prev, k: newScale }));
  }, [transform]);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current) return;
    const newScale = transform.k / ZOOM_SCALE_FACTOR;
    setTransform(prev => ({ ...prev, k: newScale }));
  }, [transform]);

  const handleCenter = useCallback(() => {
    if (!svgRef.current) return;
    setTransform({ k: 1, x: 0, y: 0 });
  }, []);

  // Handle node selection with keyboard support
  const handleNodeSelect = useCallback((node: Node) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  return (
    <div
      ref={containerRef}
      className={`graph-visualization relative ${className || ''}`}
      style={{ width, height }}
      role="application"
      aria-label="Graph visualization"
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="graph-svg"
        style={{ overflow: 'visible' }}
      >
        <g className="zoom-group" />
      </svg>

      <GraphControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
        className="absolute top-4 left-4"
      />

      <AnimatePresence>
        {selectedNode && (
          <NodeDetails
            selectedNode={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </AnimatePresence>

      {/* Accessibility overlay for keyboard navigation */}
      {accessibilityMode && (
        <div
          className="sr-only"
          role="alert"
          aria-live="polite"
        >
          {selectedNode ? (
            `Selected node: ${selectedNode.type} - ${selectedNode.properties.name || selectedNode.id}`
          ) : (
            'No node selected'
          )}
        </div>
      )}
    </div>
  );
};

export type { GraphVisualizationProps };