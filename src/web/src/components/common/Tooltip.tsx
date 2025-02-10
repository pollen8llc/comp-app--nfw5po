import React, { useState, useCallback, useEffect, useRef, memo } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

// Type definitions
export const TOOLTIP_POSITIONS = ['top', 'right', 'bottom', 'left'] as const;
export type TooltipPosition = typeof TOOLTIP_POSITIONS[number];

const TOOLTIP_DELAYS = {
  show: 200,
  hide: 100,
};

const TOOLTIP_ANIMATIONS = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.15 },
};

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: TooltipPosition;
  className?: string;
  disabled?: boolean;
  showDelay?: number;
  hideDelay?: number;
  id?: string;
}

interface PositionStyles {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  transformOrigin: string;
}

// Utility function to calculate tooltip position
const getTooltipPosition = (
  position: TooltipPosition,
  triggerRect: DOMRect,
  tooltipRect: DOMRect
): PositionStyles => {
  const spacing = 8; // Material Design spacing unit
  const styles: PositionStyles = { transformOrigin: 'center' };

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  switch (position) {
    case 'top':
      styles.bottom = window.innerHeight - triggerRect.top + spacing;
      styles.left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      styles.transformOrigin = 'bottom center';
      break;
    case 'bottom':
      styles.top = triggerRect.bottom + spacing;
      styles.left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      styles.transformOrigin = 'top center';
      break;
    case 'left':
      styles.right = viewportWidth - triggerRect.left + spacing;
      styles.top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      styles.transformOrigin = 'right center';
      break;
    case 'right':
      styles.left = triggerRect.right + spacing;
      styles.top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      styles.transformOrigin = 'left center';
      break;
  }

  // Viewport boundary checks and adjustments
  if (styles.left !== undefined) {
    if (styles.left < spacing) {
      styles.left = spacing;
    } else if (styles.left + tooltipRect.width > viewportWidth - spacing) {
      styles.left = viewportWidth - tooltipRect.width - spacing;
    }
  }

  if (styles.top !== undefined) {
    if (styles.top < spacing) {
      styles.top = spacing;
    } else if (styles.top + tooltipRect.height > viewportHeight - spacing) {
      styles.top = viewportHeight - tooltipRect.height - spacing;
    }
  }

  return styles;
};

// Custom hook for tooltip positioning
const useTooltipPosition = (
  position: TooltipPosition,
  triggerRef: React.RefObject<HTMLDivElement>,
  tooltipRef: React.RefObject<HTMLDivElement>
) => {
  const [styles, setStyles] = useState<PositionStyles>({ transformOrigin: 'center' });

  useEffect(() => {
    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const newStyles = getTooltipPosition(position, triggerRect, tooltipRect);
      setStyles(newStyles);
    };

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePosition, 100);
    };

    // Position observer
    const observer = new ResizeObserver(updatePosition);
    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    window.addEventListener('resize', handleResize);
    updatePosition();

    return () => {
      if (triggerRef.current) {
        observer.unobserve(triggerRef.current);
      }
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [position, triggerRef, tooltipRef]);

  return styles;
};

export const Tooltip = memo(({
  children,
  content,
  position = 'top',
  className,
  disabled = false,
  showDelay = TOOLTIP_DELAYS.show,
  hideDelay = TOOLTIP_DELAYS.hide,
  id,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const styles = useTooltipPosition(position, triggerRef, tooltipRef);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => setIsVisible(true), showDelay);
  }, [disabled, showDelay]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), hideDelay);
  }, [hideDelay]);

  const handleKeyboard = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible) {
      setIsVisible(false);
    }
  }, [isVisible]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, [handleKeyboard]);

  return (
    <div
      ref={triggerRef}
      className={clsx('relative inline-block', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      aria-describedby={id}
    >
      {children}
      <AnimatePresence>
        {isVisible && content && (
          <motion.div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className={clsx(
              'absolute z-50 px-2 py-1 text-sm text-white',
              'bg-gray-900 rounded shadow-lg max-w-xs',
              'pointer-events-none select-none'
            )}
            style={styles}
            {...TOOLTIP_ANIMATIONS}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

Tooltip.displayName = 'Tooltip';