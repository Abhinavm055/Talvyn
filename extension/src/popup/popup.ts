/**
 * Talvyn Browser Extension Popup
 *
 * Implements:
 * 1. Celestial Dark & Light theme with interactive Sun-touches-Moon eclipse toggle
 * 2. Manual Job Save section to quickly add any job to the pipeline
 * 3. Strict authentication state machine (loading -> connected | disconnected | expired | error)
 * 4. Active tab floating intelligence trigger
 * 5. Quick dashboard navigation routes
 */

import { jobsService } from '../services/jobsService'
import { AuthUser, Job, JobStatus } from '../types'

type PopupState = 'loading' | 'disconnected' | 'connected' | 'expired' | 'error'
type ThemeMode = 'dark' | 'light'

let currentState: PopupState = 'loading'
let currentUser: AuthUser | null = null
let isOfflineMode = false
let currentTheme: ThemeMode = 'dark'
let activeTabUrl = ''
let manualFormExpanded = false

const app = document.getElementById('app')!

// ─── Theme Management ─────────────────────────────────────────────────────────

async function initTheme(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get('talvyn_extension_theme')
      if (result.talvyn_extension_theme === 'light' || result.talvyn_extension_theme === 'dark') {
        currentTheme = result.talvyn_extension_theme
      }
    } else {
      const stored = localStorage.getItem('talvyn_extension_theme')
      if (stored === 'light' || stored === 'dark') {
        currentTheme = stored as ThemeMode
      }
    }
  } catch {
    /* fallback to dark */
  }
  applyTheme(currentTheme)
}

function applyTheme(theme: ThemeMode): void {
  currentTheme = theme
  document.body.classList.remove('theme-dark', 'theme-light')
  document.body.classList.add(`theme-${theme}`)

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ talvyn_extension_theme: theme })
    }
    localStorage.setItem('talvyn_extension_theme', theme)
  } catch {
    /* ignore storage errors */
  }
}

function toggleTheme(): void {
  const nextTheme: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark'
  const toggleBtn = document.getElementById('celestial-theme-toggle')
  if (toggleBtn) {
    toggleBtn.classList.add('touching')
    setTimeout(() => {
      toggleBtn.classList.remove('touching')
    }, 280)
  }
  applyTheme(nextTheme)
}

function renderThemeToggleHtml(): string {
  return `
    <button
      type="button"
      id="celestial-theme-toggle"
      class="celestial-toggle"
      title="Toggle Light / Dark Mode"
      aria-label="Toggle Sun/Moon Theme"
    >
      <span class="celestial-icon sun-icon" title="Light Mode">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
        </svg>
      </span>
      <div class="celestial-orb"></div>
      <span class="celestial-icon moon-icon" title="Dark Mode">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      </span>
    </button>
  `
}

function setupThemeToggleListener(): void {
  document.getElementById('celestial-theme-toggle')?.addEventListener('click', (e) => {
    e.preventDefault()
    toggleTheme()
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function fetchActiveTabUrl(): Promise<string> {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.url && tabs[0].url.startsWith('http')) {
        return tabs[0].url
      }
    }
  } catch {
    /* ignore tab query errors */
  }
  return ''
}

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

export async function triggerActiveTabIntelligencePanel(): Promise<void> {
  console.log('[Talvyn Popup] Triggering floating intelligence panel on active tab...')
  try {
    let activeTab: chrome.tabs.Tab | null = null

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (lastFocusedTabs[0]?.id) {
        activeTab = lastFocusedTabs[0]
      } else {
        const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (currentWindowTabs[0]?.id) {
          activeTab = currentWindowTabs[0]
        }
      }
    }

    if (!activeTab?.id) {
      await sendBackgroundMessage({ type: 'TRIGGER_ACTIVE_TAB_PANEL' })
      return
    }

    const tabUrl = activeTab.url || ''
    const tabTitle = activeTab.title || ''

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
        tabUrl,
        tabTitle,
      })
    } catch {
      await sendBackgroundMessage({
        type: 'TRIGGER_ACTIVE_TAB_PANEL',
        tabId: activeTab.id,
        tabUrl,
        tabTitle,
      })
    }
  } catch (err: any) {
    console.error('[Talvyn Popup] Failed to trigger active tab floating window:', err?.message || err)
  }
}

