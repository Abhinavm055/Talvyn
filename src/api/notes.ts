import { apiClient } from './client'
import { Note } from '../types'

export const notesApi = {
  list: (jobId: string) =>
    apiClient.get<Note[]>(`/jobs/${jobId}/notes`).then((r) => r.data),

  create: (jobId: string, content: string) =>
    apiClient.post<Note>(`/jobs/${jobId}/notes`, { content }).then((r) => r.data),

  update: (noteId: string, content: string) =>
    apiClient.put<Note>(`/notes/${noteId}`, { content }).then((r) => r.data),

  delete: (noteId: string) =>
    apiClient.delete(`/notes/${noteId}`).then((r) => r.data),
}
