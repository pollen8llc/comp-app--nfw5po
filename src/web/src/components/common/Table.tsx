import React, { useCallback, useMemo, useState } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

// Type-safe table variants following Material Design 3.0 principles
export const TABLE_VARIANTS = ['default', 'compact', 'bordered', 'striped', 'elevated'] as const;
export const SORT_DIRECTIONS = ['asc', 'desc', 'none'] as const;
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100, 250] as const;

type TableVariant = typeof TABLE_VARIANTS[number];
type SortDirection = typeof SORT_DIRECTIONS[number];
type PageSize = typeof DEFAULT_PAGE_SIZES[number];

// Animation variants for smooth transitions
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.2 }
};

interface Column<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  variant?: TableVariant;
  className?: string;
  loading?: boolean;
  sortable?: boolean;
  pageSize?: PageSize;
  emptyStateProps?: {
    title: string;
    description?: string;
    iconName?: 'search' | 'filter';
  };
  onSort?: (columnId: string, direction: SortDirection) => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
}

/**
 * Generates semantic class names for table styling
 */
const getTableClasses = (
  variant: TableVariant,
  className?: string,
  isDarkMode = false
): string => {
  return clsx(
    // Base styles with accessibility focus
    'w-full border-collapse overflow-hidden',
    'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500',
    // Variant-specific styles
    {
      'shadow-sm rounded-lg': variant === 'elevated',
      'border border-gray-200 dark:border-gray-700': variant === 'bordered',
      'divide-y divide-gray-200 dark:divide-gray-700': variant === 'default',
      '[&_tr:nth-child(even)]:bg-gray-50 dark:[&_tr:nth-child(even)]:bg-gray-800': variant === 'striped',
      'text-sm': variant === 'compact',
    },
    // Theme-specific styles
    {
      'bg-white text-gray-900': !isDarkMode,
      'bg-gray-900 text-gray-100': isDarkMode,
    },
    className
  );
};

/**
 * Table component that follows Material Design 3.0 principles
 * and WCAG 2.1 Level AA accessibility guidelines
 */
export function Table<T extends Record<string, any>>({
  data,
  columns,
  variant = 'default',
  className,
  loading = false,
  sortable = true,
  pageSize = 25,
  emptyStateProps = {
    title: 'No data available',
    description: 'Try adjusting your filters or search criteria',
    iconName: 'search'
  },
  onSort,
  onPageChange,
  onRowClick
}: TableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('none');

  // Calculate pagination values
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = data.slice(startIndex, endIndex);

  // Handle column header click for sorting
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;

    const newDirection: SortDirection = 
      sortColumn === columnId
        ? sortDirection === 'asc'
          ? 'desc'
          : sortDirection === 'desc'
            ? 'none'
            : 'asc'
        : 'asc';

    setSortColumn(columnId);
    setSortDirection(newDirection);
    onSort?.(columnId, newDirection);
  }, [sortable, sortColumn, sortDirection, onSort]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [onPageChange]);

  // Memoized table header rendering
  const renderHeader = useMemo(() => (
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>
        {columns.map((column) => (
          <th
            key={column.id}
            className={clsx(
              'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider',
              column.align === 'center' && 'text-center',
              column.align === 'right' && 'text-right',
              sortable && column.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
            style={{ width: column.width }}
            onClick={() => column.sortable && handleSort(column.id)}
            role={column.sortable ? 'button' : undefined}
            tabIndex={column.sortable ? 0 : undefined}
            aria-sort={sortColumn === column.id ? sortDirection : undefined}
          >
            <div className="flex items-center gap-2">
              {column.header}
              {sortable && column.sortable && sortColumn === column.id && (
                <motion.span
                  initial={{ rotate: 0 }}
                  animate={{ rotate: sortDirection === 'desc' ? 180 : 0 }}
                >
                  ↑
                </motion.span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  ), [columns, sortable, sortColumn, sortDirection, handleSort]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Render empty state
  if (!data.length) {
    return (
      <EmptyState
        variant="default"
        {...emptyStateProps}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={getTableClasses(variant, className)}
        role="grid"
        aria-busy={loading}
        aria-colcount={columns.length}
        aria-rowcount={data.length}
      >
        {renderHeader}
        
        <AnimatePresence mode="wait">
          <motion.tbody
            initial="initial"
            animate="animate"
            exit="exit"
            variants={ANIMATION_VARIANTS}
          >
            {currentData.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                className={clsx(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
                onClick={() => onRowClick?.(row)}
                variants={ANIMATION_VARIANTS}
                role="row"
                aria-rowindex={rowIndex + 1}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={clsx(
                      'px-6 py-4 whitespace-nowrap',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                    role="gridcell"
                  >
                    {typeof column.accessor === 'function'
                      ? column.accessor(row)
                      : row[column.accessor]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </motion.tbody>
        </AnimatePresence>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <select
              className="form-select text-sm"
              value={pageSize}
              onChange={(e) => onPageChange?.(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {DEFAULT_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              ariaLabel="Previous page"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              ariaLabel="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Type exports for consuming components
export type { TableProps, Column, TableVariant, SortDirection };