/**
 * Extension configuration constants.
 * The API_BASE can be overridden via chrome.storage for production use.
 */
export const CONFIG = {
  API_BASE: 'http://localhost:3001',
  DASHBOARD_URL: 'http://localhost:5173',
  STORAGE_KEY_TOKEN: 'talvyn_token',
  STORAGE_KEY_USER: 'talvyn_user',
  STORAGE_KEY_LAST_JOB: 'talvyn_last_job',
} as const

export type Config = typeof CONFIG
