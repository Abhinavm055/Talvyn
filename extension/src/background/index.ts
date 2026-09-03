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

// ─── Extension Action (Icon Click) ────────────────────────────────────────────
// Flow: Extension icon click -> gets active tab -> sends TALVYN_OPEN_INTELLIGENCE_PANEL
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  const tabId = tab.id
  console.log('[Talvyn] Extension icon clicked on tab:', tabId, tab.url)

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
      tabUrl: tab.url,
      tabTitle: tab.title,
    })
    console.log('[Talvyn] TALVYN_OPEN_INTELLIGENCE_PANEL responded:', response)
  } catch (err: any) {
    console.log('[Talvyn] Content script not reachable directly, attempting programmatic injection:', err?.message || err)
    if (
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('edge://') ||
      tab.url?.startsWith('about:')
    ) {
      console.warn('[Talvyn] Cannot inject content script into browser internal page:', tab.url)
      return
    }

    try {
      if (chrome.scripting?.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/index.ts'],
        })
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
              tabUrl: tab.url,
              tabTitle: tab.title,
            })
          } catch {
            /* retry completed */
          }
        }, 300)
      }
    } catch (injectErr) {
      console.error('[Talvyn] Failed to inject content script:', injectErr)
    }
  }
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
  (message: any, _sender, sendResponse) => {
    handleInternalMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: String(err?.message || err) }))
    return true
  }
)

async function handleInternalMessage(msg: any): Promise<any> {
  if (!msg || typeof msg !== 'object') {
    return { success: false, error: 'Invalid message payload' }
  }

  // 1. TALVYN_API_REQUEST — Generic background proxy for content script API requests
  if (msg.type === 'TALVYN_API_REQUEST') {
    const session = await getAuthSession()
    const token = session?.token
    const method = (msg.method || 'GET').toUpperCase()
    const path = msg.path || ''
    const url = `${CONFIG.API_BASE}${path}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(msg.headers || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      }

      if (msg.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body)
      }

      const response = await fetch(url, fetchOptions)

      if (!response.ok) {
        let errorBody: any = {}
        try {
          errorBody = await response.json()
        } catch {
          /* non-JSON error body */
        }

        if (response.status === 401) {
          return {
            success: false,
            status: 401,
            error: 'Your Talvyn session expired',
            body: errorBody,
          }
        }
        if (response.status === 403) {
          return {
            success: false,
            status: 403,
            error: "You don't have permission to save this job",
            body: errorBody,
          }
        }
        if (response.status === 409) {
          return {
            success: false,
            status: 409,
            error: 'This job is already saved',
            body: errorBody,
          }
        }
        if (response.status === 422) {
          return {
            success: false,
            status: 422,
            error: errorBody.error || 'Missing required job information',
            body: errorBody,
          }
        }
        if (response.status >= 500) {
          return {
            success: false,
            status: response.status,
            error: "Talvyn couldn't save this job. Try again.",
            body: errorBody,
          }
        }

        return {
          success: false,
          status: response.status,
          error: errorBody.error || "Talvyn couldn't save this job. Try again.",
          body: errorBody,
        }
      }

      if (response.status === 204) {
        return { success: true, status: 204, data: undefined }
      }

      const data = await response.json()
      return { success: true, status: response.status, data }
    } catch (err: any) {
      console.error('[Talvyn] Background API proxy error:', err?.message || err)
      return {
        success: false,
        status: 0,
        error: 'Connection problem. Your job will retry.',
      }
    }
  }

  // 2. TALVYN_SAVE_JOB / SAVE_JOB
  if (msg.type === 'TALVYN_SAVE_JOB' || msg.type === 'SAVE_JOB') {
    try {
      const session = await getAuthSession()
      if (!session?.token) {
        return {
          success: false,
          status: 401,
          error: 'Your Talvyn session expired',
        }
      }

      const payload = msg.payload || msg.job
      const url = `${CONFIG.API_BASE}/api/jobs`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errBody: any = {}
        try { errBody = await res.json() } catch {}
        if (res.status === 401) return { success: false, status: 401, error: 'Your Talvyn session expired', body: errBody }
        if (res.status === 403) return { success: false, status: 403, error: "You don't have permission to save this job", body: errBody }
        if (res.status === 409) return { success: false, status: 409, error: 'This job is already saved', body: errBody, job: errBody.job }
        if (res.status === 422) return { success: false, status: 422, error: errBody.error || 'Missing required job information', body: errBody }
        if (res.status >= 500) return { success: false, status: res.status, error: "Talvyn couldn't save this job. Try again.", body: errBody }
        return {
          success: false,
          status: res.status,
          error: errBody.error || "Talvyn couldn't save this job. Try again.",
          body: errBody,
        }
      }

      const savedJob = await res.json()
      return { success: true, data: savedJob, job: savedJob }
    } catch (err: any) {
      console.error('[Talvyn] Save job error in background worker:', err?.message || err)
      return {
        success: false,
        status: 500,
        error: "Couldn't save this job. Please try again.",
      }
    }
  }

  // 3. TALVYN_CHECK_DUPLICATE / CHECK_DUPLICATE
  if (msg.type === 'TALVYN_CHECK_DUPLICATE' || msg.type === 'CHECK_DUPLICATE') {
    try {
      const session = await getAuthSession()
      if (!session?.token) {
        return { success: true, data: { exists: false, job: null } }
      }

      const targetUrl = msg.payload?.url || msg.url
      const url = `${CONFIG.API_BASE}/api/jobs/check-url?url=${encodeURIComponent(targetUrl)}`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
      })

      if (!res.ok) {
        return { success: true, data: { exists: false, job: null } }
      }

      const data = await res.json()
      return { success: true, data, payload: data }
    } catch {
      return { success: true, data: { exists: false, job: null } }
    }
  }

  // 4. GET_AUTH
  if (msg.type === 'GET_AUTH') {
    const session = await getAuthSession()
    return {
      type: 'AUTH_STATE',
      payload: {
        isAuthenticated: Boolean(session?.token),
        user: session?.user || null,
      },
    }
  }

  return { success: false, error: `Unknown internal message type: ${msg.type}` }
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

