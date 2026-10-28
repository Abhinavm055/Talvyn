/**
 * Talvyn Chrome Extension Configuration
 *
 * Production endpoints:
 * - API_BASE: https://talvyn-backend-7ucf.onrender.com
 * - DASHBOARD_URL: https://talvyn.vercel.app
 *
 * Development endpoints:
 * - API_BASE: http://localhost:3001
 * - DASHBOARD_URL: http://localhost:5173
 */

// `vite build --mode development` is also an intentional local build.
const isProd = import.meta.env?.PROD === true && import.meta.env.MODE !== 'development'

export const CONFIG = {
  API_BASE: isProd
    ? 'https://talvyn-backend-7ucf.onrender.com'
    : 'http://localhost:3001',
  DASHBOARD_URL: isProd
    ? 'https://talvyn.vercel.app'
    : 'http://localhost:5173',
  WEB_ORIGINS: isProd ? ['https://talvyn.vercel.app'] : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  PROTOCOL_VERSION: 2,
  STORAGE_KEY_TOKEN: 'talvyn_token',
  STORAGE_KEY_USER: 'talvyn_user',
  STORAGE_KEY_LAST_JOB: 'talvyn_last_job',
} as const

export type Config = typeof CONFIG

export type DashboardRoute = 'dashboard' | 'profile' | 'tracker' | 'settings' | 'signup' | 'connect'

export function getDashboardRouteUrl(route: DashboardRoute): string {
  const base = CONFIG.DASHBOARD_URL.replace(/\/+$/, '')
  switch (route) {
    case 'dashboard':
      return `${base}/dashboard`
    case 'profile':
      return `${base}/profile`
    case 'tracker':
      return `${base}/tracker`
    case 'settings':
      return `${base}/extensions`
    case 'signup':
      return `${base}/signup`
    case 'connect':
      return `${base}/extension/connect`
    default:
      return `${base}/dashboard`
  }
}
