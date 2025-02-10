import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { NodeType, EdgeType } from '../../types/graph';

// Node color mapping with semantic meaning
const NODE_COLORS: Record<NodeType, string> = {
  [NodeType.MEMBER]: '#4F46E5', // Indigo for members
  [NodeType.EVENT]: '#10B981', // Emerald for events
  [NodeType.METADATA]: '#F59E0B', // Amber for metadata
  [NodeType.SOCIAL_PROFILE]: '#EC4899' // Pink for social profiles
};

// Comprehensive node type descriptions
const NODE_DESCRIPTIONS: Record<NodeType, string> = {
  [NodeType.MEMBER]: 'Community members and users with profile information',
  [NodeType.EVENT]: 'Community events, gatherings, and activities',
  [NodeType.METADATA]: 'Additional metadata, tags, and properties',
  [NodeType.SOCIAL_PROFILE]: 'Connected social media profiles and accounts'
};

// Detailed edge type descriptions
const EDGE_DESCRIPTIONS: Record<EdgeType, string> = {
  [EdgeType.KNOWS]: 'Direct connection or relationship between community members',
  [EdgeType.ATTENDED]: "Member's participation or attendance in community events",
  [EdgeType.HAS_METADATA]: 'Associated metadata and properties for nodes',
  [EdgeType.HAS_PROFILE]: 'Connection between member and their social profiles'
};

// Framer Motion animation variants
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  hover: {
    scale: 1.05,
    transition: { duration: 0.2 }
  }
};

// Container animation variants for staggered children
const CONTAINER_VARIANTS = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

interface GraphLegendProps {
  className?: string;
}

const renderNodeLegend = memo(() => {
  return (
    <motion.div
      className="space-y-3"
      variants={CONTAINER_VARIANTS}
      initial="initial"
      animate="animate"
      role="list"
      aria-label="Node type legend"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Node Types
      </h3>
      {Object.values(NodeType).map((nodeType) => (
        <motion.div
          key={nodeType}
          className="flex items-center space-x-3 cursor-pointer"
          variants={ANIMATION_VARIANTS}
          whileHover="hover"
          role="listitem"
          tabIndex={0}
        >
          <motion.div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: NODE_COLORS[nodeType] }}
            whileHover={{ scale: 1.2 }}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {nodeType}
            </span>
            <span 
              className="text-xs text-gray-500 dark:text-gray-400"
              aria-label={NODE_DESCRIPTIONS[nodeType]}
            >
              {NODE_DESCRIPTIONS[nodeType]}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});

const renderEdgeLegend = memo(() => {
  return (
    <motion.div
      className="space-y-3"
      variants={CONTAINER_VARIANTS}
      initial="initial"
      animate="animate"
      role="list"
      aria-label="Edge type legend"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Edge Types
      </h3>
      {Object.values(EdgeType).map((edgeType) => (
        <motion.div
          key={edgeType}
          className="flex items-center space-x-3 cursor-pointer"
          variants={ANIMATION_VARIANTS}
          whileHover="hover"
          role="listitem"
          tabIndex={0}
        >
          <motion.div 
            className="w-8 h-px bg-gray-400 dark:bg-gray-600"
            whileHover={{ scale: 1.1 }}
            style={{
              height: '2px',
              background: edgeType === EdgeType.KNOWS ? 
                'linear-gradient(90deg, #4F46E5 50%, transparent 50%)' : 
                undefined
            }}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {edgeType}
            </span>
            <span 
              className="text-xs text-gray-500 dark:text-gray-400"
              aria-label={EDGE_DESCRIPTIONS[edgeType]}
            >
              {EDGE_DESCRIPTIONS[edgeType]}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});

export const GraphLegend: React.FC<GraphLegendProps> = memo(({ className = '' }) => {
  return (
    <div 
      className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg space-y-6 ${className}`}
      role="complementary"
      aria-label="Graph visualization legend"
    >
      {renderNodeLegend()}
      {renderEdgeLegend()}
    </div>
  );
});

GraphLegend.displayName = 'GraphLegend';
renderNodeLegend.displayName = 'renderNodeLegend';
renderEdgeLegend.displayName = 'renderEdgeLegend';