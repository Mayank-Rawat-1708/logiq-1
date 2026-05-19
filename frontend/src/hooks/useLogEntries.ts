import { useQuery } from '@tanstack/react-query';
import { logsApi } from '../api/logs';

interface EntryFilters {
  page?: number;
  page_size?: number;
  level?: string;
  anomaly_only?: boolean;
  search?: string;
}

export const useLogEntries = (sessionId: string, filters: EntryFilters = {}, enabled = true) => {
  return useQuery({
    queryKey: ['entries', sessionId, filters],
    queryFn: () => logsApi.getEntries(sessionId, filters),
    enabled: !!sessionId && enabled,
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });
};
