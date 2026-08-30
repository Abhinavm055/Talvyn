import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Button } from './components/ui/Button'
import { RotateCw, AlertTriangle } from 'lucide-react'

/**
 * Resilient lazy loader that catches deployment chunk hash mismatches.
 * If a chunk fails to load (e.g. after a new production deployment replaces hashes),
 * it performs a one-time automatic page refresh to fetch the latest asset manifest.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const module = await factory()
      // Successful load: clear any previous retry attempt flag
      sessionStorage.removeItem('chunk_retry_attempted')
      return module
    } catch (error: unknown) {
      const isChunkError =
        error instanceof Error &&
        (error.message.includes('Failed to fetch dynamically imported module') ||
          error.message.includes('Importing a module script failed') ||
          error.message.includes('error loading dynamically imported module'))

      const hasRetried = sessionStorage.getItem('chunk_retry_attempted')
      if (isChunkError && !hasRetried) {
        sessionStorage.setItem('chunk_retry_attempted', 'true')
        window.location.reload()
        // Return a pending promise while the page reloads
        return new Promise<{ default: T }>(() => {})
      }

      throw error
    }
  })
}

// Lazy loaded page components
const Landing = lazyWithRetry(() => import('./pages/Landing'))
const Login = lazyWithRetry(() => import('./pages/auth/Login'))
const SignUp = lazyWithRetry(() => import('./pages/auth/SignUp'))
const Onboarding = lazyWithRetry(() => import('./pages/onboarding/Onboarding'))
const Dashboard = lazyWithRetry(() => import('./pages/dashboard/Dashboard'))
const JobList = lazyWithRetry(() => import('./pages/jobs/JobList'))
const JobDetail = lazyWithRetry(() => import('./pages/jobs/JobDetail'))
const JobForm = lazyWithRetry(() => import('./pages/jobs/JobForm'))
const Tracker = lazyWithRetry(() => import('./pages/tracker/Tracker'))
const Profile = lazyWithRetry(() => import('./pages/profile/Profile'))
const Resumes = lazyWithRetry(() => import('./pages/resumes/Resumes'))
const Extensions = lazyWithRetry(() => import('./pages/extensions/Extensions'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )
}

export function RouteErrorBoundary() {
  const error = useRouteError() as Error | undefined

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6 text-center">
      <div className="max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Page Update Available</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            A new version of Talvyn was deployed. Please reload to load the latest application assets.
          </p>
        </div>
        <Button
          icon={<RotateCw className="w-4 h-4" />}
          onClick={() => {
            sessionStorage.removeItem('chunk_retry_attempted')
            window.location.reload()
          }}
          className="w-full"
        >
          Reload Page
        </Button>
      </div>
    </div>
  )
}

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    element: withSuspense(Landing),
  },
  {
    path: '/login',
    errorElement: <RouteErrorBoundary />,
    element: withSuspense(Login),
  },
  {
    path: '/signup',
    errorElement: <RouteErrorBoundary />,
    element: withSuspense(SignUp),
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/onboarding',
        errorElement: <RouteErrorBoundary />,
        element: withSuspense(Onboarding),
      },
      {
        element: <DashboardLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: '/dashboard', errorElement: <RouteErrorBoundary />, element: withSuspense(Dashboard) },
          { path: '/jobs', errorElement: <RouteErrorBoundary />, element: withSuspense(JobList) },
          { path: '/jobs/new', errorElement: <RouteErrorBoundary />, element: withSuspense(JobForm) },
          { path: '/jobs/:id', errorElement: <RouteErrorBoundary />, element: withSuspense(JobDetail) },
          { path: '/jobs/:id/edit', errorElement: <RouteErrorBoundary />, element: withSuspense(JobForm) },
          { path: '/tracker', errorElement: <RouteErrorBoundary />, element: withSuspense(Tracker) },
          { path: '/resumes', errorElement: <RouteErrorBoundary />, element: withSuspense(Resumes) },
          { path: '/profile', errorElement: <RouteErrorBoundary />, element: withSuspense(Profile) },
          { path: '/extensions', errorElement: <RouteErrorBoundary />, element: withSuspense(Extensions) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
