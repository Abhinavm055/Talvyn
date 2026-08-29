import { CONFIG } from './config'
import { StorageData, AuthUser } from '../types'

/**
 * Chrome storage helpers — all async wrappers around chrome.storage.local.
 * Using `local` (not `sync`) for security: tokens must not leave the device.
 */

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY_TOKEN)
  return result[CONFIG.STORAGE_KEY_TOKEN] ?? null
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEY_TOKEN]: token })
}

export async function getUser(): Promise<AuthUser | null> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY_USER)
  return result[CONFIG.STORAGE_KEY_USER] ?? null
}

export async function setUser(user: AuthUser): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEY_USER]: user })
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    CONFIG.STORAGE_KEY_TOKEN,
    CONFIG.STORAGE_KEY_USER,
  ])
}

export async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get([
    CONFIG.STORAGE_KEY_TOKEN,
    CONFIG.STORAGE_KEY_USER,
    CONFIG.STORAGE_KEY_LAST_JOB,
  ])
  return {
    token: result[CONFIG.STORAGE_KEY_TOKEN] ?? null,
    user: result[CONFIG.STORAGE_KEY_USER] ?? null,
    lastDetectedJob: result[CONFIG.STORAGE_KEY_LAST_JOB] ?? null,
  }
}
