import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { useGraph } from '../../hooks/useGraph';

// Layout options for graph visualization
const LAYOUT_OPTIONS = [
  {
    value: 'force',
    label: 'Force-Directed',
    description: 'Natural network layout using force simulation'
  },
  {
    value: 'circular',
    label: 'Circular',
    description: 'Nodes arranged in a circular pattern'
  },
  {
    value: 'hierarchical',
    label: 'Tree-like structure showing relationships'
  }
] as const;

// Animation configuration for smooth transitions
const ANIMATION_CONFIG = {
  duration: 0.3,
  ease: 'easeInOut'
};

interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onFit: () => void;
  onLayoutChange: (layout: 'force' | 'circular' | 'hierarchical') => void;
  className?: string;
  disabled?: boolean;
  initialLayout?: 'force' | 'circular' | 'hierarchical';
  dir?: 'ltr' | 'rtl';
  theme?: {
    primary: string;
    background: string;
    text: string;
  };
}

/**
 * GraphControls component providing accessible, animated controls for graph visualization
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
export const GraphControls: React.FC<GraphControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenter,
  onFit,
  onLayoutChange,
  className,
  disabled = false,
  initialLayout = 'force',
  dir = 'ltr',
  theme = {
    primary: '#1976d2',
    background: '#ffffff',
    text: '#000000'
  }
}) => {
  const [currentLayout, setCurrentLayout] = useState(initialLayout);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle layout changes with animation
  const handleLayoutChange = useCallback(async (layout: typeof currentLayout) => {
    if (disabled || isAnimating || layout === currentLayout) return;

    try {
      setIsAnimating(true);
      setCurrentLayout(layout);
      await onLayoutChange(layout);
    } catch (error) {
      console.error('Error changing layout:', error);
    } finally {
      setIsAnimating(false);
    }
  }, [currentLayout, disabled, isAnimating, onLayoutChange]);

  // Container motion variants
  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  };

  // Button group motion variants
  const buttonGroupVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <motion.div
      className={`graph-controls ${className || ''}`}
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={ANIMATION_CONFIG}
      style={{
        display: 'flex',
        flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
        gap: '16px',
        padding: '16px',
        background: theme.background,
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      role="toolbar"
      aria-label="Graph visualization controls"
    >
      {/* Zoom Controls Group */}
      <motion.div
        variants={buttonGroupVariants}
        className="zoom-controls"
        role="group"
        aria-label="Zoom controls"
      >
        <Button
          variant="secondary"
          size="md"
          onClick={onZoomIn}
          disabled={disabled}
          startIcon="add"
          ariaLabel="Zoom in"
        >
          Zoom In
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={onZoomOut}
          disabled={disabled}
          startIcon="remove"
          ariaLabel="Zoom out"
        >
          Zoom Out
        </Button>
      </motion.div>

      {/* View Controls Group */}
      <motion.div
        variants={buttonGroupVariants}
        className="view-controls"
        role="group"
        aria-label="View controls"
      >
        <Button
          variant="secondary"
          size="md"
          onClick={onCenter}
          disabled={disabled}
          startIcon="center"
          ariaLabel="Center view"
        >
          Center
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={onFit}
          disabled={disabled}
          startIcon="fit"
          ariaLabel="Fit to screen"
        >
          Fit
        </Button>
      </motion.div>

      {/* Layout Selection */}
      <Select
        options={LAYOUT_OPTIONS.map(option => ({
          value: option.value,
          label: option.label,
          ariaLabel: option.description
        }))}
        value={currentLayout}
        onChange={(value) => handleLayoutChange(value as typeof currentLayout)}
        disabled={disabled || isAnimating}
        ariaLabel="Select graph layout"
        placeholder="Select Layout"
        className="layout-select"
      />
    </motion.div>
  );
};

// Type exports
export type { GraphControlsProps };