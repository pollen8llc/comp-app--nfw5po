import React, { memo, useCallback } from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

import { Avatar } from '../common/Avatar';
import { Card } from '../common/Card';
import type { Member } from '../../types/members';

// Animation configuration following Material Design principles
const cardAnimationConfig = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30
    }
  },
  exit: { opacity: 0, y: -20 }
};

interface MemberCardProps {
  /** Member data with profile and social information */
  member: Member;
  /** Click handler for card interaction */
  onClick?: (memberId: string) => void;
  /** Selected state for highlighting */
  selected?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility enabled flag */
  isAccessible?: boolean;
}

/**
 * Formats social profiles for display with proper PII handling
 */
const formatSocialProfiles = (member: Member): string => {
  const verifiedProfiles = member.socialProfiles
    .filter(profile => profile.verified)
    .map(profile => profile.platform.charAt(0) + profile.platform.slice(1).toLowerCase())
    .join(', ');
  
  return verifiedProfiles || 'No connected accounts';
};

/**
 * A secure and accessible card component that displays member information
 * following Material Design principles and WCAG 2.1 Level AA guidelines
 */
export const MemberCard = memo(({
  member,
  onClick,
  selected = false,
  className,
  isAccessible = true
}: MemberCardProps) => {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(member.id);
    }
  }, [member.id, onClick]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'Space') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Security check for PII display
  const canDisplayEmail = member.profile.role === 'ADMIN' || member.profile.role === 'MEMBER';
  const displayLocation = member.profile.location || 'Location not specified';
  
  return (
    <Card
      variant="elevated"
      elevation={selected ? 2 : 1}
      padding="md"
      interactive={!!onClick}
      className={clsx(
        'w-full transition-all duration-200',
        {
          'border-2 border-primary': selected,
          'hover:shadow-md': !!onClick
        },
        className
      )}
      onClick={handleClick}
      ariaLabel={`Member card for ${member.profile.name}`}
    >
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={cardAnimationConfig}
        className="flex items-start gap-4"
        data-testid="member-card"
      >
        <Avatar
          src={`/api/members/${member.id}/avatar`}
          name={member.profile.name}
          size="lg"
          animate={true}
          className="flex-shrink-0"
        />

        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between">
            <h3 
              className="text-lg font-semibold text-gray-900 truncate"
              id={`member-name-${member.id}`}
            >
              {member.profile.name}
            </h3>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2 h-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </div>

          {canDisplayEmail && (
            <p 
              className="text-sm text-gray-600 truncate mt-1"
              aria-label={`Email: ${member.profile.email}`}
            >
              {member.profile.email}
            </p>
          )}

          <p 
            className="text-sm text-gray-500 mt-1"
            aria-label={`Location: ${displayLocation}`}
          >
            {displayLocation}
          </p>

          <div className="flex items-center mt-2 text-sm text-gray-500">
            <span 
              className="truncate"
              aria-label={`Connected accounts: ${formatSocialProfiles(member)}`}
            >
              {formatSocialProfiles(member)}
            </span>
          </div>
        </div>
      </motion.div>

      {isAccessible && (
        <div className="sr-only">
          <p>Member role: {member.profile.role}</p>
          <p>Account created: {member.createdAt.toLocaleDateString()}</p>
          <p>Last updated: {member.updatedAt.toLocaleDateString()}</p>
        </div>
      )}
    </Card>
  );
});

MemberCard.displayName = 'MemberCard';

export type { MemberCardProps };