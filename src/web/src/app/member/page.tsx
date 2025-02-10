'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { redirect } from 'next/navigation'; // v13.0.0
import { Skeleton } from '@mui/material'; // v5.0.0

// Internal imports
import MemberLayout from '../../components/layout/MemberLayout';
import { ProfileSection } from '../../components/members/ProfileSection';
import { useMembers } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

// Animation variants for page transitions
const pageAnimations = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.2
    }
  }
};

/**
 * Member dashboard page component with enhanced security, accessibility,
 * and error handling following Material Design 3.0 principles
 */
const MemberPage: React.FC = () => {
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Hooks
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { members, isLoading: membersLoading, updateMember } = useMembers();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      redirect('/auth/login');
    }
  }, [authLoading, isAuthenticated]);

  // Handle page loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle profile update completion
  const handleEditComplete = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Show loading skeleton while data is being fetched
  if (authLoading || membersLoading || isPageLoading) {
    return (
      <MemberLayout>
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageAnimations}
          className="space-y-6 p-6"
        >
          <Skeleton 
            variant="rectangular" 
            height={200} 
            className="rounded-lg"
            animation="wave"
          />
          <div className="space-y-4">
            <Skeleton 
              variant="text" 
              width="60%" 
              height={32}
              animation="wave"
            />
            <Skeleton 
              variant="text" 
              width="40%" 
              height={24}
              animation="wave"
            />
          </div>
        </motion.div>
      </MemberLayout>
    );
  }

  // Show nothing if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Find current member data
  const currentMember = members?.find(member => member.id === user.id);

  return (
    <MemberLayout>
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          <motion.div
            key="member-dashboard"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageAnimations}
            className="container mx-auto px-4 py-6 space-y-8"
            role="main"
            aria-label="Member Dashboard"
          >
            {/* Page Header */}
            <header className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Member Dashboard
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md"
                aria-label={isEditing ? "Cancel editing" : "Edit profile"}
              >
                {isEditing ? "Cancel" : "Edit Profile"}
              </motion.button>
            </header>

            {/* Profile Section */}
            {currentMember && (
              <ProfileSection
                member={currentMember}
                isEditing={isEditing}
                onEditComplete={handleEditComplete}
              />
            )}

            {/* Additional dashboard sections can be added here */}
          </motion.div>
        </AnimatePresence>
      </ErrorBoundary>
    </MemberLayout>
  );
};

export default MemberPage;