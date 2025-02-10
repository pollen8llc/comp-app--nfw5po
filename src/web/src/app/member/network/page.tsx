'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { useTranslation } from 'next-i18next'; // v13.0.0
import { GraphVisualization } from '../../../components/graph/GraphVisualization';
import { useGraph } from '../../../hooks/useGraph';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { Node, NodeType } from '../../../types/graph';
import { Card } from '../../../components/common/Card';

// Animation variants for smooth transitions
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

// Performance configuration for graph rendering
const PERFORMANCE_CONFIG = {
  frameRateLimit: 60,
  qualityThresholds: {
    high: 1000,
    medium: 5000,
    low: 10000
  },
  memoryLimit: 512 * 1024 * 1024, // 512MB
  batchSize: 1000
};

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  keyboardNavigation: true,
  screenReaderLabels: true,
  highContrastMode: false,
  reducedMotion: false
};

const MemberNetworkPage: React.FC = () => {
  const { t } = useTranslation('network');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Initialize graph hook with configuration
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
  } = useGraph({
    dimensions: {
      width: dimensions.width,
      height: dimensions.height,
      margin: 24
    },
    nodes: {
      size: 8,
      color: {
        [NodeType.MEMBER]: '#4299E1',
        [NodeType.EVENT]: '#48BB78',
        [NodeType.SOCIAL_PROFILE]: '#ED8936',
        [NodeType.METADATA]: '#A0AEC0'
      },
      labelSize: 12
    },
    edges: {
      width: 1,
      color: {
        KNOWS: '#E2E8F0',
        ATTENDED: '#CBD5E0',
        HAS_PROFILE: '#A0AEC0',
        HAS_METADATA: '#718096'
      },
      opacity: 0.6
    },
    animation: {
      duration: 300,
      ease: 'easeInOut',
      staggerChildren: 50
    },
    interaction: {
      zoomRange: [0.5, 2],
      dragEnabled: true
    },
    performance: {
      maxNodes: PERFORMANCE_CONFIG.qualityThresholds.high,
      maxEdges: PERFORMANCE_CONFIG.qualityThresholds.high * 2
    }
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 48, // Account for padding
        height: window.innerHeight - 96 // Account for header and padding
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((node: Node) => {
    setSelectedNode(node);
    selectNode(node.id);
  }, [selectNode]);

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: 'force' | 'circular' | 'hierarchical') => {
    updateLayout(layout);
  }, [updateLayout]);

  // Handle viewport changes
  const handleViewportChange = useCallback((zoom: number, pan: { x: number; y: number }) => {
    updateViewport(zoom, pan);
  }, [updateViewport]);

  return (
    <ErrorBoundary>
      <motion.div
        className="relative w-full h-full bg-surface"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Card
          variant="elevated"
          elevation={2}
          className="absolute top-4 left-4 z-10"
        >
          <div className="p-4 space-y-4">
            <h1 className="text-xl font-medium text-on-surface">
              {t('network.title')}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {t('network.description')}
            </p>
          </div>
        </Card>

        <GraphVisualization
          data={graph}
          width={dimensions.width}
          height={dimensions.height}
          onNodeSelect={handleNodeSelect}
          className="w-full h-full"
          renderMode={performance.fps > 30 ? 'webgl' : 'svg'}
          accessibilityMode={accessibility.keyboardNavigation}
          snapToGrid={visualization.layout === 'hierarchical'}
          highContrastMode={accessibility.highContrastMode}
        />

        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 z-10"
            >
              <Card
                variant="elevated"
                elevation={3}
                className="w-80"
              >
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-on-surface">
                      {t('network.nodeDetails')}
                    </h2>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-2 rounded-full hover:bg-surface-variant"
                      aria-label={t('network.closeDetails')}
                    >
                      <span className="sr-only">{t('network.closeDetails')}</span>
                      ×
                    </button>
                  </div>
                  <dl className="space-y-2">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-sm font-medium text-on-surface-variant">
                          {key}
                        </dt>
                        <dd className="text-sm text-on-surface">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ErrorBoundary>
  );
};

export default MemberNetworkPage;