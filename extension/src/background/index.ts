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
import { CONFIG } from '../utils/config'
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

// ─── Internal Message Router (Popup & Content Scripts) ────────────────────────

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

// ─── External Web App Messaging (Externally Connectable) ──────────────────────

const ALLOWED_WEB_ORIGINS = [
  'https://talvyn.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
]

function isOriginAllowed(senderUrl?: string): boolean {
  if (!senderUrl) return false
  try {
    const parsed = new URL(senderUrl)
    const origin = parsed.origin
    return ALLOWED_WEB_ORIGINS.some((allowed) => allowed === origin)
  } catch {
    return false
  }
}

chrome.runtime.onMessageExternal.addListener(
  (message: any, sender, sendResponse) => {
    const senderUrl = sender.url || sender.origin
    if (!isOriginAllowed(senderUrl)) {
      console.warn('[Talvyn] Rejected external message from unauthorized origin:', senderUrl)
      sendResponse({ success: false, error: 'Unauthorized origin' })
      return false
    }

    if (!message || typeof message !== 'object') {
      sendResponse({ success: false, error: 'Invalid message payload' })
      return false
    }

    // 1. Status Ping / Discovery
    if (message.type === 'TALVYN_PING_EXTENSION') {
      (async () => {
        const token = await getToken()
        const user = await getUser()
        sendResponse({
          success: true,
          installed: true,
          version: '1.0.0',
          connected: Boolean(token),
          email: user?.email || null,
        })
      })()
      return true
    }

    // 2. Connect Account with Token Verification
    if (message.type === 'TALVYN_CONNECT_EXTENSION') {
      const { token, user } = message
      if (!token) {
        sendResponse({ success: false, error: 'Missing token in connection request' })
        return false
      }

      (async () => {
        try {
          // Live verification against backend before marking connected
          const verifyResponse = await fetch(`${CONFIG.API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!verifyResponse.ok) {
            sendResponse({ success: false, error: 'Token verification failed with backend' })
            return
          }

          const verifiedUser = await verifyResponse.json()
          await setToken(token)
          await setUser(verifiedUser || user)
          setBadge('on')
          console.log('[Talvyn] Successfully connected Talvyn account for:', verifiedUser?.email || user?.email)

          sendResponse({
            success: true,
            user: verifiedUser || user,
            message: 'Extension connected successfully',
          })
        } catch (err: any) {
          console.error('[Talvyn] Connection verification error:', err)
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : 'Token verification failed',
          })
        }
      })()
      return true
    }

    // 3. Disconnect Extension
    if (message.type === 'TALVYN_DISCONNECT_EXTENSION') {
      (async () => {
        await clearAuth()
        setBadge('off')
        console.log('[Talvyn] Extension disconnected from web dashboard')
        sendResponse({ success: true, message: 'Extension disconnected' })
      })()
      return true
    }

    // 4. Get Status
    if (message.type === 'TALVYN_GET_STATUS') {
      (async () => {
        const token = await getToken()
        const user = await getUser()
        sendResponse({
          success: true,
          connected: Boolean(token),
          user: user || null,
        })
      })()
      return true
    }

    sendResponse({ success: false, error: `Unknown external message type: ${message.type}` })
    return false
  }
)

export {}

