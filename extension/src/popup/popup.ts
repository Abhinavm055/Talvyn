/**
 * Talvyn Browser Extension Popup
 *
 * Implements a strict authentication state machine:
 * loading -> (chrome.storage.local check) -> connected | disconnected | expired
 *
 * Provides real-time connection status with the user's Talvyn backend,
 * live health verification, user session display, and quick dashboard navigation.
 */

import {
  getAuthSession,
  setAuthSession,
  clearAuth,
  TalvynAuthSession,
} from '../utils/storage'
import { authService } from '../services/authService'
import { jobsService } from '../services/jobsService'
import { CONFIG } from '../utils/config'
import { AuthUser, Job } from '../types'

type PopupState = 'loading' | 'disconnected' | 'connecting' | 'connected' | 'expired'

let currentState: PopupState = 'loading'
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

function openConnectTab(): void {
  const extId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : ''
  const connectUrl = extId
    ? `${CONFIG.DASHBOARD_URL}/extension/connect?extId=${encodeURIComponent(extId)}`
    : `${CONFIG.DASHBOARD_URL}/extension/connect`

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: connectUrl })
      return
    }
  } catch {
    /* fallback */
  }
  window.open(connectUrl, '_blank')
}

// ─── Initializer & State Machine ──────────────────────────────────────────────

async function init() {
  console.log('[Talvyn] POPUP_AUTH_CHECK_STARTED')
  renderLoading()

  const session = await getAuthSession()

  if (!session || !session.token) {
    currentState = 'disconnected'
    renderDisconnected()
    return
  }

  console.log('[Talvyn] SESSION_FOUND')

  // Live token verification against backend
  try {
    const freshUser = await authService.me()
    console.log('[Talvyn] SESSION_VALID')
    await setAuthSession({
      token: session.token,
      user: freshUser,
      connectedAt: session.connectedAt || new Date().toISOString(),
    })
    currentState = 'connected'
    renderConnected(freshUser)
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      console.log('[Talvyn] SESSION_EXPIRED')
      await clearAuth()
      currentState = 'expired'
      renderExpired()
    } else {
      // Network error / cold start — retain session and render with cached profile
      console.warn('[Talvyn] Backend offline/cold start during popup auth check, retaining session:', err?.message || err)
      currentState = 'connected'
      renderConnected(session.user, { isOffline: true })
    }
  }
}

// ─── Loading View ─────────────────────────────────────────────────────────────

