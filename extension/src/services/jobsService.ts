import { api } from './apiClient'
import { Job, CreateJobPayload, CheckUrlResponse } from '../types'

/**
 * Jobs service — connects to the existing Talvyn REST API.
 * The extension saves jobs, checks for duplicates, and fetches recent jobs.
 * No business logic lives here — it all stays on the server.
 */
export const jobsService = {
  /**
   * Check if a job URL has already been saved by this user.
   * Uses the new GET /api/jobs/check-url endpoint.
   */
  checkDuplicate: (url: string): Promise<CheckUrlResponse> =>
    api.get<CheckUrlResponse>(`/api/jobs/check-url?url=${encodeURIComponent(url)}`),

  /**
   * Save a new job to the Talvyn dashboard.
   * Calls POST /api/jobs with the extracted job data.
   */
  save: (payload: CreateJobPayload): Promise<Job> =>
    api.post<Job>('/api/jobs', payload),

  /**
   * Get recent jobs for display in the popup.
   */
  getRecent: (limit = 5): Promise<{ jobs: Job[]; total: number }> =>
    api.get<{ jobs: Job[]; total: number }>(`/api/jobs?limit=${limit}`),

  /**
   * Update job status (e.g. mark as Interested from the extension).
   */
  updateStatus: (id: string, status: string): Promise<Job> =>
    api.patch<Job>(`/api/jobs/${id}/status`, { status }),

  /**
   * Track applied job automatically upon success detection (Phase 2D).
   */
  trackApplied: (payload: import('../types').TrackAppliedPayload): Promise<import('../types').TrackAppliedResponse> =>
    api.post<import('../types').TrackAppliedResponse>('/api/jobs/track-applied', payload),

  /**
   * Undo automatic applied status update (Phase 2D).
   */
  undoApplied: (id: string, payload: import('../types').UndoAppliedPayload): Promise<import('../types').UndoAppliedResponse> =>
    api.post<import('../types').UndoAppliedResponse>(`/api/jobs/${id}/undo-applied`, payload),

  /**
   * Get application timeline events (Phase 2E).
   */
  getTimeline: (id: string): Promise<{ timeline: import('../types').TimelineEvent[] }> =>
    api.get<{ timeline: import('../types').TimelineEvent[] }>(`/api/jobs/${id}/timeline`),

  /**
   * Add a timeline event milestone (Phase 2E).
   */
  addTimelineEvent: (id: string, stage: string, note?: string): Promise<{ success: boolean; timeline: import('../types').TimelineEvent[] }> =>
    api.post<{ success: boolean; timeline: import('../types').TimelineEvent[] }>(`/api/jobs/${id}/timeline`, { stage, note }),
}

