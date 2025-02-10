'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { Skeleton } from '@mui/material'; // v5.0.0
import { Card } from '../../components/common/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useMembers } from '../../hooks/useMembers';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { Icon } from '../../components/common/Icon';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';

// Animation variants for staggered entrance
const containerAnimation = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Calculate engagement rate from network metrics
const calculateEngagementRate = (networkData: any) => {
  if (!networkData?.performanceMetrics) return 0;
  const { activeMembers, totalMembers } = networkData.performanceMetrics;
  return totalMembers ? Math.round((activeMembers / totalMembers) * 100) : 0;
};

const AdminDashboard = React.memo(() => {
  // Fetch analytics and member data
  const { networkData, isLoading: isLoadingAnalytics, error: analyticsError } = useAnalytics();
  const { members, isLoading: isLoadingMembers, error: membersError } = useMembers();

  // Calculate key metrics
  const metrics = useMemo(() => {
    if (!networkData || !members) return null;

    return {
      totalMembers: members.length,
      engagementRate: calculateEngagementRate(networkData),
      activeConnections: networkData.performanceMetrics?.activeConnections || 0,
      averageCentrality: networkData.centralityScores?.average || 0,
    };
  }, [networkData, members]);

  // Loading state
  if (isLoadingAnalytics || isLoadingMembers) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={160}
            className="rounded-lg"
            animation="wave"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (analyticsError || membersError) {
    return (
      <EmptyState
        title="Unable to load dashboard"
        description="There was an error loading the dashboard data. Please try again."
        iconName="close"
        actionLabel="Retry"
        onAction={() => window.location.reload()}
        theme="light"
        variant="default"
      />
    );
  }

  // Empty state
  if (!metrics) {
    return (
      <EmptyState
        title="No data available"
        description="Start by adding members to your community"
        iconName="user"
        actionLabel="Add Members"
        theme="light"
        variant="default"
      />
    );
  }

  return (
    <ErrorBoundary>
      <motion.div
        className="p-6 space-y-6"
        variants={containerAnimation}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div variants={itemAnimation} className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <Button
            variant="primary"
            startIcon="add"
            ariaLabel="Add new member"
          >
            Add Member
          </Button>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Members */}
          <motion.div variants={itemAnimation}>
            <Card
              variant="elevated"
              padding="md"
              elevation={1}
              className="h-full"
              interactive
            >
              <div className="flex items-center space-x-4">
                <Icon name="user" size="lg" ariaLabel="Total members" />
                <div>
                  <p className="text-sm text-gray-600">Total Members</p>
                  <p className="text-2xl font-semibold">{metrics.totalMembers}</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Engagement Rate */}
          <motion.div variants={itemAnimation}>
            <Card
              variant="elevated"
              padding="md"
              elevation={1}
              className="h-full"
              interactive
            >
              <div className="flex items-center space-x-4">
                <Icon name="graph" size="lg" ariaLabel="Engagement rate" />
                <div>
                  <p className="text-sm text-gray-600">Engagement Rate</p>
                  <p className="text-2xl font-semibold">{metrics.engagementRate}%</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Active Connections */}
          <motion.div variants={itemAnimation}>
            <Card
              variant="elevated"
              padding="md"
              elevation={1}
              className="h-full"
              interactive
            >
              <div className="flex items-center space-x-4">
                <Icon name="settings" size="lg" ariaLabel="Active connections" />
                <div>
                  <p className="text-sm text-gray-600">Active Connections</p>
                  <p className="text-2xl font-semibold">{metrics.activeConnections}</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Network Health */}
          <motion.div variants={itemAnimation}>
            <Card
              variant="elevated"
              padding="md"
              elevation={1}
              className="h-full"
              interactive
            >
              <div className="flex items-center space-x-4">
                <Icon name="graph" size="lg" ariaLabel="Network health" />
                <div>
                  <p className="text-sm text-gray-600">Network Health</p>
                  <p className="text-2xl font-semibold">
                    {Math.round(metrics.averageCentrality * 100)}%
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Additional dashboard sections can be added here */}
      </motion.div>
    </ErrorBoundary>
  );
});

AdminDashboard.displayName = 'AdminDashboard';

export default AdminDashboard;