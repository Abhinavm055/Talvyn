import { create } from 'zustand'
import { User } from '../types'
import { queryClient } from '../lib/queryClient'

// Remove the previous persisted bearer token. Session state is verified by
// /auth/me; JavaScript never receives the website session cookie.
export function clearLegacyAuth(storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const target = storage || (typeof window !== 'undefined' ? window.localStorage : undefined)
    target?.removeItem('talvyn-auth')
    target?.removeItem('talvyn_connected_extension_id')
  } catch { /* Restricted browser storage must not prevent sign-in. */ }
}

clearLegacyAuth()

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isInitialized: boolean
  initializationError: string | null
  sessionRevision: number
  setAuth: (user: User) => void
  setUser: (user: User) => void
  finishInitialization: (error?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  initializationError: null,
  sessionRevision: 0,
  setAuth: (user) => {
    if (get().user?.id !== user.id) queryClient.clear()
    clearLegacyAuth()
    set({ user, isAuthenticated: true, isInitialized: true, initializationError: null, sessionRevision: get().sessionRevision + 1 })
  },
  setUser: (user) => set({ user }),
  finishInitialization: (error) => set({ isInitialized: true, initializationError: error || null }),
  logout: () => {
    queryClient.clear()
    clearLegacyAuth()
    set({ user: null, isAuthenticated: false, isInitialized: true, initializationError: null, sessionRevision: get().sessionRevision + 1 })
  },
}))
