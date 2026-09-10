/**
 * Talvyn Browser Extension Popup
 *
 * Implements a strict authentication state machine:
 * loading -> (chrome.storage.local check) -> connected | disconnected | expired
 *
 * Provides real-time connection status with the user's Talvyn backend,
 * live health verification, user session display, and quick dashboard navigation.
 */

import { jobsService } from '../services/jobsService'
import { AuthUser, Job } from '../types'

type PopupState = 'loading' | 'disconnected' | 'connected' | 'expired' | 'error'

let currentState: PopupState = 'loading'
let currentUser: AuthUser | null = null
let isOfflineMode = false
const app = document.getElementById('app')!

function getLogoUrl(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('icons/logotalvyn.png')
    }
  } catch {
    /* fallback */
  }
  return '/icons/logotalvyn.png'
}

function getFallbackIconUrl(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('icons/icon48.png')
    }
  } catch {
    /* fallback */
  }
  return '/icons/icon48.png'
}

/**
 * Communicates with extension background service worker.
 */
async function sendBackgroundMessage<T = any>(message: any): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage(message)
      return response as T
    } catch (err) {
      console.warn('[Talvyn Popup] Background message failed:', err)
      throw err
    }
  }
  throw new Error('Chrome runtime unavailable')
}

/**
 * Triggers route opening via background service worker.
 */
async function openDashboardRoute(route: 'dashboard' | 'profile' | 'tracker' | 'settings'): Promise<void> {
  try {
    await sendBackgroundMessage({
      type: 'OPEN_DASHBOARD_ROUTE',
      route,
    })
  } catch {
    const fallbackUrls: Record<string, string> = {
      dashboard: 'https://talvyn.vercel.app/dashboard',
      profile: 'https://talvyn.vercel.app/profile',
      tracker: 'https://talvyn.vercel.app/tracker',
      settings: 'https://talvyn.vercel.app/extensions',
    }
    window.open(fallbackUrls[route] || 'https://talvyn.vercel.app/dashboard', '_blank')
  }
}

/**
 * Triggers account connection via background service worker.
 */
async function triggerConnectAccount(): Promise<void> {
  try {
    await sendBackgroundMessage({
      type: 'CONNECT_TALVYN',
    })
  } catch {
    const extId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : ''
    const url = extId
      ? `https://talvyn.vercel.app/extension/connect?extId=${encodeURIComponent(extId)}`
      : `https://talvyn.vercel.app/extension/connect`
    window.open(url, '_blank')
  }
}

/**
 * Triggers disconnect via background service worker.
 */
async function triggerDisconnectAccount(): Promise<void> {
  try {
    await sendBackgroundMessage({
      type: 'DISCONNECT_TALVYN',
    })
  } catch (err) {
    console.warn('[Talvyn Popup] Failed to disconnect via background:', err)
  }
  currentState = 'disconnected'
  currentUser = null
  renderDisconnected()
}

/**
 * Triggers the floating intelligence panel on the active webpage.
 * Automatically runs whenever popup opens so BOTH popup and floating window are displayed!
 */
