import api from './axios';
import type { LogSession, PaginatedEntries, SessionStats } from '../types';

export const logsApi = {
  createSession: async (name: string, source: string = 'PASTE'): Promise<LogSession> => {
    const { data } = await api.post('/logs/sessions', { name, source });
    return data;
  },

  uploadFile: async (sessionId: string, file: File): Promise<LogSession> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`/logs/sessions/${sessionId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  pasteLogs: async (sessionId: string, raw_text: string): Promise<LogSession> => {
    const { data } = await api.post(`/logs/sessions/${sessionId}/paste`, { raw_text });
    return data;
  },

  listSessions: async (page = 1, pageSize = 20): Promise<LogSession[]> => {
    const { data } = await api.get('/logs/sessions', { params: { page, page_size: pageSize } });
    return data;
  },

  getSession: async (sessionId: string): Promise<LogSession> => {
    const { data } = await api.get(`/logs/sessions/${sessionId}`);
    return data;
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/logs/sessions/${sessionId}`);
  },

  getEntries: async (
    sessionId: string,
    params: {
      page?: number;
      page_size?: number;
      level?: string;
      anomaly_only?: boolean;
      search?: string;
    } = {}
  ): Promise<PaginatedEntries> => {
    const { data } = await api.get(`/logs/sessions/${sessionId}/entries`, { params });
    return data;
  },

  getStats: async (sessionId: string): Promise<SessionStats> => {
    const { data } = await api.get(`/logs/sessions/${sessionId}/stats`);
    return data;
  },
};
