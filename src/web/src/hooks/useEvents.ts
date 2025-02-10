import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query'; // ^4.0.0
import { Event, CreateEventInput, ImportEventsInput } from '../types/events';
import { apiClient } from '../lib/api-client';
import { useToast } from './useToast';

// Cache key for events
const EVENTS_CACHE_KEY = 'events';

// Polling interval for import status (in ms)
const IMPORT_POLL_INTERVAL = 2000;

// Maximum import attempts before failure
const MAX_IMPORT_ATTEMPTS = 30;

/**
 * Custom hook for comprehensive event management with platform integrations
 */
export const useEvents = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [importProgress, setImportProgress] = useState<number>(0);

  // Fetch events with caching and background updates
  const { data: events = [], isLoading, error } = useQuery<Event[]>(
    EVENTS_CACHE_KEY,
    async () => {
      const response = await apiClient.get<Event[]>('/api/events');
      return response.data;
    },
    {
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 300000, // Cache for 5 minutes
      refetchOnWindowFocus: true,
      retry: 3,
      onError: (error) => {
        toast.showToast({
          type: 'error',
          message: 'Failed to fetch events',
          description: error.message
        });
      }
    }
  );

  // Create event mutation with optimistic updates
  const createEventMutation = useMutation<Event, Error, CreateEventInput>(
    async (eventData) => {
      const response = await apiClient.post<Event>('/api/events', eventData);
      return response.data;
    },
    {
      onMutate: async (newEvent) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries(EVENTS_CACHE_KEY);

        // Snapshot previous value
        const previousEvents = queryClient.getQueryData<Event[]>(EVENTS_CACHE_KEY);

        // Optimistically update cache
        queryClient.setQueryData<Event[]>(EVENTS_CACHE_KEY, (old = []) => [
          ...old,
          { ...newEvent, id: `temp-${Date.now()}` } as Event
        ]);

        return { previousEvents };
      },
      onError: (error, _, context) => {
        // Revert cache on error
        if (context?.previousEvents) {
          queryClient.setQueryData(EVENTS_CACHE_KEY, context.previousEvents);
        }
        toast.showToast({
          type: 'error',
          message: 'Failed to create event',
          description: error.message
        });
      },
      onSuccess: () => {
        toast.showToast({
          type: 'success',
          message: 'Event created successfully'
        });
      },
      onSettled: () => {
        // Refetch to ensure cache consistency
        queryClient.invalidateQueries(EVENTS_CACHE_KEY);
      }
    }
  );

  // Update event mutation
  const updateEventMutation = useMutation<Event, Error, { id: string; data: Partial<Event> }>(
    async ({ id, data }) => {
      const response = await apiClient.put<Event>(`/api/events/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.showToast({
          type: 'success',
          message: 'Event updated successfully'
        });
        queryClient.invalidateQueries(EVENTS_CACHE_KEY);
      },
      onError: (error) => {
        toast.showToast({
          type: 'error',
          message: 'Failed to update event',
          description: error.message
        });
      }
    }
  );

  // Delete event mutation
  const deleteEventMutation = useMutation<void, Error, string>(
    async (id) => {
      await apiClient.delete(`/api/events/${id}`);
    },
    {
      onSuccess: () => {
        toast.showToast({
          type: 'success',
          message: 'Event deleted successfully'
        });
        queryClient.invalidateQueries(EVENTS_CACHE_KEY);
      },
      onError: (error) => {
        toast.showToast({
          type: 'error',
          message: 'Failed to delete event',
          description: error.message
        });
      }
    }
  );

  // Import events with progress tracking
  const importEvents = useCallback(async (importConfig: ImportEventsInput) => {
    try {
      setImportProgress(0);
      
      // Initiate import
      const importResponse = await apiClient.post<{ importId: string }>(
        '/api/events/import',
        importConfig
      );
      
      const { importId } = importResponse.data;
      let attempts = 0;
      let completed = false;

      // Poll import status
      while (!completed && attempts < MAX_IMPORT_ATTEMPTS) {
        const statusResponse = await apiClient.get<{
          status: string;
          progress: number;
          events?: Event[];
        }>(`/api/events/import/${importId}`);

        setImportProgress(statusResponse.data.progress);

        if (statusResponse.data.status === 'completed' && statusResponse.data.events) {
          completed = true;
          queryClient.setQueryData<Event[]>(
            EVENTS_CACHE_KEY,
            (old = []) => [...old, ...statusResponse.data.events!]
          );
          toast.showToast({
            type: 'success',
            message: `Successfully imported ${statusResponse.data.events.length} events`
          });
          return statusResponse.data.events;
        }

        if (statusResponse.data.status === 'failed') {
          throw new Error('Import failed');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, IMPORT_POLL_INTERVAL));
      }

      if (!completed) {
        throw new Error('Import timed out');
      }
    } catch (error) {
      toast.showToast({
        type: 'error',
        message: 'Failed to import events',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      setImportProgress(0);
    }
  }, [queryClient, toast]);

  return {
    // State
    events,
    isLoading,
    error,
    importProgress,

    // Event CRUD operations
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    importEvents,

    // Loading states
    isCreating: createEventMutation.isLoading,
    isUpdating: updateEventMutation.isLoading,
    isDeleting: deleteEventMutation.isLoading
  };
};