export async function triggerActiveTabIntelligencePanel(): Promise<void> {
  console.log('[Talvyn] Analyze button clicked')
  console.log('[Talvyn Popup] Triggering floating intelligence panel on active tab...')
  try {
    let activeTab: chrome.tabs.Tab | null = null

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      // 1. Try lastFocusedWindow first (standard for popups to target the webpage the user was viewing)
      const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (lastFocusedTabs[0]?.id) {
        activeTab = lastFocusedTabs[0]
      } else {
        // 2. Fallback to currentWindow
        const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (currentWindowTabs[0]?.id) {
          activeTab = currentWindowTabs[0]
        } else {
          // 3. Fallback to any active tab
          const anyActive = await chrome.tabs.query({ active: true })
          if (anyActive[0]?.id) {
            activeTab = anyActive[0]
          }
        }
      }
    }

    if (!activeTab?.id) {
      console.warn('[Talvyn Popup] Active tab not found directly via tabs.query; delegating to background worker...')
      try {
        const bgRes = await sendBackgroundMessage<{ success: boolean; error?: string }>({
          type: 'TRIGGER_ACTIVE_TAB_PANEL',
        })
        console.log('[Talvyn] Background panel trigger response:', bgRes)
      } catch (bgErr) {
        console.error('[Talvyn Popup] Background panel trigger failed:', bgErr)
      }
      return
    }

    const tabUrl = activeTab.url || ''
    const tabTitle = activeTab.title || ''
    console.log(`[Talvyn] Active tab: ${tabUrl || `tabId ${activeTab.id}`}`)
    console.log('[Talvyn] Sending TALVYN_OPEN_INTELLIGENCE_PANEL')

    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
        tabUrl,
        tabTitle,
      })
      console.log('[Talvyn] TALVYN_OPEN_INTELLIGENCE_PANEL acknowledged by content script:', response)
    } catch (sendErr: any) {
      console.warn('[Talvyn] chrome.tabs.sendMessage failed directly on active tab:', sendErr?.message || sendErr)
      console.log(`[Talvyn] Content script not reachable on tab ${activeTab.id}. Attempting injection & background delegation...`)

      // Attempt programmatic injection from popup if scripting API is available
      if (typeof chrome !== 'undefined' && chrome.scripting?.executeScript) {
        try {
          const manifest = chrome.runtime.getManifest()
          const files = manifest.content_scripts?.[0]?.js || []
          if (files.length > 0) {
            console.log('[Talvyn] Programmatically injecting content script files from popup:', files)
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files,
            })
            // Allow loader to import bundle and register listeners
            for (let attempt = 1; attempt <= 3; attempt++) {
              await new Promise((r) => setTimeout(r, attempt * 150))
              try {
                const retryRes = await chrome.tabs.sendMessage(activeTab.id, {
                  type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
                  tabUrl,
                  tabTitle,
                })
                console.log('[Talvyn] TALVYN_OPEN_INTELLIGENCE_PANEL retry succeeded after direct injection:', retryRes)
                return
              } catch {
                /* retry */
              }
            }
          }
        } catch (injectErr: any) {
          console.warn('[Talvyn] Popup-level script injection error:', injectErr?.message || injectErr)
        }
      }

      // Delegate to background worker with explicit tabId, tabUrl, tabTitle
      try {
        const bgRes = await sendBackgroundMessage<{ success: boolean; error?: string }>({
          type: 'TRIGGER_ACTIVE_TAB_PANEL',
          tabId: activeTab.id,
          tabUrl,
          tabTitle,
        })
        console.log('[Talvyn] Background panel trigger response:', bgRes)
        if (!bgRes?.success) {
          console.error('[Talvyn] Failed to trigger panel via background worker:', bgRes?.error)
        }
      } catch (bgErr: any) {
        console.error('[Talvyn] Background panel trigger exception:', bgErr?.message || bgErr)
      }
    }
  } catch (err: any) {
    console.error('[Talvyn Popup] Failed to trigger active tab floating window:', err?.message || err)
  }
}

// ─── Initializer & State Machine ──────────────────────────────────────────────

async function init() {
  console.log('[Talvyn] POPUP_AUTH_CHECK_STARTED')
  renderLoading()

  try {
    const response = await sendBackgroundMessage<{
      success: boolean
      state?: 'connected' | 'disconnected' | 'expired' | 'error'
      user?: AuthUser | null
      token?: string | null
      isOffline?: boolean
      error?: string
    }>({ type: 'GET_AUTH_STATUS' })

    if (!response || !response.success) {
      currentState = 'error'
      renderError(response?.error || 'Could not verify connection status.')
      return
    }

    if (response.state === 'connected' && response.user) {
      console.log('[Talvyn] SESSION_FOUND')
      console.log('[Talvyn] SESSION_VALID')
      currentState = 'connected'
      currentUser = response.user
      isOfflineMode = Boolean(response.isOffline)
      renderConnected(response.user, { isOffline: isOfflineMode })
    } else if (response.state === 'expired') {
      console.log('[Talvyn] SESSION_EXPIRED')
      currentState = 'expired'
      renderExpired()
    } else {
      currentState = 'disconnected'
      renderDisconnected()
    }
  } catch (err: any) {
    console.error('[Talvyn Popup] Error communicating with background worker:', err)
    currentState = 'error'
    renderError(err?.message || 'Unable to connect to extension service worker.')
  }
}

