import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// In development, defaults to '/api' (proxied by Vite to localhost:3001).
// In production, reads VITE_API_URL (e.g. 'https://talvyn-api.onrender.com') if configured.
const getApiBaseUrl = (): string => {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL
      ? import.meta.env.VITE_API_URL
      : typeof process !== 'undefined' && process?.env?.VITE_API_URL
        ? process.env.VITE_API_URL
        : ''

  if (!envUrl) return '/api'
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

// Attach token on every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — clear auth and redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
