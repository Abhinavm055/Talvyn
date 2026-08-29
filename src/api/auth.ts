import { apiClient } from './client'
import { User } from '../types'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  givenName?: string
}

export interface AuthResponse {
  token: string
  user: User
  isNewUser?: boolean
}

export const authApi = {
  register: (data: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  googleLogin: (credential: string) =>
    apiClient.post<AuthResponse>('/auth/google', { credential }).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  getConfig: () =>
    apiClient.get<{ googleConfigured: boolean }>('/auth/config').then((r) => r.data),
}
