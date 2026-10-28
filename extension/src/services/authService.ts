import { api } from './apiClient'
import { AuthUser } from '../types'

/**
 * User information is fetched through the worker's independent extension session.
 * Account authentication happens on the Talvyn website using a one-time pairing request.
 */
export const authService = {
  /**
   * Get the current authenticated user.
   * Used to validate a stored token on extension startup.
   */
  me: (): Promise<AuthUser> =>
    api.get<AuthUser>('/api/auth/me'),
}
