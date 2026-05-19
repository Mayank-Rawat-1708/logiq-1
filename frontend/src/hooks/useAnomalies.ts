import { useQuery } from '@tanstack/react-query';
import { anomaliesApi } from '../api/anomalies';

export const useAnomalies = (sessionId: string, severity?: string, enabled = true) => {
  return useQuery({
    queryKey: ['anomalies', sessionId, severity],
    queryFn: () => anomaliesApi.listAnomalies(sessionId, severity),
    enabled: !!sessionId && enabled,
    staleTime: 60000,
  });
};

export const useClusters = (sessionId: string, enabled = true) => {
  return useQuery({
    queryKey: ['clusters', sessionId],
    queryFn: () => anomaliesApi.listClusters(sessionId),
    enabled: !!sessionId && enabled,
    staleTime: 60000,
  });
};
