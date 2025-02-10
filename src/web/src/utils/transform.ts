import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { memoize } from 'lodash';
import { Node, Edge, NodeType, EdgeType } from '../types/graph';

/**
 * Options for graph transformation and visualization
 */
interface TransformOptions {
  highContrast?: boolean;
  dimension?: '2d' | '3d';
  forceStrength?: number;
  linkDistance?: number;
  accessibility?: {
    enableAriaLabels: boolean;
    descriptionTemplate?: string;
  };
}

/**
 * Options for event data normalization
 */
interface NormalizationOptions {
  platform?: 'LUMA' | 'EVENTBRITE' | 'PARTIFUL';
  timezone?: string;
  validateFields?: boolean;
  sanitize?: boolean;
}

/**
 * Transformed graph data with visualization metadata
 */
interface VisualGraph {
  nodes: Array<Node & {
    x: number;
    y: number;
    z?: number;
    radius: number;
    color: string;
    ariaLabel?: string;
  }>;
  edges: Array<Edge & {
    path: string;
    color: string;
    opacity: number;
  }>;
  metadata: {
    bounds: {
      width: number;
      height: number;
    };
    scale: number;
  };
}

/**
 * Color schemes for nodes and edges
 */
const COLOR_SCHEMES = {
  default: {
    nodes: {
      [NodeType.MEMBER]: '#4A90E2',
      [NodeType.EVENT]: '#50E3C2',
      [NodeType.SOCIAL_PROFILE]: '#F5A623',
      [NodeType.METADATA]: '#9013FE'
    },
    edges: {
      [EdgeType.KNOWS]: '#B8C4CE',
      [EdgeType.ATTENDED]: '#86B1F5',
      [EdgeType.HAS_PROFILE]: '#F8C471',
      [EdgeType.HAS_METADATA]: '#C39BD3'
    }
  },
  highContrast: {
    nodes: {
      [NodeType.MEMBER]: '#000000',
      [NodeType.EVENT]: '#FFFFFF',
      [NodeType.SOCIAL_PROFILE]: '#FF0000',
      [NodeType.METADATA]: '#00FF00'
    },
    edges: {
      [EdgeType.KNOWS]: '#000000',
      [EdgeType.ATTENDED]: '#000000',
      [EdgeType.HAS_PROFILE]: '#000000',
      [EdgeType.HAS_METADATA]: '#000000'
    }
  }
};

/**
 * Transforms raw graph data into visualization-ready format with force-directed layout
 * and accessibility support
 * @version d3-force@3.0.0
 */
export const transformGraphForVisualization = memoize((
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number,
  options: TransformOptions = {}
): VisualGraph => {
  // Validate input parameters
  if (!nodes?.length || !edges?.length || width <= 0 || height <= 0) {
    throw new Error('Invalid input parameters for graph transformation');
  }

  const {
    highContrast = false,
    dimension = '2d',
    forceStrength = -30,
    linkDistance = 100,
    accessibility = { enableAriaLabels: true }
  } = options;

  // Select color scheme based on contrast mode
  const colorScheme = highContrast ? COLOR_SCHEMES.highContrast : COLOR_SCHEMES.default;

  // Prepare nodes with initial visualization properties
  const visualNodes = nodes.map(node => ({
    ...node,
    x: Math.random() * width,
    y: Math.random() * height,
    z: dimension === '3d' ? Math.random() * height : undefined,
    radius: 5 + (node.properties.weight as number || 1) * 2,
    color: colorScheme.nodes[node.type],
    ariaLabel: accessibility.enableAriaLabels
      ? `${node.type.toLowerCase()} node: ${node.properties.name || node.id}`
      : undefined
  }));

  // Initialize force simulation
  const simulation = forceSimulation(visualNodes)
    .force('charge', forceManyBody().strength(forceStrength))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collision', forceCollide().radius(d => (d as any).radius + 5))
    .force('link', forceLink(edges)
      .id(d => (d as any).id)
      .distance(linkDistance)
    );

  // Run simulation synchronously
  simulation.tick(300);

  // Calculate edge paths and styling
  const visualEdges = edges.map(edge => {
    const source = visualNodes.find(n => n.id === edge.source);
    const target = visualNodes.find(n => n.id === edge.target);
    
    if (!source || !target) {
      throw new Error(`Invalid edge references: ${edge.id}`);
    }

    // Generate curved path for edge
    const path = `M ${source.x},${source.y} Q ${(source.x + target.x) / 2 + 50},${
      (source.y + target.y) / 2
    } ${target.x},${target.y}`;

    return {
      ...edge,
      path,
      color: colorScheme.edges[edge.type],
      opacity: 0.6 + (edge.weight || 0) * 0.4
    };
  });

  // Calculate visualization bounds
  const bounds = {
    width,
    height
  };

  return {
    nodes: visualNodes,
    edges: visualEdges,
    metadata: {
      bounds,
      scale: 1
    }
  };
}, (nodes, edges, width, height, options) => {
  // Memoization key generator
  return `${nodes.length}-${edges.length}-${width}-${height}-${JSON.stringify(options)}`;
});

