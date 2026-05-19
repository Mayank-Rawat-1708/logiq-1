import axios from 'axios';
import { useAuthStore } from '../store/authStore';
 
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
 
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
 
// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
 
let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];
 
// Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
 
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
 
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/auth';
        return Promise.reject(error);
      }
 
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
 
      isRefreshing = true;
 
      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const newToken = response.data.access_token;
        useAuthStore.getState().setAccessToken(newToken);
 
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
 
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/auth';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
 
    return Promise.reject(error);
  }
);
 
export default api;