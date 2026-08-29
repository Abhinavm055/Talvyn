/**
 * Talvyn Extension – Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Validate stored token on startup / install
 * - Route messages between popup and content scripts
 * - Handle authentication state changes
 * - Set extension badge to reflect auth state
 */

import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage'
import { authService } from '../services/authService'
import { ExtensionMessage } from '../types'

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('[Talvyn] Extension installed')
    await clearAuth()
    setBadge('off')
  }
  await validateStoredToken()
})

chrome.runtime.onStartup.addListener(async () => {
  await validateStoredToken()
})

// ─── Token Validation ─────────────────────────────────────────────────────────

async function validateStoredToken(): Promise<void> {
  const token = await getToken()
  if (!token) {
    setBadge('off')
    return
  }
  try {
    const user = await authService.me()
    await setUser(user)
    setBadge('on')
    console.log('[Talvyn] Token valid, logged in as', user.email)
  } catch (err) {
    console.warn('[Talvyn] Stored token invalid, clearing auth')
    await clearAuth()
    setBadge('off')
  }
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function setBadge(state: 'on' | 'off'): void {
  if (state === 'on') {
    chrome.action.setBadgeText({ text: '✓' })
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }) // primary indigo
  } else {
    chrome.action.setBadgeText({ text: '' })
  }
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ type: 'ERROR', error: String(err) }))
    // Return true to keep the message channel open for async response
    return true
  }
)

async function handleMessage(msg: ExtensionMessage): Promise<ExtensionMessage> {
  switch (msg.type) {
    case 'GET_AUTH': {
      const token = await getToken()
      const user = await getUser()
      return {
        type: 'AUTH_STATE',
        payload: { isAuthenticated: !!token && !!user, user },
      }
    }

    default:
      return { type: 'ERROR', error: `Unknown message type: ${msg.type}` }
  }
}

export {}
