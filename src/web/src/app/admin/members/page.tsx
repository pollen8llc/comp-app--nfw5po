'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

import { MemberList } from '../../../components/members/MemberList';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { useToast } from '../../../hooks/useToast';
import type { Member, MemberFilterParams } from '../../../types/members';

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

/**
 * Admin members page component with comprehensive member management capabilities
 * Implements RBAC, accessibility features, and Material Design principles
 */
const MembersPage: React.FC = () => {
  // Authentication and authorization
  const { user, validateUserRole } = useAuth();
  const { showToast } = useToast();

  // Member management state
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filters, setFilters] = useState<MemberFilterParams>({});

  // Initialize member management hooks with optimistic updates
  const {
    members,
    isLoading,
    error,
    createMember,
    updateMember,
    deleteMember,
    bulkUpdateMembers,
    bulkDeleteMembers,
    isCreating,
    isUpdating,
    isDeleting,
    isBulkUpdating,
    isBulkDeleting,
  } = useMembers(filters, {
    enabled: !!user && validateUserRole('ADMIN'),
  });

  // Verify admin access
  useEffect(() => {
    if (user && !validateUserRole('ADMIN')) {
      showToast({
        type: 'error',
        message: 'Access denied. Admin privileges required.',
      });
      window.location.href = '/'; // Redirect to home
    }
  }, [user, validateUserRole, showToast]);

  // Member selection handler
  const handleMemberSelect = useCallback((memberId: string) => {
    setSelectedMembers(prev => {
      const isSelected = prev.includes(memberId);
      return isSelected
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId];
    });
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((newFilters: MemberFilterParams) => {
    setFilters(newFilters);
  }, []);

  // Bulk action handler
  const handleBulkAction = useCallback(async (action: 'delete' | 'update', data?: Partial<Member>) => {
    if (selectedMembers.length === 0) {
      showToast({
        type: 'error',
        message: 'Please select members to perform this action',
      });
      return;
    }

    try {
      if (action === 'delete') {
        await bulkDeleteMembers(selectedMembers);
        showToast({
          type: 'success',
          message: `Successfully deleted ${selectedMembers.length} members`,
        });
      } else if (action === 'update' && data) {
        await bulkUpdateMembers({ ids: selectedMembers, data });
        showToast({
          type: 'success',
          message: `Successfully updated ${selectedMembers.length} members`,
        });
      }
      setSelectedMembers([]);
    } catch (error) {
      showToast({
        type: 'error',
        message: `Failed to ${action} members`,
        description: error.message,
      });
    }
  }, [selectedMembers, bulkDeleteMembers, bulkUpdateMembers, showToast]);

  // Create member handler
  const handleCreateMember = useCallback(async (data: Omit<Member, 'id'>) => {
    try {
      await createMember(data);
      showToast({
        type: 'success',
        message: 'Member created successfully',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to create member',
        description: error.message,
      });
    }
  }, [createMember, showToast]);

  return (
    <ErrorBoundary>
      <motion.div
        className="p-6 space-y-6"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3 }}
      >
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Member Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage community members and their roles
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            {selectedMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={isBulkDeleting}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium text-white rounded-md',
                    'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  aria-label="Delete selected members"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => handleBulkAction('update', { role: 'MEMBER' })}
                  disabled={isBulkUpdating}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium text-white rounded-md',
                    'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  aria-label="Update selected members"
                >
                  Update Selected
                </button>
              </div>
            )}

            <button
              onClick={() => handleCreateMember({
                profile: {
                  name: '',
                  email: '',
                  role: 'MEMBER',
                },
                socialProfiles: [],
              })}
              disabled={isCreating}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-white rounded-md',
                'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Create new member"
            >
              Create Member
            </button>
          </div>
        </div>

        {/* Member List */}
        <MemberList
          members={members}
          onMemberSelect={handleMemberSelect}
          selectedMemberIds={selectedMembers}
          loading={isLoading}
          error={error}
          initialFilters={filters}
          onFilterChange={handleFilterChange}
          className="min-h-[600px]"
        />
      </motion.div>
    </ErrorBoundary>
  );
};

export default MembersPage;