// ─── State Machine ────────────────────────────────────────────────────────────

async function init() {
  await initTheme()
  renderLoading()

  activeTabUrl = await fetchActiveTabUrl()

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
      currentState = 'connected'
      currentUser = response.user
      isOfflineMode = Boolean(response.isOffline)
      renderConnected(response.user, { isOffline: isOfflineMode })
    } else if (response.state === 'expired') {
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
    <div style="padding: 28px 18px; min-height: 480px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: var(--bg-main); color: var(--text-primary);">
      <img
        src="${logoUrl}"
        alt="Talvyn"
        onerror="this.onerror=null;this.src='${fallbackUrl}';"
        style="width: 46px; height: 46px; border-radius: 12px; filter: drop-shadow(0 0 16px rgba(80,84,234,0.45)); margin-bottom: 16px; object-fit: contain;"
      />
      <div style="font-weight: 700; font-size: 16px; color: var(--text-primary); margin-bottom: 4px;">Talvyn</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 22px;">Connecting to career pipeline…</div>
      <div style="width: 28px; height: 28px; border: 2.5px solid var(--border-color); border-top-color: #5054EA; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    </div>
  `
}

// ─── Disconnected View ────────────────────────────────────────────────────────

function renderDisconnected() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding: 16px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-main); color: var(--text-primary);">
      <div>
        <!-- Brand Header with Sun/Moon Toggle -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 9px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width: 32px; height: 32px; border-radius: 9px; filter: drop-shadow(0 0 12px rgba(80,84,234,0.4)); flex-shrink: 0; object-fit: contain;"
            />
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); letter-spacing: -0.2px;">Talvyn</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">From Potential to Offer.</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="
              display: inline-flex; align-items: center; gap: 5px;
              padding: 3px 8px; border-radius: 999px; background: var(--chip-bg, rgba(255,255,255,0.05));
              color: var(--text-muted); font-size: 10px; font-weight: 600; border: 1px solid var(--border-color);
            ">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; display: inline-block;"></span>
              Not connected
            </div>
            ${renderThemeToggleHtml()}
          </div>
        </div>

        <!-- Connection Notice Card -->
        <div style="
          padding: 18px 14px; background: var(--bg-card);
          border: 1px solid var(--border-color); border-radius: 14px; margin-bottom: 16px; text-align: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        ">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(80,84,234,0.15); border: 1px solid rgba(80,84,234,0.3); color: #8B8DF8; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 5px;">
            Connect your Talvyn Account
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
            Authorize the extension to capture jobs, analyze requirements, and auto-fill applications seamlessly.
          </div>
        </div>

        <!-- Primary Connect Action Button -->
        <button type="button" id="connect-account-btn" style="
          width: 100%; padding: 12px 14px; background: #5054EA; color: white;
          border: none; border-radius: 11px; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; margin-bottom: 12px; box-shadow: 0 0 20px rgba(80,84,234,0.4);
          transition: all 0.2s ease;
        ">
          <svg style="width: 16px; height: 16px; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Connect Talvyn</span>
        </button>

        <div style="font-size: 11px; color: var(--text-muted); text-align: center; line-height: 1.4;">
          Opens your Talvyn dashboard to link your session securely.
        </div>
      </div>

      <!-- Footer Action -->
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 10.5px; color: var(--text-muted);">Don't have an account?</span>
        <button type="button" id="signup-btn" style="
          background: none; border: none; padding: 0; font-size: 11px; color: #8B8DF8; font-weight: 600; cursor: pointer;
        ">Create Free Account →</button>
      </div>
    </div>
  `

  setupThemeToggleListener()

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
    <div style="padding: 16px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-main); color: var(--text-primary);">
      <div>
        <!-- Brand Header with Sun/Moon Toggle -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 9px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width: 32px; height: 32px; border-radius: 9px; filter: drop-shadow(0 0 12px rgba(80,84,234,0.4)); flex-shrink: 0; object-fit: contain;"
            />
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); letter-spacing: -0.2px;">Talvyn</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">From Potential to Offer.</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="
              display: inline-flex; align-items: center; gap: 5px;
              padding: 3px 8px; border-radius: 999px; background: rgba(245,158,11,0.15);
              color: #FBBF24; font-size: 10px; font-weight: 700; border: 1px solid rgba(245,158,11,0.3);
            ">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
              Session expired
            </div>
            ${renderThemeToggleHtml()}
          </div>
        </div>

        <!-- Expired Notice Box -->
        <div style="
          margin-bottom: 16px; padding: 14px; background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.25); border-radius: 12px; font-size: 11.5px; color: var(--text-secondary);
          display: flex; align-items: flex-start; gap: 10px; line-height: 1.5;
        ">
          <span style="font-size: 16px;">⚠️</span>
          <div>
            <div style="font-weight: 700; color: #FBBF24; margin-bottom: 3px;">Session Expired</div>
            Your Talvyn session has expired. Reconnect your account to continue capturing and tracking jobs.
          </div>
        </div>

        <!-- Reconnect Action Button -->
        <button type="button" id="reconnect-account-btn" style="
          width: 100%; padding: 12px 14px; background: #5054EA; color: white;
          border: none; border-radius: 11px; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; margin-bottom: 14px; box-shadow: 0 0 20px rgba(80,84,234,0.4);
          transition: all 0.2s ease;
        ">
          <svg style="width: 16px; height: 16px; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Reconnect Talvyn</span>
        </button>
      </div>

      <!-- Footer Action -->
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 10px; color: var(--text-muted);">Need help?</span>
        <button type="button" id="open-dash-footer-btn" style="
          background: none; border: none; padding: 0; font-size: 10.5px; color: #8B8DF8; font-weight: 600; cursor: pointer;
        ">Open Dashboard →</button>
      </div>
    </div>
  `

  setupThemeToggleListener()

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
    <div style="padding: 16px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-main); color: var(--text-primary);">
      <div>
        <!-- Brand Header with Sun/Moon Toggle -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 9px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width: 32px; height: 32px; border-radius: 9px; filter: drop-shadow(0 0 12px rgba(80,84,234,0.4)); flex-shrink: 0; object-fit: contain;"
            />
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); letter-spacing: -0.2px;">Talvyn</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">From Potential to Offer.</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="
              display: inline-flex; align-items: center; gap: 5px;
              padding: 3px 8px; border-radius: 999px; background: rgba(239,68,68,0.15);
              color: #F87171; font-size: 10px; font-weight: 700; border: 1px solid rgba(239,68,68,0.3);
            ">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #EF4444; display: inline-block;"></span>
              Connection issue
            </div>
            ${renderThemeToggleHtml()}
          </div>
        </div>

        <!-- Error Notice Box -->
        <div style="
          margin-bottom: 16px; padding: 14px; background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25); border-radius: 12px; font-size: 11.5px; color: var(--text-secondary);
          display: flex; align-items: flex-start; gap: 10px; line-height: 1.5;
        ">
          <span style="font-size: 16px;">⚠️</span>
          <div>
            <div style="font-weight: 700; color: #F87171; margin-bottom: 3px;">Connection Issue</div>
            ${message}
          </div>
        </div>

        <!-- Retry Button -->
        <button type="button" id="retry-btn" style="
          width: 100%; padding: 11px 14px; background: var(--bg-card); color: var(--text-primary);
          border: 1px solid var(--border-color); border-radius: 10px; font-size: 12.5px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; margin-bottom: 10px; transition: all 0.15s;
        ">
          <span>Try Again</span>
        </button>

        <button type="button" id="connect-fallback-btn" style="
          width: 100%; padding: 11px 14px; background: #5054EA; color: white;
          border: none; border-radius: 10px; font-size: 12.5px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; box-shadow: 0 0 16px rgba(80,84,234,0.4); transition: all 0.15s;
        ">
          <span>Connect Talvyn</span>
        </button>
      </div>

      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); text-align: center;">
        <span style="font-size: 10px; color: var(--text-muted);">Ensure your Talvyn app is running.</span>
      </div>
    </div>
  `

  setupThemeToggleListener()

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

  const avatarUrl = user.avatarUrl || (user.profile as any)?.avatarUrl

  app.innerHTML = `
    <div style="padding: 16px; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-main); color: var(--text-primary);">
      <div>
        <!-- Top Bar: Logo, Status Badge, and Sun/Moon Toggle -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width: 28px; height: 28px; border-radius: 8px; filter: drop-shadow(0 0 10px rgba(80,84,234,0.4)); flex-shrink: 0; object-fit: contain;"
            />
            <div>
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); letter-spacing: -0.2px;">Talvyn</div>
              <div style="font-size: 10px; color: var(--text-muted);">From Potential to Offer.</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="
              display: inline-flex; align-items: center; gap: 5px;
              padding: 2.5px 8px; border-radius: 999px;
              background: ${options.isOffline ? 'var(--badge-offline-bg)' : 'var(--badge-connected-bg)'};
              color: ${options.isOffline ? 'var(--badge-offline-text)' : 'var(--badge-connected-text)'};
              font-size: 10px; font-weight: 700; border: 1px solid var(--border-color);
            ">
              <span style="width: 5.5px; height: 5.5px; border-radius: 50%; background: ${options.isOffline ? 'var(--badge-offline-dot)' : 'var(--badge-connected-dot)'}; display: inline-block;"></span>
              ${options.isOffline ? 'Offline' : 'Connected'}
            </div>
            ${renderThemeToggleHtml()}
          </div>
        </div>

        <!-- User Identity Card -->
        <div style="
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 11px; margin-bottom: 10px;
        ">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="${displayName}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--border-color); flex-shrink: 0;" />`
              : `<div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #5054EA, #7C3AED); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; box-shadow: 0 0 10px rgba(80,84,234,0.35);">${(displayName[0] || 'U').toUpperCase()}</div>`
          }
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
            <div style="font-size: 10.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
          </div>
        </div>

        <!-- Primary Action Button: Analyze This Page -->
        <button type="button" id="btn-analyze-page" style="
          width: 100%; margin-bottom: 10px; padding: 10px 14px; background: #5054EA;
          color: white; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          box-shadow: 0 0 16px rgba(80,84,234,0.4); transition: all 0.2s ease;
        ">
          <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Analyze This Page</span>
        </button>

        <!-- 4 Core Navigation Route Buttons: Dashboard, Profile, Tracker, Settings -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px;">
          <button type="button" id="btn-open-dashboard" style="
            padding: 8px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);
            border-radius: 9px; font-size: 11px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s;
          ">
            <span>Dashboard</span>
            <svg style="width: 11px; height: 11px; color: var(--text-muted);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>

          <button type="button" id="btn-open-profile" style="
            padding: 8px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);
            border-radius: 9px; font-size: 11px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s;
          ">
            <span>Profile</span>
            <svg style="width: 11px; height: 11px; color: var(--text-muted);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>

          <button type="button" id="btn-open-tracker" style="
            padding: 8px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);
            border-radius: 9px; font-size: 11px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s;
          ">
            <span>Tracker</span>
            <svg style="width: 11px; height: 11px; color: var(--text-muted);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </button>

          <button type="button" id="btn-open-settings" style="
            padding: 8px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);
            border-radius: 9px; font-size: 11px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s;
          ">
            <span>Settings</span>
            <svg style="width: 11px; height: 11px; color: var(--text-muted);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>
        </div>

        <!-- ─── NEW: Manual Job Save Section ─── -->
        <div style="
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 11px;
          margin-bottom: 12px;
          overflow: hidden;
          transition: border-color 0.2s ease;
        ">
          <!-- Accordion Toggle Header -->
          <button
            type="button"
            id="toggle-manual-save-btn"
            style="
              width: 100%;
              padding: 9px 12px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: none;
              border: none;
              color: var(--text-primary);
              cursor: pointer;
              text-align: left;
              font-size: 11.5px;
              font-weight: 700;
            "
          >
            <div style="display: flex; align-items: center; gap: 7px;">
              <div style="
                width: 19px;
                height: 19px;
                border-radius: 6px;
                background: rgba(80, 84, 234, 0.18);
                color: #8B8DF8;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: bold;
              ">+</div>
              <span>Save Job Manually</span>
            </div>
            <svg id="manual-chevron" style="width: 13px; height: 13px; color: var(--text-muted); transition: transform 0.2s ease; transform: ${manualFormExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Form Area -->
          <div id="manual-save-form" style="display: ${manualFormExpanded ? 'block' : 'none'}; padding: 0 12px 12px 12px; border-top: 1px solid var(--border-color);">
            <form id="form-manual-job" style="display: flex; flex-direction: column; gap: 7px; margin-top: 9px;">
              <div>
                <label style="display: block; font-size: 10px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                  Job Title *
                </label>
                <input
                  type="text"
                  id="manual-job-title"
                  required
                  placeholder="e.g. Frontend Engineer"
                  style="
                    width: 100%;
                    height: 31px;
                    padding: 0 8px;
                    font-size: 11.5px;
                    border-radius: 7px;
                    background: var(--bg-input);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    outline: none;
                  "
                />
              </div>

              <div>
                <label style="display: block; font-size: 10px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                  Company *
                </label>
                <input
                  type="text"
                  id="manual-job-company"
                  required
                  placeholder="e.g. Google, Stripe"
                  style="
                    width: 100%;
                    height: 31px;
                    padding: 0 8px;
                    font-size: 11.5px;
                    border-radius: 7px;
                    background: var(--bg-input);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    outline: none;
                  "
                />
              </div>

              <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 6px;">
                <div>
                  <label style="display: block; font-size: 10px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                    Location
                  </label>
                  <input
                    type="text"
                    id="manual-job-location"
                    placeholder="Remote / City"
                    style="
                      width: 100%;
                      height: 31px;
                      padding: 0 8px;
                      font-size: 11.5px;
                      border-radius: 7px;
                      background: var(--bg-input);
                      color: var(--text-primary);
                      border: 1px solid var(--border-color);
                      outline: none;
                    "
                  />
                </div>

                <div>
                  <label style="display: block; font-size: 10px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                    Status
                  </label>
                  <select
                    id="manual-job-status"
                    style="
                      width: 100%;
                      height: 31px;
                      padding: 0 6px;
                      font-size: 11px;
                      border-radius: 7px;
                      background: var(--bg-input);
                      color: var(--text-primary);
                      border: 1px solid var(--border-color);
                      outline: none;
                    "
                  >
                    <option value="SAVED" selected>Saved</option>
                    <option value="APPLIED">Applied</option>
                    <option value="INTERVIEW">Interview</option>
                  </select>
                </div>
              </div>

              <div>
                <label style="display: block; font-size: 10px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                  Job URL (Optional)
                </label>
                <input
                  type="url"
                  id="manual-job-url"
                  placeholder="https://..."
                  value="${activeTabUrl}"
                  style="
                    width: 100%;
                    height: 31px;
                    padding: 0 8px;
                    font-size: 11.5px;
                    border-radius: 7px;
                    background: var(--bg-input);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    outline: none;
                  "
                />
              </div>

              <!-- Feedback message -->
              <div id="manual-save-feedback" style="display: none; font-size: 10.5px; padding: 6px 8px; border-radius: 6px; margin-top: 2px;"></div>

              <button
                type="submit"
                id="btn-submit-manual-job"
                style="
                  margin-top: 4px;
                  height: 33px;
                  background: #5054EA;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 11.5px;
                  font-weight: 700;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  box-shadow: 0 0 12px rgba(80,84,234,0.35);
                  transition: all 0.15s ease;
                "
              >
                <span>Save to Pipeline</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Recent Saved Jobs Section -->
        <div>
          <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;">
            Recent Saved Jobs
          </div>
          <div id="recent-jobs" style="min-height: 50px;">
            <div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px 0;">Loading jobs...</div>
          </div>
        </div>
      </div>

      <!-- Footer / Disconnect Action -->
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
        <button type="button" id="disconnect-btn" style="
          background: none; border: none; color: var(--text-muted); font-size: 11px; cursor: pointer; padding: 0;
          font-weight: 500; transition: color 0.15s;
        ">
          Disconnect Account
        </button>

        <span style="font-size: 10px; color: var(--text-muted);">Talvyn v1.1</span>
      </div>
    </div>
  `

  setupThemeToggleListener()

  // Analyze page button
  const analyzeBtn = document.getElementById('btn-analyze-page') as HTMLButtonElement | null
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

  // Navigation routes
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

  // Manual save accordion toggle
  const toggleBtn = document.getElementById('toggle-manual-save-btn')
  const formArea = document.getElementById('manual-save-form')
  const chevron = document.getElementById('manual-chevron')

  toggleBtn?.addEventListener('click', () => {
    manualFormExpanded = !manualFormExpanded
    if (formArea) {
      formArea.style.display = manualFormExpanded ? 'block' : 'none'
    }
    if (chevron) {
      chevron.style.transform = manualFormExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
    }
  })

  // Manual save form submission
  const manualForm = document.getElementById('form-manual-job') as HTMLFormElement | null
  const submitBtn = document.getElementById('btn-submit-manual-job') as HTMLButtonElement | null
  const feedback = document.getElementById('manual-save-feedback')

  manualForm?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const titleInput = document.getElementById('manual-job-title') as HTMLInputElement | null
    const companyInput = document.getElementById('manual-job-company') as HTMLInputElement | null
    const locationInput = document.getElementById('manual-job-location') as HTMLInputElement | null
    const statusSelect = document.getElementById('manual-job-status') as HTMLSelectElement | null
    const urlInput = document.getElementById('manual-job-url') as HTMLInputElement | null

    const title = titleInput?.value?.trim() || ''
    const company = companyInput?.value?.trim() || ''
    const location = locationInput?.value?.trim() || ''
    const status = (statusSelect?.value as JobStatus) || 'SAVED'
    const jobUrl = urlInput?.value?.trim() || ''

    if (!title || !company) {
      if (feedback) {
        feedback.style.display = 'block'
        feedback.style.background = 'rgba(239, 68, 68, 0.15)'
        feedback.style.color = '#F87171'
        feedback.innerText = 'Title and Company are required.'
      }
      return
    }

    let sourceWebsite = 'manual'
    if (jobUrl) {
      try {
        sourceWebsite = new URL(jobUrl).hostname.replace(/^www\./, '')
      } catch {
        sourceWebsite = 'web'
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.innerHTML = `
        <div style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;"></div>
        <span>Saving...</span>
      `
    }

    try {
      await jobsService.save({
        title,
        company,
        location: location || undefined,
        status,
        jobUrl: jobUrl || undefined,
        sourceWebsite,
      })

      if (feedback) {
        feedback.style.display = 'block'
        feedback.style.background = 'rgba(16, 185, 129, 0.15)'
        feedback.style.color = '#34D399'
        feedback.innerText = '✓ Job saved to pipeline!'
      }

      if (titleInput) titleInput.value = ''
      if (companyInput) companyInput.value = ''
      if (locationInput) locationInput.value = ''

      // Refresh recent jobs list immediately
      loadRecentJobs()

      setTimeout(() => {
        if (feedback) feedback.style.display = 'none'
      }, 3500)
    } catch (err: any) {
      if (feedback) {
        feedback.style.display = 'block'
        feedback.style.background = 'rgba(239, 68, 68, 0.15)'
        feedback.style.color = '#F87171'
        feedback.innerText = err?.message || 'Failed to save job. Try again.'
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.innerHTML = '<span>Save to Pipeline</span>'
      }
    }
  })

  // Disconnect button
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
        <div style="padding: 10px; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">No jobs saved yet</div>
          <div style="font-size: 10px; color: var(--text-muted);">Browse any job board to capture or save manually above.</div>
        </div>
      `
      return
    }

    const recent = jobs.slice(0, 3)
    container.innerHTML = recent
      .map(
        (job: Job) => `
        <div style="
          display: flex; align-items: center; justify-content: space-between;
          padding: 7px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 4px;
          transition: background 0.15s ease;
        ">
          <div style="min-width: 0; flex: 1; padding-right: 6px;">
            <div style="font-weight: 600; font-size: 11.5px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${job.title}
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${job.company}
            </div>
          </div>
          <span style="
            font-size: 9.5px; padding: 2px 7px; border-radius: 999px; font-weight: 600; text-transform: capitalize;
            background: ${job.status === 'APPLIED' ? 'rgba(80,84,234,0.18)' : 'var(--chip-bg, rgba(255,255,255,0.05))'};
            color: ${job.status === 'APPLIED' ? '#8B8DF8' : 'var(--text-secondary)'};
            border: 1px solid var(--border-color);
            flex-shrink: 0;
          ">
            ${job.status.toLowerCase()}
          </span>
        </div>
      `
      )
      .join('')
  } catch {
    container.innerHTML = `
      <div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px 0;">
        Saved jobs will appear here
      </div>
    `
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

init().catch(console.error)
