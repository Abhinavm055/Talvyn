import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { initializeAuth } from '../../api/initializeAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isInitialized, initializationError } = useAuthStore()
  const location = useLocation()

  if (!isInitialized) return <div className="p-8 text-center text-sm text-slate-500">Verifying your session…</div>
  if (initializationError) return <div className="p-8 text-center text-sm text-slate-500"><p>{initializationError}</p><button onClick={() => void initializeAuth()} className="mt-3 font-semibold text-indigo-600">Retry</button></div>

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />
  }
  return <Outlet />
}

