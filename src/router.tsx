import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'

// Lazy loaded page components for optimal production chunking
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/auth/Login'))
const SignUp = lazy(() => import('./pages/auth/SignUp'))
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'))
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const JobList = lazy(() => import('./pages/jobs/JobList'))
const JobDetail = lazy(() => import('./pages/jobs/JobDetail'))
const JobForm = lazy(() => import('./pages/jobs/JobForm'))
const Tracker = lazy(() => import('./pages/tracker/Tracker'))
const Profile = lazy(() => import('./pages/profile/Profile'))
const Resumes = lazy(() => import('./pages/resumes/Resumes'))
const Extensions = lazy(() => import('./pages/extensions/Extensions'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
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
  { path: '/', element: withSuspense(Landing) },
  { path: '/login', element: withSuspense(Login) },
  { path: '/signup', element: withSuspense(SignUp) },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: withSuspense(Onboarding) },
      {
        element: <DashboardLayout />,
        children: [
          { path: '/dashboard', element: withSuspense(Dashboard) },
          { path: '/jobs', element: withSuspense(JobList) },
          { path: '/jobs/new', element: withSuspense(JobForm) },
          { path: '/jobs/:id', element: withSuspense(JobDetail) },
          { path: '/jobs/:id/edit', element: withSuspense(JobForm) },
          { path: '/tracker', element: withSuspense(Tracker) },
          { path: '/resumes', element: withSuspense(Resumes) },
          { path: '/profile', element: withSuspense(Profile) },
          { path: '/extensions', element: withSuspense(Extensions) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
