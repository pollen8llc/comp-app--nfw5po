'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { EventList } from '../../../components/events/EventList';
import { ImportPanel } from '../../../components/events/ImportPanel';
import { useEvents } from '../../../hooks/useEvents';
import { useToast } from '../../../hooks/useToast';
import { Event } from '../../../types/events';

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
      staggerChildren: 0.1
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

// Animation variants for section transitions
const sectionVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.3
    }
  }
};

/**
 * Member Events Dashboard Page Component
 * Implements event management capabilities with Material Design 3.0
 */
const MemberEventsPage = () => {
  // State management
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'import'>('events');

  // Custom hooks
  const { events, isLoading, error, importEvents } = useEvents();
  const toast = useToast();

  // Handle event selection
  const handleEventSelect = useCallback((event: Event) => {
    setSelectedEventIds(prev => {
      const isSelected = prev.includes(event.id);
      if (isSelected) {
        return prev.filter(id => id !== event.id);
      }
      return [...prev, event.id];
    });
  }, []);

  // Handle import completion
  const handleImportComplete = useCallback((result: { success: boolean, count?: number, error?: string }) => {
    if (result.success) {
      toast.showToast({
        type: 'success',
        message: `Successfully imported ${result.count} events`
      });
    } else {
      toast.showToast({
        type: 'error',
        message: 'Failed to import events',
        description: result.error
      });
    }
  }, [toast]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-surface p-6 md:p-8"
      role="main"
      aria-label="Events Dashboard"
    >
      {/* Page Header */}
      <motion.div 
        variants={sectionVariants}
        className="mb-8"
      >
        <h1 className="text-2xl md:text-3xl font-semibold text-on-surface mb-2">
          Events Dashboard
        </h1>
        <p className="text-on-surface-variant">
          Manage your events and import data from multiple platforms
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div 
        variants={sectionVariants}
        className="flex space-x-4 mb-6 border-b border-outline"
      >
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-2 px-4 text-lg transition-colors ${
            activeTab === 'events'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-primary'
          }`}
          aria-selected={activeTab === 'events'}
          role="tab"
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-2 px-4 text-lg transition-colors ${
            activeTab === 'import'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-primary'
          }`}
          aria-selected={activeTab === 'import'}
          role="tab"
        >
          Import
        </button>
      </motion.div>

      {/* Main Content */}
      <motion.div
        variants={sectionVariants}
        className="bg-surface rounded-lg shadow-sm"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'events' ? (
            <motion.div
              key="events"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <EventList
                onEventSelect={handleEventSelect}
                selectedEventIds={selectedEventIds}
                isLoading={isLoading}
                className="min-h-[600px]"
              />
            </motion.div>
          ) : (
            <motion.div
              key="import"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ImportPanel
                onImportComplete={handleImportComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Accessibility Features */}
      <div className="sr-only" aria-live="polite">
        {isLoading && 'Loading events...'}
        {error && `Error: ${error.message}`}
        {selectedEventIds.length > 0 && 
          `${selectedEventIds.length} events selected`
        }
      </div>
    </motion.div>
  );
};

export default MemberEventsPage;