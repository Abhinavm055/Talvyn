import { apiClient } from './client'
import { UserProfile } from '../types'

export function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((item) => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed === '[]' || trimmed === '{}') return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      if (trimmed.includes(',')) {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
      }
      return [trimmed]
    }
  }
  return []
}

export function normalizeProfile(p: Partial<UserProfile> | null | undefined): UserProfile {
  if (!p) {
    return {
      id: '',
      userId: '',
      preferredRoles: [],
      skills: [],
      otherLinks: [],
      preferredLocations: [],
      preferredJobTypes: [],
      languages: [],
      workStyle: 'ANY',
      onboardingCompleted: false,
      createdAt: '',
      updatedAt: '',
    }
  }

  return {
    ...p,
    id: p.id || '',
    userId: p.userId || '',
    preferredRoles: safeArray(p.preferredRoles),
    skills: safeArray(p.skills),
    otherLinks: safeArray(p.otherLinks),
    preferredLocations: safeArray(p.preferredLocations),
    preferredJobTypes: safeArray(p.preferredJobTypes),
    languages: safeArray(p.languages),
    workStyle: p.workStyle || 'ANY',
    onboardingCompleted: Boolean(p.onboardingCompleted),
    createdAt: p.createdAt || '',
    updatedAt: p.updatedAt || '',
  } as UserProfile
}

export const profileApi = {
  get: () =>
    apiClient.get<UserProfile>('/profile').then((r) => normalizeProfile(r.data)),

  update: (data: Partial<UserProfile>) =>
    apiClient.put<UserProfile>('/profile', data).then((r) => normalizeProfile(r.data)),

  uploadAvatar: async (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await apiClient.post<{ success: boolean; avatarUrl: string }>('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  deleteAvatar: async () => {
    const res = await apiClient.delete<{ success: boolean; avatarUrl: null }>('/profile/avatar')
    return res.data
  },

  fetchSafeAvatarBlob: async (url: string): Promise<Blob> => {
    // 1. Try direct CORS fetch first
    try {
      const directRes = await fetch(url, { mode: 'cors' })
      if (directRes.ok) {
        const contentType = directRes.headers.get('content-type') || ''
        if (!contentType || contentType.startsWith('image/')) {
          return await directRes.blob()
        }
      }
    } catch {
      // CORS or network error, fallback to secure backend proxy
    }

    // 2. Fallback to authenticated backend avatar proxy
    const proxyRes = await apiClient.get<Blob>('/profile/avatar/proxy', {
      params: { url },
      responseType: 'blob',
    })
    return proxyRes.data
  },
}
