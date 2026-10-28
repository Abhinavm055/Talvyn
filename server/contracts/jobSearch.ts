/** Browser-safe search contract. No runtime, environment or database imports. */
export const JOB_SEARCH_STATUSES = ['ALL', 'SAVED', 'INTERESTED', 'IN_PROGRESS', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as const
export const JOB_SEARCH_TYPES = ['ALL', 'JOB', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP', 'TEMPORARY', 'GRADUATE_PROGRAM', 'FELLOWSHIP', 'COMPETITION', 'TALENT_OPPORTUNITY', 'OTHER'] as const

export interface JobSearchFilters {
  search: string
  company: string
  location: string
  status: typeof JOB_SEARCH_STATUSES[number]
  jobType: typeof JOB_SEARCH_TYPES[number]
}

export const DEFAULT_JOB_SEARCH_FILTERS: Readonly<JobSearchFilters> = Object.freeze({
  search: '', company: '', location: '', status: 'ALL', jobType: 'ALL',
})

export interface SavedSearch {
  id: string
  name: string
  filters: JobSearchFilters
  createdAt: string
  updatedAt: string
}

export function filtersToJobQuery(filters: JobSearchFilters): Record<string, string> {
  const query: Record<string, string> = {}
  for (const field of ['search', 'company', 'location'] as const) {
    const value = filters[field].trim()
    if (value) query[field] = value
  }
  if (filters.status !== 'ALL') query.status = filters.status
  if (filters.jobType !== 'ALL') query.jobType = filters.jobType
  return query
}
