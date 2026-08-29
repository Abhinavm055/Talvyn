/**
 * Talvyn Extension Debug Logger (Phase 2F)
 * Controlled via localStorage.getItem('TALVYN_DEBUG') === 'true' or global flag.
 * Disabled by default in production.
 */

declare global {
  interface Window {
    __TALVYN_DEBUG__?: boolean
  }
}

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__TALVYN_DEBUG__) return true
  try {
    return localStorage.getItem('TALVYN_DEBUG') === 'true'
  } catch {
    return false
  }
}

export function enableDebugMode(): void {
  if (typeof window !== 'undefined') {
    window.__TALVYN_DEBUG__ = true
    try {
      localStorage.setItem('TALVYN_DEBUG', 'true')
    } catch {}
    console.log('[Talvyn DEBUG] Debug mode enabled.')
  }
}

export function disableDebugMode(): void {
  if (typeof window !== 'undefined') {
    window.__TALVYN_DEBUG__ = false
    try {
      localStorage.removeItem('TALVYN_DEBUG')
    } catch {}
    console.log('[Talvyn DEBUG] Debug mode disabled.')
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.log('[Talvyn DEBUG]', ...args)
    }
  },
  info: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.info('[Talvyn INFO]', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.warn('[Talvyn WARN]', ...args)
    }
  },
  error: (...args: unknown[]) => {
    console.error('[Talvyn ERROR]', ...args)
  },
}