// ─── Loading View ─────────────────────────────────────────────────────────────

function renderLoading() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:28px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <img
        src="${logoUrl}"
        alt="Talvyn"
        onerror="this.onerror=null;this.src='${fallbackUrl}';"
        style="width:48px;height:48px;border-radius:12px;box-shadow:0 4px 12px rgba(99,102,241,0.25);margin-bottom:16px;object-fit:contain;"
      />
      <div style="font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px;">Talvyn</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px;">Connecting...</div>
      <div style="width:26px;height:26px;border:2.5px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </div>
  `
}

// ─── Disconnected View ────────────────────────────────────────────────────────

function renderDisconnected() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:20px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:380px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Brand Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#f1f5f9;
            color:#64748b;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
            Not connected
          </div>
        </div>

        <!-- Connection Notice Card -->
        <div style="
          padding:14px;background:linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          border:1px solid #e0e7ff;border-radius:12px;margin-bottom:16px;text-align:center;
        ">
          <div style="font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:4px;">
            Connect your Talvyn Account
          </div>
          <div style="font-size:11.5px;color:#475569;line-height:1.45;">
            Authorize the extension to capture jobs, sync profile data, and manage your applications seamlessly.
          </div>
        </div>

        <!-- Primary Connect Action Button -->
        <button type="button" id="connect-account-btn" style="
          width:100%;padding:12px 14px;background:linear-gradient(to right, #4f46e5, #6366f1);color:white;
          border:none;border-radius:10px;font-size:13px;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:8px;
          cursor:pointer;margin-bottom:14px;box-shadow:0 3px 8px rgba(79,70,229,0.3);transition:all 0.15s;
        ">
          <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Connect Talvyn</span>
        </button>

        <div style="font-size:11px;color:#64748b;text-align:center;line-height:1.4;">
          Opens your Talvyn dashboard to link your account securely.
        </div>
      </div>

      <!-- Footer Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Don't have an account?</span>
        <button type="button" id="signup-btn" style="
          background:none;border:none;padding:0;font-size:10px;color:#4f46e5;font-weight:600;cursor:pointer;
        ">Create Free Account →</button>
      </div>
    </div>
  `

  document.getElementById('connect-account-btn')?.addEventListener('click', () => {
    triggerConnectAccount()
  })

  document.getElementById('signup-btn')?.addEventListener('click', () => {
    triggerConnectAccount()
  })
}

// ─── Expired View ─────────────────────────────────────────────────────────────

