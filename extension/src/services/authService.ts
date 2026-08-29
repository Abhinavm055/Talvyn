import { api } from './apiClient'
import { AuthResponse, AuthUser } from '../types'

/**
 * Auth service — connects to the existing Talvyn JWT auth system.
 * The extension reuses POST /api/auth/login and GET /api/auth/me.
 */
export const authService = {
  /**
   * Authenticate with email + password.
   * Returns the JWT token and user object from the existing backend.
   */
  login: (email: string, password: string): Promise<AuthResponse> =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),

  /**
   * Authenticate with verified Google credential.
   */
  googleLogin: (credential: string): Promise<AuthResponse> =>
    api.post<AuthResponse>('/api/auth/google', { credential }),

  /**
   * Get the current authenticated user.
   * Used to validate a stored token on extension startup.
   */
  me: (): Promise<AuthUser> =>
    api.get<AuthUser>('/api/auth/me'),
}
