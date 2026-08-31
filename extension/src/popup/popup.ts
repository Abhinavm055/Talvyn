/**
 * Talvyn Browser Extension Popup
 *
 * Provides real-time connection status with the user's Talvyn backend,
 * live health verification, user authentication, and quick dashboard navigation.
 */

import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage'
import { authService } from '../services/authService'
import { jobsService } from '../services/jobsService'
import { CONFIG } from '../utils/config'
import { AuthUser, Job } from '../types'

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

async function checkApiHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${CONFIG.API_BASE}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
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

async function init() {
  const token = await getToken()
  const user = await getUser()

  if (!token || !user) {
    renderLogin()
    return
  }

  // Validate token with live backend
  try {
    const freshUser = await authService.me()
    await setUser(freshUser)
    renderDashboard(freshUser)
  } catch {
    await clearAuth()
    renderLogin(true) // show session expired notice
  }
}

// ─── Login View ────────────────────────────────────────────────────────────────

function renderLogin(isSessionExpired = false) {
  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="padding:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;min-height:360px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 6px rgba(99,102,241,0.25);flex-shrink:0;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;letter-spacing:-0.2px;">Talvyn Browser Extension</div>
              <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
            </div>
          </div>

          <div id="connection-badge" style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 8px;border-radius:999px;background:#f1f5f9;
            color:#64748b;font-size:10px;font-weight:600;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
            Disconnected
          </div>
        </div>

        ${
          isSessionExpired
            ? `
          <div style="
            margin-bottom:12px;padding:8px 12px;background:#fffbeb;
            border:1px solid #fef3c7;border-radius:8px;font-size:11px;color:#b45309;
            display:flex;align-items:center;gap:6px;
          ">
            <span>⚠️</span>
            <span>Your session expired. Please reconnect your account.</span>
          </div>
        `
            : `
          <div style="font-size:12px;color:#475569;margin-bottom:14px;line-height:1.4;">
            Connect your Talvyn account to save jobs, autofill applications, and sync career progress seamlessly.
          </div>
        `
        }

        <!-- Primary Connect Action Button -->
        <button type="button" id="connect-account-btn" style="
          width:100%;padding:11px 14px;background:linear-gradient(to right, #4f46e5, #6366f1);color:white;
          border:none;border-radius:10px;font-size:13px;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:8px;
          cursor:pointer;margin-bottom:12px;box-shadow:0 3px 8px rgba(79,70,229,0.3);transition:all 0.15s;
        ">
          <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Connect your Talvyn account</span>
        </button>

        <div style="
          display:flex;align-items:center;text-align:center;margin:12px 0 10px;
          font-size:10px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;
        ">
          <div style="flex:1;border-bottom:1px solid #e2e8f0;"></div>
          <span style="padding:0 8px;">OR SIGN IN DIRECTLY</span>
          <div style="flex:1;border-bottom:1px solid #e2e8f0;"></div>
        </div>

        <!-- Form -->
        <form id="login-form">
          <div style="margin-bottom:8px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Email</label>
            <input id="email-input" type="email" placeholder="you@example.com" required style="
              width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;
              font-size:12px;outline:none;background:white;color:#0f172a;box-sizing:border-box;
            " />
          </div>
          <div style="margin-bottom:10px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Password</label>
            <input id="password-input" type="password" placeholder="••••••••" required style="
              width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;
              font-size:12px;outline:none;background:white;color:#0f172a;box-sizing:border-box;
            " />
          </div>

          <div id="login-error" style="
            display:none;margin-bottom:10px;padding:7px 10px;
            background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
            font-size:11px;color:#dc2626;
          "></div>

          <button type="submit" id="login-btn" style="
            width:100%;padding:8px;background:#f8fafc;color:#1e293b;
            border:1.5px solid #cbd5e1;border-radius:8px;font-size:12px;font-weight:600;
            cursor:pointer;transition:all 0.15s;
          ">Sign In with Password</button>
        </form>
      </div>

      <!-- Footer Action -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Not registered yet?</span>
        <a href="${CONFIG.DASHBOARD_URL}/signup" target="_blank" style="
          font-size:10px;color:#4f46e5;text-decoration:none;font-weight:600;
        ">Create Free Account →</a>
      </div>
    </div>
  `

  // Connect Account Button
  const connectBtn = document.getElementById('connect-account-btn')
  connectBtn?.addEventListener('click', () => {
    openConnectTab()
  })

  // Asynchronously verify backend health and update status badge
  checkApiHealth().then((isHealthy) => {
    const badge = document.getElementById('connection-badge')
    if (!badge) return
    if (isHealthy) {
      badge.style.background = '#f1f5f9'
      badge.style.color = '#475569'
      badge.innerHTML = `
        <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
        Ready to Connect
      `
    } else {
      badge.style.background = '#fee2e2'
      badge.style.color = '#991b1b'
      badge.innerHTML = `
        <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
        Backend Offline
      `
    }
  })

  const form = document.getElementById('login-form') as HTMLFormElement
  const emailInput = document.getElementById('email-input') as HTMLInputElement
  const passwordInput = document.getElementById('password-input') as HTMLInputElement
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement
  const errorEl = document.getElementById('login-error') as HTMLElement

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.style.display = 'none'
    loginBtn.textContent = 'Signing in…'
    loginBtn.disabled = true

    try {
      const response = await authService.login(emailInput.value.trim(), passwordInput.value)
      await setToken(response.token)
      await setUser(response.user)
      renderDashboard(response.user)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid email or password'
      errorEl.textContent = message
      errorEl.style.display = 'block'
      loginBtn.textContent = 'Sign In with Password'
      loginBtn.disabled = false
    }
  })
}

// ─── Authenticated Dashboard View ─────────────────────────────────────────────


async function renderDashboard(user: AuthUser) {
  const displayName =
    user.profile?.preferredName ||
    user.profile?.givenName ||
    user.email.split('@')[0]

  const logoUrl = getLogoUrl()
  const fallbackUrl = getFallbackIconUrl()

  app.innerHTML = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;min-height:360px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <!-- Top bar -->
        <div style="
          padding:12px 16px;background:linear-gradient(to right, #4338ca, #6366f1);display:flex;
          align-items:center;justify-content:space-between;
        ">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${logoUrl}"
              alt="Talvyn"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:28px;height:28px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.2);flex-shrink:0;background:white;padding:2px;object-fit:contain;"
            />
            <div>
              <div style="font-weight:700;font-size:13px;color:white;letter-spacing:-0.1px;">Talvyn</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.9);">${escapeHtml(displayName)}</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <span style="
              display:inline-flex;align-items:center;gap:4px;
              padding:2px 7px;border-radius:999px;background:rgba(16,185,129,0.25);
              color:#d1fae5;font-size:10px;font-weight:600;
            ">
              <span style="width:5px;height:5px;border-radius:50%;background:#34d399;display:inline-block;"></span>
              Connected
            </span>
            <button id="logout-btn" style="
              background:rgba(255,255,255,0.2);border:none;color:white;
              padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;
            " title="Disconnect account">Disconnect</button>
          </div>
        </div>

        <!-- Quick actions -->
        <div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            Quick Links
          </div>
          <div style="display:flex;gap:6px;">
            <a href="${CONFIG.DASHBOARD_URL}/dashboard" target="_blank" style="
              flex:1;padding:6px 8px;background:white;color:#4338ca;border:1px solid #e0e7ff;
              border-radius:8px;font-size:11px;font-weight:600;
              text-align:center;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.03);
            ">Dashboard</a>
            <a href="${CONFIG.DASHBOARD_URL}/jobs" target="_blank" style="
              flex:1;padding:6px 8px;background:white;color:#15803d;border:1px solid #dcfce7;
              border-radius:8px;font-size:11px;font-weight:600;
              text-align:center;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.03);
            ">My Jobs</a>
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
              flex:1;padding:6px 8px;background:white;color:#c2410c;border:1px solid #ffedd5;
              border-radius:8px;font-size:11px;font-weight:600;
              text-align:center;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.03);
            ">Tracker</a>
          </div>
        </div>

        <!-- Recent jobs -->
        <div style="padding:10px 14px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            Recent Saved Jobs
          </div>
          <div id="recent-jobs-list">
            <div style="color:#94a3b8;font-size:12px;padding:8px 0;">Loading recent jobs…</div>
          </div>
        </div>
      </div>

      <!-- Footer / Account Info -->
      <div style="padding:10px 14px;border-top:1px solid #f1f5f9;background:#fafafa;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml(user.email)}
        </span>
        <a href="${CONFIG.DASHBOARD_URL}/extensions" target="_blank" style="
          font-size:10px;color:#4f46e5;text-decoration:none;font-weight:600;
        ">Settings →</a>
      </div>
    </div>
  `

  // Wire logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await clearAuth()
    renderLogin()
  })


  // Load recent jobs
  await loadRecentJobs()
}