function renderExpired() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:20px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:380px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Brand Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#fef3c7;
            color:#b45309;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
            Session expired
          </div>
        </div>

        <!-- Expired Notice Box -->
        <div style="
          margin-bottom:14px;padding:12px;background:#fffbeb;
          border:1px solid #fef3c7;border-radius:10px;font-size:11.5px;color:#b45309;
          display:flex;align-items:flex-start;gap:8px;line-height:1.45;
        ">
          <span style="font-size:14px;">⚠️</span>
          <div>
            <div style="font-weight:700;margin-bottom:2px;">Session Expired</div>
            Your Talvyn session has expired. Please reconnect your account to continue capturing and tracking jobs.
          </div>
        </div>

        <!-- Reconnect Action Button -->
        <button type="button" id="reconnect-account-btn" style="
          width:100%;padding:12px 14px;background:linear-gradient(to right, #4f46e5, #6366f1);color:white;
          border:none;border-radius:10px;font-size:13px;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:8px;
          cursor:pointer;margin-bottom:14px;box-shadow:0 3px 8px rgba(79,70,229,0.3);transition:all 0.15s;
        ">
          <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Reconnect Talvyn</span>
        </button>
      </div>

      <!-- Footer Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Need help?</span>
        <button type="button" id="open-dash-footer-btn" style="
          background:none;border:none;padding:0;font-size:10px;color:#4f46e5;font-weight:600;cursor:pointer;
        ">Open Dashboard →</button>
      </div>
    </div>
  `

  document.getElementById('reconnect-account-btn')?.addEventListener('click', () => {
    triggerConnectAccount()
  })

  document.getElementById('open-dash-footer-btn')?.addEventListener('click', () => {
    openDashboardRoute('dashboard')
  })
}

// ─── Error View ───────────────────────────────────────────────────────────────

function renderError(message: string) {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:20px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:380px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Brand Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#fee2e2;
            color:#b91c1c;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
            Unable to connect
          </div>
        </div>

        <!-- Error Notice Box -->
        <div style="
          margin-bottom:14px;padding:12px;background:#fef2f2;
          border:1px solid #fee2e2;border-radius:10px;font-size:11.5px;color:#b91c1c;
          display:flex;align-items:flex-start;gap:8px;line-height:1.45;
        ">
          <span style="font-size:14px;">⚠️</span>
          <div>
            <div style="font-weight:700;margin-bottom:2px;">Connection Issue</div>
            ${message}
          </div>
        </div>

        <!-- Retry Button -->
        <button type="button" id="retry-btn" style="
          width:100%;padding:12px 14px;background:#f1f5f9;color:#334155;
          border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:8px;
          cursor:pointer;margin-bottom:10px;transition:all 0.15s;
        ">
          <span>Try Again</span>
        </button>

        <button type="button" id="connect-fallback-btn" style="
          width:100%;padding:12px 14px;background:linear-gradient(to right, #4f46e5, #6366f1);color:white;
          border:none;border-radius:10px;font-size:13px;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:8px;
          cursor:pointer;box-shadow:0 3px 8px rgba(79,70,229,0.3);transition:all 0.15s;
        ">
          <span>Connect Talvyn</span>
        </button>
      </div>

      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;text-align:center;">
        <span style="font-size:10px;color:#64748b;">Ensure your Talvyn backend is running.</span>
      </div>
    </div>
  `

  document.getElementById('retry-btn')?.addEventListener('click', () => {
    init()
  })

  document.getElementById('connect-fallback-btn')?.addEventListener('click', () => {
    triggerConnectAccount()
  })
}

// ─── Connected Dashboard View ─────────────────────────────────────────────────

