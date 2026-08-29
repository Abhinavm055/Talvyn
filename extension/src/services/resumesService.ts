import { api } from './apiClient'
import { Resume } from '../types'

/**
 * Resumes service — connects to existing Talvyn REST API /api/resumes
 */
export const resumesService = {
  list: (): Promise<Resume[]> => api.get<Resume[]>('/api/resumes'),
}
