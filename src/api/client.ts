import axios from 'axios'
import { useAuthStore } from '../store/authStore'

declare module 'axios' {
  interface AxiosRequestConfig { talvynSessionRevision?: number }
}

// Same-origin /api is proxied to the API by Vite/Vercel. The HttpOnly cookie
// works in Brave without third-party cookie access.
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  config.talvynSessionRevision = useAuthStore.getState().sessionRevision
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.talvynSessionRevision === useAuthStore.getState().sessionRevision) useAuthStore.getState().logout()
    return Promise.reject(error)
  },
)
