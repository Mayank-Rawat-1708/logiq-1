import api from './axios';
import type { LogEntry } from '../types';

export const searchApi = {
  semanticSearch: async (sessionId: string, query: string, top_k = 10): Promise<LogEntry[]> => {
    const { data } = await api.post(`/search/sessions/${sessionId}/semantic`, { query, top_k });
    return data;
  },
};
