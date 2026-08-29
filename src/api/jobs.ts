import { apiClient } from './client'
import { Job, JobStatus, JobType } from '../types'

export interface JobsResponse {
  jobs: Job[]
  total: number
  page: number
  limit: number
}

export interface CreateJobPayload {
  title: string
  company: string
  jobUrl?: string
  sourceWebsite?: string
  location?: string
  jobType?: JobType
  salary?: string
  description?: string
  status?: JobStatus
  dateApplied?: string | null
}

export const jobsApi = {
  list: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    apiClient.get<JobsResponse>('/jobs', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Job>(`/jobs/${id}`).then((r) => r.data),

  create: (data: CreateJobPayload) =>
    apiClient.post<Job>('/jobs', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateJobPayload>) =>
    apiClient.put<Job>(`/jobs/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: JobStatus) =>
    apiClient.patch<Job>(`/jobs/${id}/status`, { status }).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/jobs/${id}`).then((r) => r.data),

  getTimeline: (id: string) =>
    apiClient.get<{ timeline: import('../types').TimelineEvent[] }>(`/jobs/${id}/timeline`).then((r) => r.data),

  addTimelineEvent: (id: string, stage: string, note?: string) =>
    apiClient.post<{ success: boolean; timeline: import('../types').TimelineEvent[] }>(`/jobs/${id}/timeline`, { stage, note }).then((r) => r.data),
}