/**
 * Normalizes event data with enhanced validation and platform-specific handling
 */
export const normalizeEventData = (
  event: any,
  options: NormalizationOptions = {}
): Record<string, any> => {
  const {
    platform = 'LUMA',
    timezone = 'UTC',
    validateFields = true,
    sanitize = true
  } = options;

  // Platform-specific field mappings
  const fieldMappings = {
    LUMA: {
      id: 'id',
      title: 'title',
      description: 'description',
      startDate: 'start_date',
      endDate: 'end_date'
    },
    EVENTBRITE: {
      id: 'event_id',
      title: 'name.text',
      description: 'description.text',
      startDate: 'start.utc',
      endDate: 'end.utc'
    },
    PARTIFUL: {
      id: 'eventId',
      title: 'eventName',
      description: 'eventDescription',
      startDate: 'startTime',
      endDate: 'endTime'
    }
  };

  const mapping = fieldMappings[platform];

  // Extract and normalize fields
  const normalized = {
    id: String(event[mapping.id]),
    title: sanitize ? sanitizeText(event[mapping.title]) : event[mapping.title],
    description: sanitize ? sanitizeText(event[mapping.description]) : event[mapping.description],
    startDate: normalizeDate(event[mapping.startDate], timezone),
    endDate: normalizeDate(event[mapping.endDate], timezone),
    platform,
    metadata: {
      rawId: event[mapping.id],
      importedAt: new Date().toISOString(),
      platformSpecific: extractPlatformMetadata(event, platform)
    }
  };

  // Validate required fields
  if (validateFields) {
    const validationErrors = validateEventData(normalized);
    if (validationErrors.length > 0) {
      throw new Error(`Event validation failed: ${validationErrors.join(', ')}`);
    }
  }

  return normalized;
};

/**
 * Sanitizes text content by removing potentially harmful content
 */
const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s-.,!?()]/g, '') // Remove special characters
    .trim();
};

/**
 * Normalizes date strings to ISO format with timezone support
 */
const normalizeDate = (date: string | number, timezone: string): string => {
  try {
    const parsed = new Date(date);
    return parsed.toLocaleString('en-US', { timeZone: timezone });
  } catch (error) {
    throw new Error(`Invalid date format: ${date}`);
  }
};

/**
 * Extracts platform-specific metadata fields
 */
const extractPlatformMetadata = (event: any, platform: string): Record<string, any> => {
  switch (platform) {
    case 'LUMA':
      return {
        venueId: event.venue_id,
        categoryId: event.category_id
      };
    case 'EVENTBRITE':
      return {
        organizerId: event.organizer_id,
        categoryId: event.category_id,
        formatId: event.format_id
      };
    case 'PARTIFUL':
      return {
        hostId: event.hostId,
        visibility: event.visibility
      };
    default:
      return {};
  }
};

/**
 * Validates normalized event data structure
 */
const validateEventData = (event: Record<string, any>): string[] => {
  const errors: string[] = [];

  if (!event.id) errors.push('Missing event ID');
  if (!event.title) errors.push('Missing event title');
  if (!event.startDate) errors.push('Missing start date');
  if (!event.endDate) errors.push('Missing end date');

  // Validate date order
  if (new Date(event.startDate) > new Date(event.endDate)) {
    errors.push('Start date must be before end date');
  }

  return errors;
};