/**
 * Talvyn Extension – Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Validate stored session on startup / install
 * - Route external messages from Talvyn web app via externally_connectable
 * - Authoritative token verification against live backend (/api/auth/me)
 * - Persist session to chrome.storage.local (talvynAuth)
 * - Set extension badge to reflect auth state
 */

import {
  getAuthSession,
  setAuthSession,
  clearAuth,
  getToken,
  getUser,
} from '../utils/storage'
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
  const session = await getAuthSession()
  if (!session?.token) {
    setBadge('off')
    return
  }
  try {
    const user = await authService.me()
    await setAuthSession({
      token: session.token,
      user,
      connectedAt: session.connectedAt || new Date().toISOString(),
    })
    setBadge('on')
    console.log('[Talvyn] Token valid, logged in as', user.email)
  } catch (err: any) {
    // Only clear if 401 or 403 unauthorized
    if (err?.status === 401 || err?.status === 403) {
      console.warn('[Talvyn] Stored token expired/invalid, clearing auth')
      await clearAuth()
      setBadge('off')
    } else {
      console.warn('[Talvyn] Token validation check failed due to network/cold start, retaining session:', err?.message || err)
    }
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
    return true
  }
)

async function handleMessage(msg: ExtensionMessage): Promise<ExtensionMessage> {
  switch (msg.type) {
    case 'GET_AUTH': {
      const session = await getAuthSession()
      return {
        type: 'AUTH_STATE',
        payload: {
          isAuthenticated: Boolean(session?.token),
          user: session?.user || null,
        },
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
        const session = await getAuthSession()
        sendResponse({
          success: true,
          installed: true,
          version: '1.0.0',
          connected: Boolean(session?.token),
          email: session?.user?.email || null,
        })
      })()
      return true
    }

    // 2. Connect Account with Token Verification
    if (message.type === 'TALVYN_CONNECT_EXTENSION') {
      console.log('[Talvyn] CONNECTION_REQUEST_RECEIVED')
      const { token, user } = message
      if (!token) {
        sendResponse({ success: false, error: 'Missing token in connection request' })
        return false
      }

      (async () => {
        try {
          console.log('[Talvyn] TOKEN_VALIDATION_STARTED')
          // Live verification against backend before marking connected
          const verifyResponse = await fetch(`${CONFIG.API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!verifyResponse.ok) {
            console.warn('[Talvyn] Token verification rejected by backend with status:', verifyResponse.status)
            sendResponse({ success: false, error: 'Token verification failed with backend' })
            return
          }

          const verifiedUser = await verifyResponse.json()
          console.log('[Talvyn] TOKEN_VALIDATION_SUCCESS')

          const authSession = {
            token,
            user: verifiedUser || user,
            connectedAt: new Date().toISOString(),
          }

          await setAuthSession(authSession)
          console.log('[Talvyn] SESSION_STORED')

          setBadge('on')
          console.log('[Talvyn] Successfully connected Talvyn account for:', verifiedUser?.email || user?.email)

          sendResponse({
            success: true,
            user: verifiedUser || user,
            message: 'Extension connected successfully',
          })
        } catch (err: any) {
          console.error('[Talvyn] Connection verification error:', err?.message || err)
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
        const session = await getAuthSession()
        sendResponse({
          success: true,
          connected: Boolean(session?.token),
          user: session?.user || null,
        })
      })()
      return true
    }

    sendResponse({ success: false, error: `Unknown external message type: ${message.type}` })
    return false
  }
)

export {}