function renderLoading() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:24px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <img
        src="${logoUrl}"
        alt="Talvyn"
        onerror="this.onerror=null;this.src='${fallbackUrl}';"
        style="width:48px;height:48px;border-radius:12px;box-shadow:0 4px 12px rgba(99,102,241,0.25);margin-bottom:16px;object-fit:contain;"
      />
      <div style="font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px;">Talvyn Extension</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:18px;">Checking connection status...</div>
      <div style="width:24px;height:24px;border:2.5px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
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
    <div style="padding:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:360px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn Extension</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#f1f5f9;
            color:#64748b;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
            Disconnected
          </div>
        </div>

        <!-- Hero Card -->
        <div style="
          padding:14px;background:linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          border:1px solid #e0e7ff;border-radius:12px;margin-bottom:16px;text-align:center;
        ">
          <div style="font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:4px;">
            Connect your Talvyn Account
          </div>
          <div style="font-size:11.5px;color:#475569;line-height:1.45;">
            Authorize the extension to capture jobs with 1 click, autofill applications, and track opportunities seamlessly.
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
          <span>Connect your Talvyn account</span>
        </button>

        <div style="font-size:11px;color:#64748b;text-align:center;line-height:1.4;">
          Clicking above will open the Talvyn web app in a browser tab to safely verify your session.
        </div>
      </div>

      <!-- Footer Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Don't have an account?</span>
        <a href="${CONFIG.DASHBOARD_URL}/signup" target="_blank" style="
          font-size:10px;color:#4f46e5;text-decoration:none;font-weight:600;
        ">Create Free Account →</a>
      </div>
    </div>
  `

  const connectBtn = document.getElementById('connect-account-btn')
  connectBtn?.addEventListener('click', () => {
    openConnectTab()
  })
}

// ─── Expired View ─────────────────────────────────────────────────────────────

function renderExpired() {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:360px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn Extension</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#fef3c7;
            color:#b45309;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
            Expired
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
            Your Talvyn account session timed out. Please reconnect your account to continue capturing jobs and autofilling applications.
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
          <span>Reconnect Account</span>
        </button>
      </div>

      <!-- Footer Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Need help?</span>
        <a href="${CONFIG.DASHBOARD_URL}" target="_blank" style="
          font-size:10px;color:#4f46e5;text-decoration:none;font-weight:600;
        ">Open Dashboard →</a>
      </div>
    </div>
  `

  const reconnectBtn = document.getElementById('reconnect-account-btn')
  reconnectBtn?.addEventListener('click', () => {
    openConnectTab()
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
    <div style="padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:360px;display:flex;flex-direction:column;justify-content:space-between;">
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
              <div style="font-weight:700;font-size:13px;color:#0f172a;">Talvyn Extension</div>
              <div style="font-size:10px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>


          <div style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:${options.isOffline ? '#fef3c7' : '#ecfdf5'};
            color:${options.isOffline ? '#b45309' : '#059669'};font-size:10px;font-weight:700;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:${options.isOffline ? '#f59e0b' : '#10b981'};display:inline-block;"></span>
            ${options.isOffline ? 'Offline' : '✓ Connected'}
          </div>
        </div>

        <!-- User Profile Card -->
        <div style="
          display:flex;align-items:center;gap:10px;padding:10px 12px;
          background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;
        ">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="${displayName}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #cbd5e1;flex-shrink:0;" />`
              : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg, #6366f1, #8b5cf6);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${displayName[0]?.toUpperCase()}</div>`
          }
          <div style="min-width:0;flex:1;">
            <div style="font-weight:700;font-size:12.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div>
            <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email}</div>
          </div>
        </div>

        <!-- Navigation Links Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <button type="button" id="open-dashboard-btn" style="
            padding:9px 10px;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Dashboard</span>
            <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>

          <button type="button" id="open-tracker-btn" style="
            padding:9px 10px;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;
            border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.15s;
          ">
            <span>Tracker</span>
            <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </button>
        </div>

        <!-- Recent Saved Jobs Section -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            Recent Saved Jobs
          </div>
          <div id="recent-jobs" style="min-height:70px;">
            <div style="font-size:11px;color:#94a3b8;text-align:center;padding:16px 0;">Loading jobs...</div>
          </div>
        </div>
      </div>

      <!-- Footer / Disconnect -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <button type="button" id="disconnect-btn" style="
          background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:0;
          font-weight:500;transition:color 0.15s;
        ">
          Disconnect Account
        </button>

        <a href="${CONFIG.DASHBOARD_URL}/extensions" target="_blank" style="
          font-size:11px;color:#6366f1;text-decoration:none;font-weight:600;
        ">
          Extension Settings →
        </a>
      </div>
    </div>
  `

  document.getElementById('open-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })

  document.getElementById('open-tracker-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/tracker`, '_blank')
  })

  const disconnectBtn = document.getElementById('disconnect-btn')
  disconnectBtn?.addEventListener('click', async () => {
    if (confirm('Disconnect extension from your Talvyn account?')) {
      await clearAuth()
      currentState = 'disconnected'
      renderDisconnected()
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
        <div style="padding:12px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;text-align:center;">
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
          padding:7px 10px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:8px;margin-bottom:4px;
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
      <div style="font-size:11px;color:#94a3b8;text-align:center;padding:12px 0;">
        Saved jobs will appear here
      </div>
    `
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

init().catch(console.error)

