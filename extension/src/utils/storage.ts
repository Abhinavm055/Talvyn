import { CONFIG } from './config'
import { StorageData, AuthUser } from '../types'
import {
  isExtensionContextValid,
  isExtensionContextInvalidated,
  shutdownExtensionRuntime,
} from './extensionContext'

/**
 * Authoritative Talvyn Extension Authentication Session Contract
 */
export interface TalvynAuthSession {
  token: string
  refreshToken?: string
  sessionId?: string
  accessExpiresAt?: number
  user: AuthUser
  connectedAt: string
}

export const STORAGE_KEYS = {
  AUTH: 'talvynAuth',
  TOKEN: CONFIG.STORAGE_KEY_TOKEN, // 'talvyn_token'
  USER: CONFIG.STORAGE_KEY_USER,   // 'talvyn_user'
  LAST_JOB: CONFIG.STORAGE_KEY_LAST_JOB,
} as const

/**
 * Retrieves authoritative session from chrome.storage.local.
 * Safe against extension context invalidation.
 */
export async function getAuthSession(): Promise<TalvynAuthSession | null> {
  if (!isExtensionContextValid() || !isTrustedStorageContext()) {
    return null
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return null
    }
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
    ])

    const auth = result[STORAGE_KEYS.AUTH]
    if (auth && typeof auth === 'object' && auth.token) {
      return auth as TalvynAuthSession
    }

    // Website JWT copies cannot become independent extension sessions.
    return null
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      shutdownExtensionRuntime()
      return null
    }
    console.error('[Talvyn] Failed to read from chrome.storage.local:', err)
    return null
  }
}

/**
 * Sets authoritative session in chrome.storage.local.
 * Safe against extension context invalidation.
 */
export async function setAuthSession(session: TalvynAuthSession): Promise<void> {
  if (!isExtensionContextValid() || !isTrustedStorageContext()) {
    return
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH]: session,
    })
    await chrome.storage.local.remove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER])
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      shutdownExtensionRuntime()
      return
    }
    console.error('[Talvyn] Failed to write to chrome.storage.local:', err)
    throw err
  }
}

export async function getUser(): Promise<AuthUser | null> {
  if (!isExtensionContextValid()) return null
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH' })
    return response?.success && response.authenticated ? response.user ?? null : null
  } catch (error) {
    if (isExtensionContextInvalidated(error)) shutdownExtensionRuntime()
    return null
  }
}

function isTrustedStorageContext(): boolean {
  return typeof location === 'undefined' || location.protocol === 'chrome-extension:'
}

export async function clearAuth(): Promise<void> {
  if (!isExtensionContextValid() || !isTrustedStorageContext()) {
    return
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
    ])
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      shutdownExtensionRuntime()
      return
    }
    console.error('[Talvyn] Failed to clear chrome.storage.local:', err)
  }
}

export async function getStorageData(): Promise<StorageData> {
  const user = await getUser()
  let lastDetectedJob = null
  let lastScanSummary = null

  if (isExtensionContextValid()) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res = await chrome.storage.local.get([STORAGE_KEYS.LAST_JOB, 'talvyn_last_scan_summary'])
        lastDetectedJob = res[STORAGE_KEYS.LAST_JOB] ?? null
        lastScanSummary = res.talvyn_last_scan_summary ?? null
      }
    } catch (err) {
      if (isExtensionContextInvalidated(err)) {
        shutdownExtensionRuntime()
      }
    }
  }

  return {
    user,
    lastDetectedJob,
    lastScanSummary,
  }
}

