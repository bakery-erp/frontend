import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-error'));
      }
    } else if ((error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') && typeof window !== 'undefined') {
      console.warn('Network offline, timeout, or backend server unreachable.');
    }
    return Promise.reject(error);
  }
);