async function loadRecentJobs(): Promise<void> {
  const listEl = document.getElementById('recent-jobs-list')
  if (!listEl) return

  try {
    const { jobs } = await jobsService.getRecent(5)
    if (jobs.length === 0) {
      listEl.innerHTML = `
        <div style="color:#94a3b8;font-size:11px;padding:8px 0;text-align:center;">
          No jobs saved yet.<br/>
          <span style="color:#64748b;font-size:10px;">Browse LinkedIn, Indeed, or Ashby to auto-save!</span>
        </div>
      `
      return
    }

    listEl.innerHTML = jobs.map((job) => renderJobItem(job)).join('')
  } catch {
    listEl.innerHTML = `<div style="color:#dc2626;font-size:11px;">Failed to load recent jobs.</div>`
  }
}

function renderJobItem(job: Job): string {
  const STATUS_COLORS: Record<string, string> = {
    SAVED: '#64748b',
    INTERESTED: '#7c3aed',
    APPLIED: '#2563eb',
    ASSESSMENT: '#9333ea',
    INTERVIEW: '#d97706',
    OFFER: '#059669',
    ACCEPTED: '#059669',
    REJECTED: '#dc2626',
    WITHDRAWN: '#94a3b8',
    EXPIRED: '#94a3b8',
  }
  const color = STATUS_COLORS[job.status] || '#64748b'

  return `
    <a href="${CONFIG.DASHBOARD_URL}/jobs/${job.id}" target="_blank" style="
      display:flex;align-items:center;gap:8px;padding:6px 0;
      border-bottom:1px solid #f8fafc;text-decoration:none;
    ">
      <div style="
        width:24px;height:24px;background:#f1f5f9;border-radius:6px;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:#475569;flex-shrink:0;
      ">${escapeHtml(job.company.charAt(0).toUpperCase())}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml(job.title)}
        </div>
        <div style="font-size:10px;color:#94a3b8;">${escapeHtml(job.company)}</div>
      </div>
      <span style="
        font-size:9px;font-weight:700;color:${color};
        background:${color}15;padding:2px 5px;border-radius:4px;
        flex-shrink:0;white-space:nowrap;
      ">${job.status}</span>
    </a>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

init().catch(console.error)
