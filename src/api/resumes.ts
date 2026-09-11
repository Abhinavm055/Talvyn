import { apiClient } from './client'
import { Resume } from '../types'

export interface CreateResumePayload {
  name: string
  description?: string | null
  isDefault?: boolean
  fileUrl?: string | null
}

export interface ExtractedResumeProfile {
  legalFullName?: string | null
  givenName?: string | null
  middleName?: string | null
  familyName?: string | null
  preferredName?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
  preferredRoles?: string[]
  skills?: string[]
  experienceYears?: number | null
  linkedinUrl?: string | null
  githubUrl?: string | null
  portfolioUrl?: string | null
  otherLinks?: string[]
  languages?: string[]
  institution?: string | null
  degree?: string | null
  specialization?: string | null
  cgpa?: string | null
  graduationYear?: number | null
  education?: Array<{
    institution?: string | null
    degree?: string | null
    specialization?: string | null
    graduationYear?: number | null
    cgpa?: string | null
  }>
  workExperience?: Array<{
    company?: string | null
    title?: string | null
    duration?: string | null
    description?: string | null
  }>
  certifications?: string[]
  projects?: string[]
  professionalSummary?: string | null
  rawTextLength?: number
}

export interface ResumeUploadExtractResponse {
  success: boolean
  resume: Resume
  extracted: ExtractedResumeProfile
  extractedFields: string[]
  rawTextLength: number
}

export const resumesApi = {
  list: () =>
    apiClient.get<Resume[]>('/resumes').then((r) => r.data),

  upload: async (file: File, meta?: { name?: string; description?: string; isDefault?: boolean }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (meta?.name) formData.append('name', meta.name)
    if (meta?.description) formData.append('description', meta.description)
    if (meta?.isDefault !== undefined) formData.append('isDefault', String(meta.isDefault))

    const res = await apiClient.post<Resume>('/resumes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  uploadAndExtract: async (file: File, meta?: { name?: string; description?: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (meta?.name) formData.append('name', meta.name)
    if (meta?.description) formData.append('description', meta.description)

    const res = await apiClient.post<ResumeUploadExtractResponse>('/resumes/upload-and-extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  create: (data: CreateResumePayload) =>
    apiClient.post<Resume>('/resumes', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateResumePayload>) =>
    apiClient.put<Resume>(`/resumes/${id}`, data).then((r) => r.data),

  replace: async (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.put<Resume>(`/resumes/${id}/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  setDefault: (id: string) =>
    apiClient.put<Resume>(`/resumes/${id}`, { isDefault: true }).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/resumes/${id}`).then((r) => r.data),

  getFileUrl: (id: string) => `${apiClient.defaults.baseURL || 'http://localhost:3001/api'}/resumes/${id}/file`,
}
