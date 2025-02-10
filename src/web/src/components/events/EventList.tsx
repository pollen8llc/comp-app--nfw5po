import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import clsx from 'clsx'; // v2.0.0
import { EventCard } from './EventCard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useEvents } from '../../hooks/useEvents';
import { Event } from '../../types/events';

// Animation variants for list items
const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.05,
      duration: 0.3,
      ease: 'easeOut'
    }
  }),
  exit: { opacity: 0, scale: 0.95 }
};

// Grid layout configurations
const GRID_LAYOUTS = {
  compact: {
    cols: {
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4
    },
    gap: 'gap-4'
  },
  comfortable: {
    cols: {
      sm: 1,
      md: 2,
      lg: 2,
      xl: 3
    },
    gap: 'gap-6'
  }
} as const;

interface EventListProps {
  /** Custom class name for the container */
  className?: string;
  /** Callback when an event is selected */
  onEventSelect?: (event: Event) => void;
  /** Array of selected event IDs */
  selectedEventIds?: string[];
  /** Number of items to display per page */
  itemsPerPage?: number;
  /** Grid layout configuration */
  gridLayout?: keyof typeof GRID_LAYOUTS;
}

export const EventList: React.FC<EventListProps> = ({
  className,
  onEventSelect,
  selectedEventIds = [],
  itemsPerPage = 20,
  gridLayout = 'comfortable'
}) => {
  // Fetch events data using the useEvents hook
  const { events, isLoading, error } = useEvents();

  // Create container ref for virtualization
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Calculate responsive column count based on viewport
  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return GRID_LAYOUTS[gridLayout].cols.sm;
    const width = window.innerWidth;
    if (width >= 1280) return GRID_LAYOUTS[gridLayout].cols.xl;
    if (width >= 1024) return GRID_LAYOUTS[gridLayout].cols.lg;
    if (width >= 768) return GRID_LAYOUTS[gridLayout].cols.md;
    return GRID_LAYOUTS[gridLayout].cols.sm;
  }, [gridLayout]);

  // Set up virtualized grid
  const virtualizer = useVirtualizer({
    count: Math.ceil(events.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // Estimated row height
    overscan: 5
  });

  // Handle event selection
  const handleEventSelect = useCallback((event: Event) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  }, [onEventSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    if (!events.length) return;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        if (index < events.length - 1) {
          handleEventSelect(events[index + 1]);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (index > 0) {
          handleEventSelect(events[index - 1]);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index >= columnCount) {
          handleEventSelect(events[index - columnCount]);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (index < events.length - columnCount) {
          handleEventSelect(events[index + columnCount]);
        }
        break;
    }
  }, [events, columnCount, handleEventSelect]);

  // Render loading state
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="Loading events"
      >
        <LoadingSpinner size="lg" variant="primary" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <EmptyState
        title="Error loading events"
        description={error.message}
        iconName="error"
        variant="default"
      />
    );
  }

  // Render empty state
  if (!events.length) {
    return (
      <EmptyState
        title="No events found"
        description="There are currently no events to display."
        iconName="calendar"
        variant="default"
      />
    );
  }

  return (
    <div
      ref={parentRef}
      className={clsx(
        'relative w-full overflow-auto',
        'min-h-[400px] max-h-[800px]',
        className
      )}
      role="grid"
      aria-label="Event list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        <AnimatePresence>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const rowStart = virtualRow.index * columnCount;
            const rowEvents = events.slice(rowStart, rowStart + columnCount);

            return (
              <motion.div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                className={clsx(
                  'grid',
                  GRID_LAYOUTS[gridLayout].gap,
                  {
                    'grid-cols-1 sm:grid-cols-1': columnCount === 1,
                    'grid-cols-1 sm:grid-cols-2': columnCount === 2,
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3': columnCount === 3,
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4': columnCount === 4
                  }
                )}
                role="row"
              >
                {rowEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    custom={rowStart + index}
                    role="gridcell"
                    onKeyDown={(e) => handleKeyDown(e, rowStart + index)}
                  >
                    <EventCard
                      event={event}
                      onClick={() => handleEventSelect(event)}
                      isSelected={selectedEventIds.includes(event.id)}
                      isInteractive={!!onEventSelect}
                    />
                  </motion.div>
                ))}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Display name for debugging
EventList.displayName = 'EventList';