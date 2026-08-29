import { api } from './apiClient'
import { UserProfile } from '../types'

/**
 * Profile service for extension to retrieve user career preferences
 */
export const profileService = {
  get: (): Promise<UserProfile> => api.get<UserProfile>('/api/profile'),
}
