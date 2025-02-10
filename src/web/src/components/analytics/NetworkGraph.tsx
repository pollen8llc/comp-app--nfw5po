import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { select } from 'd3-selection'; // v3.0.0
import WebGL from 'webgl-utils'; // v2.0.0
import { createForceSimulation } from '../../lib/d3-utils';
import { useGraph } from '../../hooks/useGraph';
import type { Graph, GraphVisualizationConfig, Node, Edge } from '../../types/graph';

interface NetworkGraphProps {
  graph: Graph;
  config: GraphVisualizationConfig;
  onNodeSelect?: (nodeId: string) => void;
  className?: string;
  'aria-label'?: string;
}

// WebGL shader programs
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute vec4 a_color;
  uniform vec2 u_resolution;
  uniform float u_zoom;
  varying vec4 v_color;
  void main() {
    vec2 position = (a_position / u_resolution * 2.0 - 1.0) * u_zoom;
    gl_Position = vec4(position, 0, 1);
    gl_PointSize = a_size * u_zoom;
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 v_color;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float distance = length(coord);
    float alpha = 1.0 - smoothstep(0.45, 0.5, distance);
    gl_FragColor = v_color * alpha;
  }
`;

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  graph,
  config,
  onNodeSelect,
  className = '',
  'aria-label': ariaLabel = 'Network graph visualization'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLRenderingContext | null>(null);
  const animationFrameRef = useRef<number>();
  const programRef = useRef<WebGLProgram | null>(null);

  const {
    graph: graphState,
    updateGraph,
    visualization,
    selectNode,
    updateViewport,
    performance,
    accessibility
  } = useGraph(config);

  // Initialize WebGL context and shaders
  const initWebGL = useCallback(() => {
    if (!canvasRef.current) return;

    const gl = canvasRef.current.getContext('webgl', {
      antialias: true,
      alpha: true
    });

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glContextRef.current = gl;

    // Create shader program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    programRef.current = program;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }, []);

  // Update WebGL buffers with new graph data
  const updateBuffers = useCallback(() => {
    const gl = glContextRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    // Create buffers for nodes
    const positions = new Float32Array(graph.nodes.flatMap(node => [node.position.x, node.position.y]));
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Create buffers for node sizes
    const sizes = new Float32Array(graph.nodes.map(node => config.nodes.size));
    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

    const sizeLocation = gl.getAttribLocation(program, 'a_size');
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);
  }, [graph, config.nodes.size]);

  // Render frame using WebGL
  const renderFrame = useCallback(() => {
    const gl = glContextRef.current;
    if (!gl || !programRef.current) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const resolutionLocation = gl.getUniformLocation(programRef.current, 'u_resolution');
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    const zoomLocation = gl.getUniformLocation(programRef.current, 'u_zoom');
    gl.uniform1f(zoomLocation, visualization.zoom);

    gl.drawArrays(gl.POINTS, 0, graph.nodes.length);

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [graph.nodes.length, visualization.zoom]);

  // Initialize force simulation
  useEffect(() => {
    const simulation = createForceSimulation(
      graph.nodes,
      graph.edges,
      config.dimensions.width,
      config.dimensions.height
    );

    simulation.on('tick', () => {
      updateBuffers();
    });

    return () => simulation.stop();
  }, [graph, config.dimensions, updateBuffers]);

  // Initialize WebGL and start rendering
  useEffect(() => {
    initWebGL();
    updateBuffers();
    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (glContextRef.current) {
        const gl = glContextRef.current;
        if (programRef.current) {
          gl.deleteProgram(programRef.current);
        }
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
      }
    };
  }, [initWebGL, updateBuffers, renderFrame]);

  // Handle canvas interactions
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    const clickedNode = graph.nodes.find(node => {
      const dx = node.position.x - x;
      const dy = node.position.y - y;
      return Math.sqrt(dx * dx + dy * dy) < config.nodes.size;
    });

    if (clickedNode) {
      selectNode(clickedNode.id);
      onNodeSelect?.(clickedNode.id);
    }
  }, [graph.nodes, config.nodes.size, selectNode, onNodeSelect]);

  return (
    <motion.div
      className={`network-graph-container ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: config.animation.duration }}
    >
      <canvas
        ref={canvasRef}
        width={config.dimensions.width}
        height={config.dimensions.height}
        onClick={handleCanvasClick}
        className="network-graph-canvas"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'pointer'
        }}
      />
      {accessibility.screenReaderLabels && (
        <div className="visually-hidden" role="status" aria-live="polite">
          {`Graph contains ${graph.nodes.length} nodes and ${graph.edges.length} edges`}
        </div>
      )}
    </motion.div>
  );
};

export default NetworkGraph;