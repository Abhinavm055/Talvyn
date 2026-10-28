import { authApi } from './auth'
import { useAuthStore } from '../store/authStore'

let pending: Promise<void> | null = null

export function initializeAuth(): Promise<void> {
  if (pending) return pending
  const revision = useAuthStore.getState().sessionRevision
  pending = authApi.me()
    .then((user) => {
      if (useAuthStore.getState().sessionRevision === revision) useAuthStore.getState().setAuth(user)
    })
    .catch((error: unknown) => {
      const status = (error as { response?: { status?: number } }).response?.status
      // A delayed response from before account switching must not replace the
      // newly signed-in account. The 401 interceptor clears the current session.
      if (useAuthStore.getState().sessionRevision !== revision) return
      if (status === 401) useAuthStore.getState().logout()
      else useAuthStore.getState().finishInitialization('Could not verify your website session. Check your connection and retry.')
    })
    .finally(() => { pending = null })
  return pending
}
