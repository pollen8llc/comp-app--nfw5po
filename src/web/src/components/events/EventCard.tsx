import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Card } from '../common/Card';
import { Event, EventPlatform } from '../../types/events';
import { formatEventDate } from '../../utils/date';

// Animation variants following Material Design motion principles
const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  selected: { scale: 1.02, transition: { type: 'spring', stiffness: 400 } }
};

// Platform-specific icons and colors
const platformConfig: Record<EventPlatform, { icon: string; color: string }> = {
  [EventPlatform.LUMA]: { icon: '🎫', color: 'text-blue-600' },
  [EventPlatform.EVENTBRITE]: { icon: '🎪', color: 'text-orange-600' },
  [EventPlatform.PARTIFUL]: { icon: '🎉', color: 'text-purple-600' }
};

interface EventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  isSelected?: boolean;
  isInteractive?: boolean;
  className?: string;
}

export const EventCard = React.memo(({
  event,
  onClick,
  isSelected = false,
  isInteractive = true,
  className
}: EventCardProps) => {
  // Format event date with proper error handling
  const formattedDate = React.useMemo(() => {
    try {
      return formatEventDate(event.start_date, event.end_date);
    } catch (error) {
      console.error('Error formatting event date:', error);
      return 'Date unavailable';
    }
  }, [event.start_date, event.end_date]);

  // Platform-specific styling
  const platformStyle = platformConfig[event.platform];

  // Handle click events with keyboard support
  const handleClick = React.useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    if (!isInteractive || !onClick) return;

    if (e.type === 'keydown') {
      const keyEvent = e as React.KeyboardEvent;
      if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
      e.preventDefault();
    }

    onClick(event);
  }, [event, isInteractive, onClick]);

  // Compute dynamic classes
  const cardClasses = clsx(
    'transition-all duration-200',
    {
      'hover:shadow-md': isInteractive,
      'ring-2 ring-primary': isSelected
    },
    className
  );

  return (
    <Card
      variant="elevated"
      elevation={isSelected ? 2 : 1}
      interactive={isInteractive}
      className={cardClasses}
      onClick={handleClick}
      ariaLabel={`Event: ${event.title}`}
    >
      <motion.div
        initial="initial"
        animate={isSelected ? "selected" : "animate"}
        exit="exit"
        variants={cardVariants}
        className="p-4 space-y-3"
        layout
      >
        {/* Event Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <h3 className="text-lg font-semibold text-primary line-clamp-2" 
                id={`event-title-${event.id}`}>
              {event.title}
            </h3>
            <p className="text-sm text-secondary" 
               aria-label="Event date and time">
              {formattedDate}
            </p>
          </div>
          <span 
            className={clsx('text-2xl', platformStyle.color)}
            aria-label={`Platform: ${event.platform}`}
            role="img"
          >
            {platformStyle.icon}
          </span>
        </div>

        {/* Event Details */}
        {event.description && (
          <p className="text-sm text-secondary line-clamp-2"
             aria-label="Event description">
            {event.description}
          </p>
        )}

        {/* Event Location */}
        <div className="flex items-center text-sm text-secondary"
             aria-label="Event location">
          <span className="mr-1" role="img" aria-hidden="true">
            📍
          </span>
          {event.location}
        </div>

        {/* Event Metadata */}
        <div className="flex flex-wrap gap-2 pt-2">
          {event.metadata.categories.map((category) => (
            <span
              key={category}
              className="px-2 py-1 text-xs rounded-full bg-surface-variant text-on-surface-variant"
              role="status"
            >
              {category}
            </span>
          ))}
        </div>
      </motion.div>
    </Card>
  );
});

// Display name for debugging
EventCard.displayName = 'EventCard';