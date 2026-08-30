/**
 * Talvyn Chrome Extension Popup
 *
 * Provides real-time connection status with the user's Talvyn account,
 * API health status, recent saved jobs, and quick dashboard navigation.
 */

import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage'
import { authService } from '../services/authService'
import { jobsService } from '../services/jobsService'
import { CONFIG } from '../utils/config'
import { AuthUser, Job } from '../types'

const app = document.getElementById('app')!

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
  } catch (err: any) {
    await clearAuth()
    renderLogin(true) // show session expired notice
  }
}

// ─── Login View ────────────────────────────────────────────────────────────────

function renderLogin(isSessionExpired = false) {
  app.innerHTML = `
    <div style="padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <img src="/icons/icon32.svg" alt="Talvyn" style="width:34px;height:34px;border-radius:10px;box-shadow:0 2px 4px rgba(79,70,229,0.25);flex-shrink:0;" />
        <div>
          <div style="font-weight:700;font-size:15px;color:#0f172a;letter-spacing:-0.2px;">Talvyn Extension</div>
          <div style="font-size:11px;color:#64748b;">From Potential to Offer.</div>
        </div>
      </div>

      ${
        isSessionExpired
          ? `
        <div style="
          margin-bottom:14px;padding:8px 12px;background:#fffbeb;
          border:1px solid #fef3c7;border-radius:8px;font-size:11px;color:#b45309;
          display:flex;align-items:center;gap:6px;
        ">
          <span>⚠️</span>
          <span>Your session expired. Please sign in to reconnect.</span>
        </div>
      `
          : `
        <div style="font-size:12px;color:#475569;margin-bottom:14px;line-height:1.4;">
          Sign in with your Talvyn account to save jobs, autofill forms, and track applications.
        </div>
      `
      }

      <!-- Google Sign In Button -->
      <button type="button" id="google-signin-btn" style="
        width:100%;padding:9px 12px;background:white;color:#1e293b;
        border:1.5px solid #cbd5e1;border-radius:8px;font-size:12px;font-weight:600;
        display:flex;align-items:center;justify-content:center;gap:8px;
        cursor:pointer;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,0.05);transition:background 0.15s;
      ">
        <svg style="width:16px;height:16px;flex-shrink:0;" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <div style="
        display:flex;align-items:center;text-align:center;margin-bottom:12px;
        font-size:11px;color:#94a3b8;font-weight:500;
      ">
        <div style="flex:1;border-bottom:1px solid #e2e8f0;"></div>
        <span style="padding:0 8px;">OR</span>
        <div style="flex:1;border-bottom:1px solid #e2e8f0;"></div>
      </div>

      <!-- Form -->
      <form id="login-form">
        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">Email</label>
          <input id="email-input" type="email" placeholder="you@example.com" required style="
            width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;
            font-size:12px;outline:none;background:white;color:#0f172a;box-sizing:border-box;
          " />
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">Password</label>
          <input id="password-input" type="password" placeholder="••••••••" required style="
            width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;
            font-size:12px;outline:none;background:white;color:#0f172a;box-sizing:border-box;
          " />
        </div>

        <div id="login-error" style="
          display:none;margin-bottom:12px;padding:8px 10px;
          background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
          font-size:11px;color:#dc2626;
        "></div>

        <button type="submit" id="login-btn" style="
          width:100%;padding:9px;background:#4f46e5;color:white;
          border:none;border-radius:8px;font-size:13px;font-weight:600;
          cursor:pointer;box-shadow:0 1px 2px rgba(79,70,229,0.3);
        ">Sign In</button>
      </form>

      <!-- Status Indicator -->
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#94a3b8;">API: ${CONFIG.API_BASE}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#dc2626;font-weight:600;">
          <span style="width:6px;height:6px;border-radius:50%;background:#dc2626;"></span>
          Disconnected
        </span>
      </div>
    </div>
  `

  const form = document.getElementById('login-form') as HTMLFormElement
  const emailInput = document.getElementById('email-input') as HTMLInputElement
  const passwordInput = document.getElementById('password-input') as HTMLInputElement
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement
  const googleBtn = document.getElementById('google-signin-btn') as HTMLButtonElement
  const errorEl = document.getElementById('login-error') as HTMLElement

  googleBtn.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/login`, '_blank')
  })

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
      loginBtn.textContent = 'Sign In'
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

  app.innerHTML = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <!-- Top bar -->
      <div style="
        padding:14px 16px;background:#4f46e5;display:flex;
        align-items:center;justify-content:space-between;
      ">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="/icons/icon32.svg" alt="Talvyn" style="width:28px;height:28px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.2);flex-shrink:0;" />
          <div>
            <div style="font-weight:700;font-size:13px;color:white;letter-spacing:-0.1px;">Talvyn</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.85);">${escapeHtml(displayName)}</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:2px 7px;border-radius:999px;background:rgba(16,185,129,0.2);
            color:#a7f3d0;font-size:10px;font-weight:600;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:#34d399;"></span>
            Connected
          </span>
          <button id="logout-btn" style="
            background:rgba(255,255,255,0.15);border:none;color:white;
            padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;
          " title="Sign out">Sign Out</button>
        </div>
      </div>

      <!-- Quick actions -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
          Quick Links
        </div>
        <div style="display:flex;gap:6px;">
          <a href="${CONFIG.DASHBOARD_URL}/dashboard" target="_blank" style="
            flex:1;padding:7px 8px;background:white;color:#4338ca;border:1px solid #e0e7ff;
            border-radius:8px;font-size:11px;font-weight:600;
            text-align:center;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.03);
          ">Dashboard</a>
          <a href="${CONFIG.DASHBOARD_URL}/jobs" target="_blank" style="
            flex:1;padding:7px 8px;background:white;color:#15803d;border:1px solid #dcfce7;
            border-radius:8px;font-size:11px;font-weight:600;
            text-align:center;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.03);
          ">My Jobs</a>
          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            flex:1;padding:7px 8px;background:white;color:#c2410c;border:1px solid #ffedd5;
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
          <div style="color:#94a3b8;font-size:12px;padding:8px 0;">Loading…</div>
        </div>
      </div>

      <!-- Footer / API Info -->
      <div style="padding:10px 14px;border-top:1px solid #f1f5f9;background:#fafafa;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:#94a3b8;">Account: ${escapeHtml(user.email)}</span>
        <a href="${CONFIG.DASHBOARD_URL}/extensions" target="_blank" style="
          font-size:10px;color:#4f46e5;text-decoration:none;font-weight:600;
        ">Extension Settings →</a>
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
        <div style="color:#94a3b8;font-size:11px;padding:6px 0;text-align:center;">
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
    SAVED: '#64748b', INTERESTED: '#7c3aed', APPLIED: '#2563eb',
    ASSESSMENT: '#9333ea', INTERVIEW: '#d97706', OFFER: '#059669',
    ACCEPTED: '#059669', REJECTED: '#dc2626', WITHDRAWN: '#94a3b8', EXPIRED: '#94a3b8',
  }
  const color = STATUS_COLORS[job.status] || '#64748b'

  return `
    <a href="${CONFIG.DASHBOARD_URL}/jobs/${job.id}" target="_blank" style="
      display:flex;align-items:center;gap:8px;padding:7px 0;
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
