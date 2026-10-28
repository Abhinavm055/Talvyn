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
  user: User
  isNewUser?: boolean
}

export interface ExtensionPairingRequest {
  requestId: string
  extensionId: string
  expiresAt: string
  approved: boolean
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

  logout: () =>
    apiClient.post<{ success: boolean }>('/auth/logout').then((r) => r.data),

  getExtensionPairing: (requestId: string) =>
    apiClient.get<ExtensionPairingRequest>(`/auth/extension-pairing/${encodeURIComponent(requestId)}`).then((r) => r.data),

  approveExtensionPairing: (requestId: string, expectedUserId: string) =>
    apiClient.post<{ success: boolean }>(`/auth/extension-pairing/${encodeURIComponent(requestId)}/approve`, { keepConnected: true, expectedUserId }).then((r) => r.data),

  signOutAll: () =>
    apiClient.post<{ success: boolean }>('/auth/signout-all').then((r) => r.data),
}
