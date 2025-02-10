'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { AuditLogger } from '@company/audit-logger'; // v1.0.0

import { ProfileSection } from '../../../components/members/ProfileSection';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';

// Animation variants for profile page transitions
const pageAnimations = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

// Initialize audit logger for security monitoring
const auditLogger = new AuditLogger({
  service: 'member-profile',
  version: '1.0.0',
});

// Error boundary fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <motion.div
    initial={pageAnimations.initial}
    animate={pageAnimations.animate}
    exit={pageAnimations.exit}
    className="error-container"
    role="alert"
  >
    <h2>Profile Error</h2>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </motion.div>
);

/**
 * Member Profile Page Component
 * Implements secure profile management with comprehensive validation and monitoring
 */
const MemberProfilePage: React.FC = () => {
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Hooks
  const { user, isAuthenticated, validateUserRole } = useAuth();
  const { updateMember } = useMembers();
  const { showToast } = useToast();

  // Security check on mount
  useEffect(() => {
    const validateAccess = async () => {
      if (!isAuthenticated) {
        showToast({
          type: 'error',
          message: 'Authentication required',
          role: 'alert'
        });
        return;
      }

      const hasAccess = await validateUserRole('MEMBER');
      if (!hasAccess) {
        showToast({
          type: 'error',
          message: 'Insufficient permissions',
          role: 'alert'
        });
      }

      setIsLoading(false);
    };

    validateAccess();
  }, [isAuthenticated, validateUserRole, showToast]);

  // Profile update handler with security logging
  const handleProfileUpdate = useCallback(async (data) => {
    try {
      // Log update attempt
      auditLogger.log({
        action: 'PROFILE_UPDATE_ATTEMPT',
        userId: user?.id,
        metadata: {
          fields: Object.keys(data)
        }
      });

      // Validate user permissions
      if (!await validateUserRole('MEMBER')) {
        throw new Error('Insufficient permissions for profile update');
      }

      // Update profile with optimistic update handling
      await updateMember({
        id: user?.id,
        data: {
          profile: {
            ...data,
            updatedAt: new Date().toISOString()
          }
        }
      });

      // Log successful update
      auditLogger.log({
        action: 'PROFILE_UPDATE_SUCCESS',
        userId: user?.id,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

      showToast({
        type: 'success',
        message: 'Profile updated successfully',
        role: 'status'
      });

      setIsEditing(false);
    } catch (error) {
      // Log update failure
      auditLogger.log({
        action: 'PROFILE_UPDATE_FAILURE',
        userId: user?.id,
        metadata: {
          error: error.message
        }
      });

      showToast({
        type: 'error',
        message: 'Failed to update profile',
        description: error.message,
        role: 'alert'
      });
    }
  }, [user, updateMember, validateUserRole, showToast]);

  // Loading state handler
  if (isLoading) {
    return (
      <motion.div
        initial={pageAnimations.initial}
        animate={pageAnimations.animate}
        className="loading-container"
      >
        <div className="loading-skeleton" aria-label="Loading profile" />
      </motion.div>
    );
  }

  // Render secure profile page
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => setIsEditing(false)}
      onError={(error) => {
        auditLogger.log({
          action: 'PROFILE_ERROR',
          userId: user?.id,
          metadata: {
            error: error.message
          }
        });
      }}
    >
      <motion.main
        initial={pageAnimations.initial}
        animate={pageAnimations.animate}
        exit={pageAnimations.exit}
        className="profile-page"
      >
        <header className="profile-header">
          <h1>Profile Management</h1>
          {!isEditing && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEditing(true)}
              className="edit-button"
              aria-label="Edit profile"
            >
              Edit Profile
            </motion.button>
          )}
        </header>

        <ProfileSection
          member={user}
          isEditing={isEditing}
          onEditComplete={async (data) => {
            if (data) {
              await handleProfileUpdate(data);
            }
            setIsEditing(false);
          }}
        />
      </motion.main>
    </ErrorBoundary>
  );
};

export default MemberProfilePage;