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

const isProd =
  process.env.NODE_ENV === 'production' ||
  (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD))

export const CONFIG = {
  API_BASE: isProd
    ? 'https://talvyn-backend-7ucf.onrender.com'
    : 'http://localhost:3001',
  DASHBOARD_URL: isProd
    ? 'https://talvyn.vercel.app'
    : 'http://localhost:5173',
  STORAGE_KEY_TOKEN: 'talvyn_token',
  STORAGE_KEY_USER: 'talvyn_user',
  STORAGE_KEY_LAST_JOB: 'talvyn_last_job',
} as const

export type Config = typeof CONFIG
