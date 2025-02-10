import React, { useState, useCallback, useRef, useEffect } from 'react'; // v18.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { useAccessibility } from '@accessibility/react-hooks'; // v1.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

import { MemberCard } from './MemberCard';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import type { Member, MemberFilterParams, MemberRole } from '../../types/members';

// View mode configuration
type ViewMode = 'grid' | 'list';

// Sort parameters configuration
interface SortParams {
  field: keyof Member | keyof Member['profile'];
  direction: 'asc' | 'desc';
}

interface MemberListProps {
  members: Member[];
  onMemberSelect?: (memberId: string) => void;
  selectedMemberIds?: string[];
  loading?: boolean;
  error?: Error | null;
  viewMode?: ViewMode;
  initialFilters?: MemberFilterParams;
  onFilterChange?: (filters: MemberFilterParams) => void;
  onSortChange?: (sort: SortParams) => void;
  className?: string;
}

// Animation variants for list items
const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: 'easeOut'
    }
  }),
  exit: { opacity: 0, y: -20 }
};

export const MemberList: React.FC<MemberListProps> = ({
  members,
  onMemberSelect,
  selectedMemberIds = [],
  loading = false,
  error = null,
  viewMode = 'grid',
  initialFilters = {},
  onFilterChange,
  onSortChange,
  className
}) => {
  // State management
  const [filters, setFilters] = useState<MemberFilterParams>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [sort, setSort] = useState<SortParams>({ field: 'profile.name', direction: 'asc' });
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewMode);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Accessibility hooks
  const { announce } = useAccessibility();

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: members.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => currentViewMode === 'grid' ? 280 : 80,
    overscan: 5
  });

  // Filter handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setSearchTerm(value);
  }, []);

  const handleRoleFilter = useCallback((role: MemberRole | null) => {
    const newFilters = { ...filters, role: role || undefined };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
    announce(`Filtered by role: ${role || 'All'}`);
  }, [filters, onFilterChange, announce]);

  // Sort handlers
  const handleSort = useCallback((field: SortParams['field']) => {
    const newSort = {
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    };
    setSort(newSort);
    onSortChange?.(newSort);
    announce(`Sorted by ${field} ${newSort.direction}ending`);
  }, [sort, onSortChange, announce]);

  // View mode toggle
  const toggleViewMode = useCallback(() => {
    const newMode = currentViewMode === 'grid' ? 'list' : 'grid';
    setCurrentViewMode(newMode);
    announce(`View mode changed to ${newMode}`);
  }, [currentViewMode, announce]);

  // Selection handler
  const handleMemberSelect = useCallback((memberId: string) => {
    onMemberSelect?.(memberId);
    announce(`Member ${selectedMemberIds.includes(memberId) ? 'deselected' : 'selected'}`);
  }, [onMemberSelect, selectedMemberIds, announce]);

  // Effect for search filter
  useEffect(() => {
    if (onFilterChange) {
      const newFilters = { ...filters, search: debouncedSearch };
      onFilterChange(newFilters);
    }
  }, [debouncedSearch, filters, onFilterChange]);

  // Render loading state
  if (loading) {
    return (
      <div className={clsx('w-full', className)}>
        <EmptyState
          title="Loading members..."
          iconName="settings"
          variant="default"
          loading={true}
          theme="light"
        />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <ErrorBoundary>
        <EmptyState
          title="Error loading members"
          description={error.message}
          iconName="close"
          variant="default"
          theme="light"
          actionLabel="Try Again"
          onAction={() => window.location.reload()}
        />
      </ErrorBoundary>
    );
  }

  // Render empty state
  if (members.length === 0) {
    return (
      <EmptyState
        title="No members found"
        description={searchTerm ? "Try adjusting your search or filters" : "Add members to get started"}
        iconName="user"
        variant="default"
        theme="light"
      />
    );
  }

  return (
    <div className={clsx('w-full space-y-4', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-lg shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size="sm"
            ariaLabel="Search"
          />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search members..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Search members"
          />
        </div>

        {/* View mode toggle */}
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleViewMode}
          startIcon={currentViewMode === 'grid' ? 'menu' : 'graph'}
          ariaLabel={`Switch to ${currentViewMode === 'grid' ? 'list' : 'grid'} view`}
        >
          {currentViewMode === 'grid' ? 'List' : 'Grid'}
        </Button>
      </div>

      {/* Member list */}
      <div
        ref={containerRef}
        className={clsx(
          'relative w-full overflow-auto bg-white rounded-lg shadow-sm',
          'min-h-[400px] max-h-[800px]'
        )}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          <AnimatePresence>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const member = members[virtualRow.index];
              return (
                <motion.div
                  key={member.id}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  custom={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={clsx(
                    'p-4',
                    currentViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : ''
                  )}
                >
                  <MemberCard
                    member={member}
                    onClick={() => handleMemberSelect(member.id)}
                    selected={selectedMemberIds.includes(member.id)}
                    className={clsx(
                      'transition-all duration-200',
                      currentViewMode === 'list' ? 'max-w-none' : 'max-w-sm'
                    )}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

MemberList.displayName = 'MemberList';

export type { MemberListProps, ViewMode, SortParams };