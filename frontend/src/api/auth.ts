import api from './axios';
import type { AuthResponse, User } from '../types';

export const authApi = {
  register: async (email: string, password: string, full_name: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', { email, password, full_name });
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  refresh: async (refresh_token: string): Promise<{ access_token: string; refresh_token: string }> => {
    const { data } = await api.post('/auth/refresh', { refresh_token });
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  logout: async (refresh_token: string): Promise<void> => {
    await api.post('/auth/logout', { refresh_token });
  },
};
