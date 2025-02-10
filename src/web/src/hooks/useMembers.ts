import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // ^4.29.0
import { Member, CreateMemberInput, UpdateMemberInput, MemberFilterParams } from '../types/members';
import { apiClient } from '../lib/api-client';
import { useToast } from './useToast';

// Cache key for members data
const MEMBERS_CACHE_KEY = 'members';

/**
 * Custom hook for comprehensive member management with optimistic updates,
 * real-time cache management, and enhanced error handling
 */
export const useMembers = (
  filterParams: MemberFilterParams = {},
  options: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  } = {}
) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch members with filtering and pagination
  const {
    data: members = [],
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  } = useQuery({
    queryKey: [MEMBERS_CACHE_KEY, filterParams],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await apiClient.get<Member[]>('/members', {
        params: {
          ...filterParams,
          page: pageParam,
          limit: 20
        }
      });
      return response.data;
    },
    keepPreviousData: true,
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
    cacheTime: options.cacheTime || 30 * 60 * 1000, // 30 minutes
    enabled: options.enabled !== false,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length + 1 : undefined;
    }
  });

  // Create member mutation with optimistic update
  const createMemberMutation = useMutation({
    mutationFn: async (input: CreateMemberInput) => {
      const response = await apiClient.post<Member>('/members', input);
      return response.data;
    },
    onMutate: async (newMember) => {
      await queryClient.cancelQueries([MEMBERS_CACHE_KEY]);
      const previousMembers = queryClient.getQueryData([MEMBERS_CACHE_KEY]);
      
      queryClient.setQueryData([MEMBERS_CACHE_KEY], (old: Member[] = []) => [
        { id: `temp-${Date.now()}`, ...newMember } as Member,
        ...old
      ]);

      return { previousMembers };
    },
    onSuccess: (member) => {
      toast.showToast({
        type: 'success',
        message: 'Member created successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error, _, context) => {
      queryClient.setQueryData([MEMBERS_CACHE_KEY], context?.previousMembers);
      toast.showToast({
        type: 'error',
        message: 'Failed to create member',
        description: error.message
      });
    }
  });

  // Update member mutation with optimistic update
  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMemberInput }) => {
      const response = await apiClient.put<Member>(`/members/${id}`, data);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries([MEMBERS_CACHE_KEY]);
      const previousMembers = queryClient.getQueryData([MEMBERS_CACHE_KEY]);

      queryClient.setQueryData([MEMBERS_CACHE_KEY], (old: Member[] = []) =>
        old.map((member) =>
          member.id === id ? { ...member, ...data } : member
        )
      );

      return { previousMembers };
    },
    onSuccess: () => {
      toast.showToast({
        type: 'success',
        message: 'Member updated successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error, _, context) => {
      queryClient.setQueryData([MEMBERS_CACHE_KEY], context?.previousMembers);
      toast.showToast({
        type: 'error',
        message: 'Failed to update member',
        description: error.message
      });
    }
  });

  // Delete member mutation with optimistic update
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/members/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries([MEMBERS_CACHE_KEY]);
      const previousMembers = queryClient.getQueryData([MEMBERS_CACHE_KEY]);

      queryClient.setQueryData([MEMBERS_CACHE_KEY], (old: Member[] = []) =>
        old.filter((member) => member.id !== id)
      );

      return { previousMembers };
    },
    onSuccess: () => {
      toast.showToast({
        type: 'success',
        message: 'Member deleted successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error, _, context) => {
      queryClient.setQueryData([MEMBERS_CACHE_KEY], context?.previousMembers);
      toast.showToast({
        type: 'error',
        message: 'Failed to delete member',
        description: error.message
      });
    }
  });

  // Bulk update members
  const bulkUpdateMembersMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: UpdateMemberInput }) => {
      const response = await apiClient.put<Member[]>('/members/bulk', { ids, data });
      return response.data;
    },
    onSuccess: () => {
      toast.showToast({
        type: 'success',
        message: 'Members updated successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error) => {
      toast.showToast({
        type: 'error',
        message: 'Failed to update members',
        description: error.message
      });
    }
  });

  // Bulk delete members
  const bulkDeleteMembersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.delete('/members/bulk', { data: { ids } });
    },
    onSuccess: () => {
      toast.showToast({
        type: 'success',
        message: 'Members deleted successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error) => {
      toast.showToast({
        type: 'error',
        message: 'Failed to delete members',
        description: error.message
      });
    }
  });

  // Update member social profiles
  const updateSocialProfilesMutation = useMutation({
    mutationFn: async ({ id, profiles }: { id: string; profiles: Member['socialProfiles'] }) => {
      const response = await apiClient.put<Member>(`/members/${id}/social-profiles`, { profiles });
      return response.data;
    },
    onSuccess: () => {
      toast.showToast({
        type: 'success',
        message: 'Social profiles updated successfully'
      });
      queryClient.invalidateQueries([MEMBERS_CACHE_KEY]);
    },
    onError: (error) => {
      toast.showToast({
        type: 'error',
        message: 'Failed to update social profiles',
        description: error.message
      });
    }
  });

  return {
    // Data and loading states
    members,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,

    // Single member operations
    createMember: createMemberMutation.mutateAsync,
    updateMember: updateMemberMutation.mutateAsync,
    deleteMember: deleteMemberMutation.mutateAsync,

    // Bulk operations
    bulkUpdateMembers: bulkUpdateMembersMutation.mutateAsync,
    bulkDeleteMembers: bulkDeleteMembersMutation.mutateAsync,

    // Social profile management
    updateSocialProfiles: updateSocialProfilesMutation.mutateAsync,

    // Mutation states
    isCreating: createMemberMutation.isLoading,
    isUpdating: updateMemberMutation.isLoading,
    isDeleting: deleteMemberMutation.isLoading,
    isBulkUpdating: bulkUpdateMembersMutation.isLoading,
    isBulkDeleting: bulkDeleteMembersMutation.isLoading,
    isUpdatingSocialProfiles: updateSocialProfilesMutation.isLoading
  };
};