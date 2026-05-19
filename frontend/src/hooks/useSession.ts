import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logsApi } from '../api/logs';
import { useAuthStore } from '../store/authStore';

export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => logsApi.getSession(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
    enabled: !!sessionId,
  });
};

export const useSessionStats = (sessionId: string, enabled = true) => {
  return useQuery({
    queryKey: ['session-stats', sessionId],
    queryFn: () => logsApi.getStats(sessionId),
    enabled: !!sessionId && enabled,
    staleTime: 30000,
  });
};

export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => logsApi.listSessions(),
    staleTime: 10000,
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  const addToast = useAuthStore((s) => s.addToast);

  return useMutation({
    mutationFn: logsApi.deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      addToast('success', 'Session deleted');
    },
    onError: () => addToast('error', 'Failed to delete session'),
  });
};
