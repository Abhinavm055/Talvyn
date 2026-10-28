import { apiClient } from './client'
import type { JobSearchFilters, SavedSearch } from '../../server/contracts/jobSearch'

export const savedSearchesApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get<{ searches: SavedSearch[] }>('/saved-searches', { signal }).then((response) => response.data.searches),
  create: (data: { name: string; filters: JobSearchFilters }) =>
    apiClient.post<SavedSearch>('/saved-searches', data).then((response) => response.data),
  update: (id: string, data: { name?: string; filters?: JobSearchFilters }) =>
    apiClient.patch<SavedSearch>(`/saved-searches/${encodeURIComponent(id)}`, data).then((response) => response.data),
  delete: (id: string) =>
    apiClient.delete(`/saved-searches/${encodeURIComponent(id)}`).then(() => undefined),
}
