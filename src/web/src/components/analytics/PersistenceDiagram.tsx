import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3'; // v7.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { useAnalytics } from '../../hooks/useAnalytics';
import { PersistenceDiagram } from '../../types/analytics';

// Constants for visualization
const MARGIN = { top: 40, right: 40, bottom: 60, left: 60 };
const POINT_RADIUS = 4;
const TRANSITION_DURATION = 500;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

interface PersistenceDiagramProps {
  data: PersistenceDiagram;
  width: number;
  height: number;
  className?: string;
  onPointClick?: (point: [number, number], metadata: any) => void;
}

interface VisualizationScales {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
}

export const PersistenceDiagram: React.FC<PersistenceDiagramProps> = ({
  data,
  width,
  height,
  className = '',
  onPointClick
}) => {
  // Refs for D3 elements
  const svgRef = useRef<SVGSVGElement>(null);
  const scalesRef = useRef<VisualizationScales | null>(null);
  const animationFrameRef = useRef<number>();

  // Access analytics context for TDA parameters
  const { tdaParams } = useAnalytics();

  // Calculate inner dimensions
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Memoize scales to prevent unnecessary recalculations
  const scales = useMemo(() => {
    const maxValue = Math.max(
      ...data.points.map(p => Math.max(p[0], p[1])),
      tdaParams.epsilon
    );

    const x = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([innerHeight, 0]);

    return { x, y };
  }, [innerWidth, innerHeight, data.points, tdaParams.epsilon]);

  // Initialize visualization
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group with margins
    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add diagonal reference line
    g.append('line')
      .attr('class', 'reference-line')
      .attr('x1', scales.x(0))
      .attr('y1', scales.y(0))
      .attr('x2', scales.x(scales.x.domain()[1]))
      .attr('y2', scales.y(scales.x.domain()[1]))
      .attr('stroke', 'currentColor')
      .attr('stroke-dasharray', '4,4');

    // Add axes
    const xAxis = d3.axisBottom(scales.x);
    const yAxis = d3.axisLeft(scales.y);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', 40)
      .attr('fill', 'currentColor')
      .text('Birth');

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('fill', 'currentColor')
      .text('Death');

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Store scales for updates
    scalesRef.current = scales;
  }, [scales, innerWidth, innerHeight]);

  // Update points with animation
  const updatePoints = useCallback(() => {
    if (!svgRef.current || !scalesRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g');

    // Update existing points with transition
    const points = g.selectAll<SVGCircleElement, [number, number]>('circle.point')
      .data(data.points, (d) => `${d[0]}-${d[1]}`);

    // Exit
    points.exit()
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('r', 0)
      .remove();

    // Enter
    const pointsEnter = points.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', d => scales.x(d[0]))
      .attr('cy', d => scales.y(d[1]))
      .attr('r', 0)
      .attr('fill', 'currentColor')
      .attr('opacity', 0.8);

    // Update + Enter
    points.merge(pointsEnter)
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('cx', d => scales.x(d[0]))
      .attr('cy', d => scales.y(d[1]))
      .attr('r', POINT_RADIUS);

    // Add interaction handlers
    pointsEnter
      .on('mouseover', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', POINT_RADIUS * 1.5)
          .attr('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', POINT_RADIUS)
          .attr('opacity', 0.8);
      })
      .on('click', (event, d) => {
        if (onPointClick) {
          onPointClick(d, data.metadata);
        }
      });

  }, [data.points, data.metadata, scales, onPointClick]);

  // Initialize visualization on mount
  useEffect(() => {
    initializeVisualization();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeVisualization]);

  // Update points when data changes
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updatePoints);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePoints]);

  return (
    <div className={`persistence-diagram ${className}`} role="img" aria-label="Persistence Diagram">
      <motion.svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Accessibility description */}
        <desc>
          Persistence diagram showing topological features with birth times on x-axis and death times on y-axis
        </desc>
        {/* Screen reader text */}
        <text className="sr-only">
          {`Persistence diagram containing ${data.points.length} points in dimension ${data.dimension}`}
        </text>
      </motion.svg>
    </div>
  );
};

// Default export with display name for debugging
PersistenceDiagram.displayName = 'PersistenceDiagram';
export default PersistenceDiagram;