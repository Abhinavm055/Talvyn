import { CONFIG } from './config'
import { StorageData, AuthUser } from '../types'

/**
 * Authoritative Talvyn Extension Authentication Session Contract
 */
export interface TalvynAuthSession {
  token: string
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
 */
export async function getAuthSession(): Promise<TalvynAuthSession | null> {
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

    const legacyToken = result[STORAGE_KEYS.TOKEN]
    const legacyUser = result[STORAGE_KEYS.USER]
    if (legacyToken) {
      return {
        token: legacyToken,
        user: legacyUser || { id: 'unknown', email: '', authProvider: 'EMAIL', profile: null },
        connectedAt: new Date().toISOString(),
      }
    }
    return null
  } catch (err) {
    console.error('[Talvyn] Failed to read from chrome.storage.local:', err)
    return null
  }
}

/**
 * Sets authoritative session in chrome.storage.local.
 */
export async function setAuthSession(session: TalvynAuthSession): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH]: session,
      [STORAGE_KEYS.TOKEN]: session.token,
      [STORAGE_KEYS.USER]: session.user,
    })
  } catch (err) {
    console.error('[Talvyn] Failed to write to chrome.storage.local:', err)
    throw err
  }
}

export async function getToken(): Promise<string | null> {
  const session = await getAuthSession()
  return session?.token ?? null
}

export async function setToken(token: string): Promise<void> {
  const session = await getAuthSession()
  const user = session?.user || { id: 'unknown', email: '', authProvider: 'EMAIL', profile: null }
  await setAuthSession({
    token,
    user,
    connectedAt: session?.connectedAt || new Date().toISOString(),
  })
}

export async function getUser(): Promise<AuthUser | null> {
  const session = await getAuthSession()
  return session?.user ?? null
}

export async function setUser(user: AuthUser): Promise<void> {
  const session = await getAuthSession()
  if (!session?.token) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER]: user })
    return
  }
  await setAuthSession({
    token: session.token,
    user,
    connectedAt: session.connectedAt,
  })
}

export async function clearAuth(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
    ])
  } catch (err) {
    console.error('[Talvyn] Failed to clear chrome.storage.local:', err)
  }
}

export async function getStorageData(): Promise<StorageData> {
  const session = await getAuthSession()
  let lastDetectedJob = null
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(STORAGE_KEYS.LAST_JOB)
      lastDetectedJob = res[STORAGE_KEYS.LAST_JOB] ?? null
    }
  } catch {}

  return {
    token: session?.token ?? null,
    user: session?.user ?? null,
    lastDetectedJob,
  }
}