function renderConnected(user: AuthUser, options: { isOffline?: boolean } = {}) {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  const displayName =
    user.profile?.preferredName ||
    user.profile?.givenName ||
    user.profile?.legalFullName ||
    user.email.split('@')[0]

  const avatarUrl = user.profile?.avatarUrl

  app.innerHTML = `
    <div style="padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:380px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Top Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:30px;height:30px;border-radius:8px;box-shadow:0 2px 4px rgba(99,102,241,0.2);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:13px;color:#0f172a;">Talvyn</div>
              <div style="font-size:10px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:${options.isOffline ? '#fef3c7' : '#ecfdf5'};
            color:${options.isOffline ? '#b45309' : '#059669'};font-size:10px;font-weight:700;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:${options.isOffline ? '#f59e0b' : '#10b981'};display:inline-block;"></span>
            ${options.isOffline ? 'Offline' : 'Connected'}
          </div>
        </div>

        <!-- User Identity Card -->
        <div style="
          display:flex;align-items:center;gap:10px;padding:10px 12px;
          background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;
        ">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="${displayName}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #cbd5e1;flex-shrink:0;" />`
              : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg, #6366f1, #8b5cf6);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${(displayName[0] || 'U').toUpperCase()}</div>`
          }
          <div style="min-width:0;flex:1;">
            <div style="font-weight:700;font-size:12.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div>
            <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email}</div>
          </div>
        </div>

        <!-- Primary Action Button: Analyze This Page -->
        <button type="button" id="btn-analyze-page" style="
          width:100%;margin-bottom:12px;padding:11px 14px;background:linear-gradient(135deg, #4f46e5, #6366f1);
          color:white;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 2px 6px rgba(79,70,229,0.3);
          transition:opacity 0.15s;
        ">
          <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Analyze This Page</span>
        </button>

        <!-- 4 Core Navigation Route Buttons: Dashboard, Profile, Tracker, Settings -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <button type="button" id="btn-open-dashboard" style="
            padding:9px 10px;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Dashboard</span>
            <svg style="width:12px;height:12px;color:#64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>

          <button type="button" id="btn-open-profile" style="
            padding:9px 10px;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Profile</span>
            <svg style="width:12px;height:12px;color:#64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>

          <button type="button" id="btn-open-tracker" style="
            padding:9px 10px;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Tracker</span>
            <svg style="width:12px;height:12px;color:#64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </button>

          <button type="button" id="btn-open-settings" style="
            padding:9px 10px;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Settings</span>
            <svg style="width:12px;height:12px;color:#64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>
        </div>

        <!-- Recent Saved Jobs Section -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            Recent Saved Jobs
          </div>
          <div id="recent-jobs" style="min-height:60px;">
            <div style="font-size:11px;color:#94a3b8;text-align:center;padding:12px 0;">Loading jobs...</div>
          </div>
        </div>
      </div>

      <!-- Footer / Disconnect Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <button type="button" id="disconnect-btn" style="
          background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:0;
          font-weight:500;transition:color 0.15s;
        ">
          Disconnect Account
        </button>

        <span style="font-size:10px;color:#cbd5e1;">Talvyn v1.1</span>
      </div>
    </div>
  `

  const analyzeBtn = (document.getElementById('btn-analyze-page') || document.getElementById('btn-open-floating')) as HTMLButtonElement | null
  analyzeBtn?.addEventListener('click', async () => {
    const originalContent = analyzeBtn.innerHTML
    analyzeBtn.disabled = true
    analyzeBtn.style.opacity = '0.85'
    analyzeBtn.innerHTML = `
      <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-dasharray="14" stroke-dashoffset="5"></circle></svg>
      <span>Analyzing Page...</span>
    `
    try {
      await triggerActiveTabIntelligencePanel()
      analyzeBtn.innerHTML = `
        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        <span>✓ Intelligence Active</span>
      `
    } catch {
      analyzeBtn.innerHTML = originalContent
    } finally {
      setTimeout(() => {
        analyzeBtn.disabled = false
        analyzeBtn.style.opacity = '1'
        analyzeBtn.innerHTML = originalContent
      }, 2500)
    }
  })

  document.getElementById('btn-open-dashboard')?.addEventListener('click', () => {
    openDashboardRoute('dashboard')
  })

  document.getElementById('btn-open-profile')?.addEventListener('click', () => {
    openDashboardRoute('profile')
  })

  document.getElementById('btn-open-tracker')?.addEventListener('click', () => {
    openDashboardRoute('tracker')
  })

  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    openDashboardRoute('settings')
  })

  document.getElementById('disconnect-btn')?.addEventListener('click', async () => {
    if (confirm('Disconnect extension from your Talvyn account?')) {
      await triggerDisconnectAccount()
    }
  })

  // Load recent jobs
  loadRecentJobs()
}

async function loadRecentJobs() {
  const container = document.getElementById('recent-jobs')
  if (!container) return

  try {
    const jobs = await jobsService.getJobs()
    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div style="padding:10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#64748b;margin-bottom:2px;">No jobs saved yet</div>
          <div style="font-size:10px;color:#94a3b8;">Browse any job board to capture listings with 1 click.</div>
        </div>
      `
      return
    }

    const recent = jobs.slice(0, 3)
    container.innerHTML = recent
      .map(
        (job: Job) => `
        <div style="
          display:flex;align-items:center;justify-content:space-between;
          padding:6px 10px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:8px;margin-bottom:4px;
        ">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:600;font-size:11.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${job.title}
            </div>
            <div style="font-size:10.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${job.company}
            </div>
          </div>
          <span style="
            font-size:9.5px;padding:2px 6px;border-radius:999px;font-weight:600;text-transform:capitalize;
            background:${job.status === 'APPLIED' ? '#e0f2fe' : '#f1f5f9'};
            color:${job.status === 'APPLIED' ? '#0369a1' : '#475569'};
          ">
            ${job.status.toLowerCase()}
          </span>
        </div>
      `
      )
      .join('')
  } catch {
    container.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;text-align:center;padding:10px 0;">
        Saved jobs will appear here
      </div>
    `
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

init().catch(console.error)


