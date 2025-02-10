'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useA11y } from '@react-aria/interactions';
import { toast } from 'react-hot-toast';

import { MemberForm } from '../../../../components/members/MemberForm';
import { ProfileSection } from '../../../../components/members/ProfileSection';
import { useMembers } from '../../../../hooks/useMembers';
import { ErrorBoundary } from '../../../../components/common/ErrorBoundary';
import { useAuth } from '../../../../hooks/useAuth';
import type { Member, UpdateMemberInput } from '../../../../types/members';

/**
 * Secure member details page component for admin profile management
 * Implements RBAC, PII protection, and accessibility features
 */
const MemberDetailsPage: React.FC = () => {
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Hooks
  const params = useParams();
  const router = useRouter();
  const { validateUserRole } = useAuth();
  const { members, updateMember, deleteMember, isLoading } = useMembers();
  const { pressProps } = useA11y();

  // Get member ID from route params
  const memberId = params.id as string;

  // Find member data
  const member = members.find((m) => m.id === memberId);

  // Verify admin access
  useEffect(() => {
    if (!validateUserRole('ADMIN')) {
      toast.error('Unauthorized access');
      router.push('/admin/members');
    }
  }, [validateUserRole, router]);

  /**
   * Handles secure member profile updates with validation
   */
  const handleMemberUpdate = useCallback(async (data: UpdateMemberInput) => {
    try {
      await updateMember({
        id: memberId,
        data: {
          profile: {
            ...member?.profile,
            ...data.profile,
          },
          socialProfiles: data.socialProfiles,
        },
      });

      toast.success('Member profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update member profile', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  }, [memberId, member, updateMember]);

  /**
   * Handles secure member deletion with confirmation
   */
  const handleMemberDelete = useCallback(async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    try {
      await deleteMember(memberId);
      toast.success('Member deleted successfully');
      router.push('/admin/members');
    } catch (error) {
      toast.error('Failed to delete member', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setConfirmingDelete(false);
    }
  }, [memberId, confirmingDelete, deleteMember, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-32 bg-gray-200 rounded-lg mb-4" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  // Member not found
  if (!member) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Member not found</h1>
        <p className="mt-2 text-gray-600">
          The requested member profile could not be found.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Member Profile
          </h1>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              {...pressProps}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
            <button
              type="button"
              onClick={handleMemberDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              {...pressProps}
            >
              {confirmingDelete ? 'Confirm Delete' : 'Delete Member'}
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-white rounded-lg shadow">
          {isEditing ? (
            <MemberForm
              member={member}
              onSubmit={handleMemberUpdate}
              onCancel={() => setIsEditing(false)}
              isSubmitting={isLoading}
            />
          ) : (
            <ProfileSection
              member={member}
              isEditing={false}
              onEditComplete={() => setIsEditing(false)}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MemberDetailsPage;