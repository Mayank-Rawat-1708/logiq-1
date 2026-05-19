import api from './axios';
import type { AnomalyRecord, ClusterResponse } from '../types';

export const anomaliesApi = {
  listAnomalies: async (sessionId: string, severity?: string): Promise<AnomalyRecord[]> => {
    const params = severity ? { severity } : {};
    const { data } = await api.get(`/anomalies/sessions/${sessionId}/anomalies`, { params });
    return data;
  },

  listClusters: async (sessionId: string): Promise<ClusterResponse[]> => {
    const { data } = await api.get(`/anomalies/sessions/${sessionId}/clusters`);
    return data;
  },
};
