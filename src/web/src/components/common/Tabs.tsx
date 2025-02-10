import React, { useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { motion, AnimatePresence, useAnimation } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Button } from './Button';

// Type-safe orientation options
export const TAB_ORIENTATIONS = ['horizontal', 'vertical'] as const;
type TabOrientation = typeof TAB_ORIENTATIONS[number];

// Tab item interface
interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: string;
}

interface TabsProps {
  /** Array of tab items to display */
  items: TabItem[];
  /** Currently active tab ID */
  activeTab: string;
  /** Tab orientation (horizontal/vertical) */
  orientation?: TabOrientation;
  /** Custom class name */
  className?: string;
  /** Callback when active tab changes */
  onChange: (tabId: string) => void;
  /** Disable all tabs */
  disabled?: boolean;
}

/**
 * Generates class names for tab container and items based on orientation
 */
const getTabClasses = (orientation: TabOrientation, className?: string) => {
  const baseClasses = {
    container: clsx(
      'relative',
      {
        'flex flex-row': orientation === 'horizontal',
        'flex flex-col': orientation === 'vertical'
      },
      className
    ),
    list: clsx(
      'flex gap-1 relative',
      {
        'flex-row border-b border-gray-200': orientation === 'horizontal',
        'flex-col border-r border-gray-200': orientation === 'vertical'
      }
    ),
    indicator: clsx(
      'absolute bg-primary-600 transition-all duration-200',
      {
        'bottom-0 h-0.5': orientation === 'horizontal',
        'right-0 w-0.5': orientation === 'vertical'
      }
    )
  };

  return baseClasses;
};

/**
 * Tabs component that implements Material Design 3.0 principles
 * with WCAG 2.1 Level AA accessibility compliance
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  orientation = 'horizontal',
  className,
  onChange,
  disabled = false
}) => {
  const tabListRef = useRef<HTMLDivElement>(null);
  const indicatorControls = useAnimation();
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Update indicator position when active tab changes
  const updateIndicatorPosition = useCallback(() => {
    if (!activeTabRef.current || !tabListRef.current) return;

    const tabRect = activeTabRef.current.getBoundingClientRect();
    const listRect = tabListRef.current.getBoundingClientRect();

    if (orientation === 'horizontal') {
      indicatorControls.start({
        left: tabRect.left - listRect.left,
        width: tabRect.width,
        opacity: 1
      });
    } else {
      indicatorControls.start({
        top: tabRect.top - listRect.top,
        height: tabRect.height,
        opacity: 1
      });
    }
  }, [orientation, indicatorControls]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    const currentIndex = items.findIndex(item => item.id === activeTab);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = currentIndex - 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    // Ensure index is within bounds and tab is not disabled
    newIndex = Math.max(0, Math.min(newIndex, items.length - 1));
    while (newIndex !== currentIndex && items[newIndex].disabled) {
      newIndex = newIndex > currentIndex ? newIndex + 1 : newIndex - 1;
      if (newIndex < 0 || newIndex >= items.length) return;
    }

    if (newIndex !== currentIndex && !items[newIndex].disabled) {
      event.preventDefault();
      onChange(items[newIndex].id);
    }
  }, [items, activeTab, onChange, disabled]);

  // Update indicator position on mount and when active tab changes
  useEffect(() => {
    updateIndicatorPosition();
    const resizeObserver = new ResizeObserver(updateIndicatorPosition);
    if (tabListRef.current) {
      resizeObserver.observe(tabListRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [activeTab, updateIndicatorPosition]);

  const classes = getTabClasses(orientation, className);

  return (
    <div
      className={classes.container}
      role="tablist"
      aria-orientation={orientation}
    >
      <div ref={tabListRef} className={classes.list}>
        {items.map((tab) => (
          <Button
            key={tab.id}
            ref={tab.id === activeTab ? activeTabRef : undefined}
            variant="ghost"
            className={clsx(
              'relative px-4 py-2 rounded-none',
              tab.id === activeTab && 'text-primary-600',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !disabled && !tab.disabled && onChange(tab.id)}
            disabled={disabled || tab.disabled}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === activeTab ? 0 : -1}
            startIcon={tab.icon}
            onKeyDown={handleKeyDown}
          >
            {tab.label}
          </Button>
        ))}
        <AnimatePresence>
          <motion.div
            className={classes.indicator}
            initial={{ opacity: 0 }}
            animate={indicatorControls}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

// Type exports for consuming components
export type { TabsProps, TabItem, TabOrientation };