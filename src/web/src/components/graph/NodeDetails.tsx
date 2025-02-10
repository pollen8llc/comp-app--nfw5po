import React from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { Node, NodeType } from '../../types/graph';
import { Card } from '../common/Card';

interface NodeDetailsProps {
  selectedNode: Node | null;
  onClose?: () => void;
}

// Animation variants following Material Design motion principles
const containerVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: { duration: 0.2 }
  }
};

const propertyVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30
    }
  }
};

/**
 * Returns a human-readable label for node types with proper localization
 */
const getNodeTypeLabel = (type: NodeType): string => {
  const labels: Record<NodeType, string> = {
    [NodeType.MEMBER]: 'Member',
    [NodeType.EVENT]: 'Event',
    [NodeType.SOCIAL_PROFILE]: 'Social Profile',
    [NodeType.METADATA]: 'Metadata'
  };
  return labels[type] || 'Unknown Type';
};

/**
 * Formats property values for display with enhanced accessibility
 */
const formatPropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => formatPropertyValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

/**
 * NodeDetails component displays detailed information about a selected graph node
 * with Material Design styling and accessibility features
 */
export const NodeDetails: React.FC<NodeDetailsProps> = React.memo(({ selectedNode, onClose }) => {
  if (!selectedNode) {
    return null;
  }

  // Filter out internal properties
  const visibleProperties = Object.entries(selectedNode.properties).filter(
    ([key]) => !key.startsWith('_') && !['id', 'type'].includes(key)
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedNode.id}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed right-4 top-4 w-80 z-50"
        role="complementary"
        aria-label={`Details for ${getNodeTypeLabel(selectedNode.type)}`}
      >
        <Card
          variant="elevated"
          elevation={3}
          padding="md"
          className="bg-surface-container-high"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <motion.h2
              className="text-lg font-medium text-on-surface m-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {getNodeTypeLabel(selectedNode.type)}
            </motion.h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Close details panel"
              >
                <svg
                  className="w-5 h-5 text-on-surface-variant"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Properties List */}
          <motion.dl
            className="space-y-2"
            role="list"
            aria-label="Node properties"
          >
            {visibleProperties.map(([key, value]) => (
              <motion.div
                key={key}
                variants={propertyVariants}
                className="flex flex-col"
              >
                <dt className="text-sm font-medium text-on-surface-variant mb-1">
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                </dt>
                <dd 
                  className="text-sm text-on-surface break-words"
                  aria-label={`${key} value`}
                >
                  {formatPropertyValue(value)}
                </dd>
              </motion.div>
            ))}
          </motion.dl>

          {/* Empty State */}
          {visibleProperties.length === 0 && (
            <motion.p
              variants={propertyVariants}
              className="text-sm text-on-surface-variant text-center py-4"
            >
              No properties available
            </motion.p>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

NodeDetails.displayName = 'NodeDetails';

export type { NodeDetailsProps };