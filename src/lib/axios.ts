import axios from 'axios';

function getInitialBaseUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && window.location.port) {
      return `${window.location.protocol}//${host}:3001/api`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

export const api = axios.create({
  baseURL: getInitialBaseUrl(),
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && window.location.port) {
      config.baseURL = `${window.location.protocol}//${host}:3001/api`;
    }
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
    } else if (error.code === 'ERR_NETWORK' && typeof window !== 'undefined') {
      console.warn('Network offline or backend server unreachable.');
    }
    return Promise.reject(error);
  }
);
