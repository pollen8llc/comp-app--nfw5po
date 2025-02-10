'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { EventList } from '@/components/events/EventList';
import { ImportPanel } from '@/components/events/ImportPanel';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/useToast';
import { Event } from '@/types/events';

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

/**
 * Admin Events Page Component
 * Provides comprehensive event management interface with import capabilities
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA accessibility
 */
const EventsPage: React.FC = () => {
  // State management
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [importPanelOpen, setImportPanelOpen] = useState(false);

  // Hooks
  const { 
    events, 
    isLoading, 
    error, 
    importProgress,
    deleteEvent,
    isDeleting 
  } = useEvents();
  const toast = useToast();

  // Event selection handler with optimistic updates
  const handleEventSelect = useCallback((event: Event) => {
    setSelectedEvents(prev => {
      const isSelected = prev.includes(event.id);
      return isSelected
        ? prev.filter(id => id !== event.id)
        : [...prev, event.id];
    });
  }, []);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (!selectedEvents.length) return;

    try {
      await Promise.all(selectedEvents.map(id => deleteEvent(id)));
      
      toast.showToast({
        type: 'success',
        message: `Successfully deleted ${selectedEvents.length} events`
      });
      
      setSelectedEvents([]);
    } catch (error) {
      toast.showToast({
        type: 'error',
        message: 'Failed to delete events',
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [selectedEvents, deleteEvent, toast]);

  // Toggle import panel
  const toggleImportPanel = useCallback(() => {
    setImportPanelOpen(prev => !prev);
  }, []);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className="container mx-auto px-4 py-6 space-y-6"
      role="main"
      aria-label="Events management"
    >
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Events Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and import community events
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {selectedEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Delete ${selectedEvents.length} selected events`}
              >
                Delete Selected ({selectedEvents.length})
              </button>
            </motion.div>
          )}

          <button
            onClick={toggleImportPanel}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-expanded={importPanelOpen}
            aria-controls="import-panel"
          >
            {importPanelOpen ? 'Hide Import' : 'Import Events'}
          </button>
        </div>
      </div>

      {/* Import Panel */}
      <motion.div
        id="import-panel"
        initial={false}
        animate={{ height: importPanelOpen ? 'auto' : 0, opacity: importPanelOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        {importPanelOpen && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <ImportPanel />
            {importProgress > 0 && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                    role="progressbar"
                    aria-valuenow={importProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Import Progress: {importProgress}%
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Events List */}
      <div
        className="bg-white rounded-lg shadow-md"
        role="region"
        aria-label="Events list"
      >
        <EventList
          onEventSelect={handleEventSelect}
          selectedEventIds={selectedEvents}
          gridLayout="comfortable"
          className="min-h-[500px]"
        />
      </div>

      {/* Error Boundary Fallback */}
      {error && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-4 mt-4"
          role="alert"
        >
          <h3 className="text-red-800 font-medium">Error loading events</h3>
          <p className="text-red-600 mt-1">{error.message}</p>
        </div>
      )}
    </motion.div>
  );
};

export default EventsPage;