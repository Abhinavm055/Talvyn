import { ExtractedJob, OpportunityType, ApplicationReadinessResult } from '../types'
import { CONFIG } from '../utils/config'

const PANEL_ID = 'talvyn-panel'

export interface PanelState {
  type: 'idle' | 'loading' | 'saved' | 'duplicate' | 'in_progress' | 'applied' | 'error' | 'logged-out'
  message?: string
  existingJobId?: string
  existingStatus?: string
  dateApplied?: string | null
  opportunityType?: OpportunityType
  readiness?: ApplicationReadinessResult | null
  deadline?: string | null
}

export function injectPanel(
  job: ExtractedJob,
  onSave: () => void,
  onDismiss: () => void,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
  }
): void {
  removePanel() // Remove any existing panel first

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.setAttribute('data-talvyn', 'true')

  panel.innerHTML = buildPanelHTML(job, options)
  applyPanelStyles(panel)
  document.body.appendChild(panel)

  // Wire up buttons
  panel.querySelector('#talvyn-save-btn')?.addEventListener('click', () => {
    onSave()
  })
  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })
  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(CONFIG.DASHBOARD_URL, '_blank')
  })
}

export function updatePanelState(state: PanelState): void {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return

  const saveBtn = panel.querySelector('#talvyn-save-btn') as HTMLButtonElement | null
  const statusEl = panel.querySelector('#talvyn-status') as HTMLElement | null
  const actionsEl = panel.querySelector('#talvyn-actions') as HTMLElement | null

  if (!saveBtn || !statusEl) return

  switch (state.type) {
    case 'loading':
      saveBtn.textContent = 'Saving…'
      saveBtn.disabled = true
      saveBtn.style.opacity = '0.7'
      break

    case 'saved':
      if (actionsEl) actionsEl.style.display = 'none'
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;color:#059669;font-weight:700;font-size:13px;">
          <span>✓</span> Saved Opportunity
        </div>
        <a href="${CONFIG.DASHBOARD_URL}/jobs" target="_blank"
           style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;color:#4f46e5;text-decoration:none;font-weight:600;">
          View in Talvyn →
        </a>
      `
      statusEl.style.display = 'block'
      setTimeout(() => removePanel(), 4000)
      break

    case 'in_progress':
      if (actionsEl) actionsEl.style.display = 'none'
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;color:#2563eb;font-weight:700;font-size:13px;">
          <span>⏳</span> Application In Progress
        </div>
        <a href="${CONFIG.DASHBOARD_URL}/jobs/${state.existingJobId || ''}" target="_blank"
           style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;color:#4f46e5;text-decoration:none;font-weight:600;">
          View Application →
        </a>
      `
      statusEl.style.display = 'block'
      break

    case 'applied':
      if (actionsEl) actionsEl.style.display = 'none'
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;color:#059669;font-weight:700;font-size:13px;">
          <span>✓</span> Applied
        </div>
        ${state.dateApplied ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">Submitted ${escapeHtml(state.dateApplied)}</div>` : ''}
        <a href="${CONFIG.DASHBOARD_URL}/jobs/${state.existingJobId || ''}" target="_blank"
           style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;color:#4f46e5;text-decoration:none;font-weight:600;">
          View Application →
        </a>
      `
      statusEl.style.display = 'block'
      break

    case 'duplicate':
      if (actionsEl) actionsEl.style.display = 'none'
      statusEl.innerHTML = `
        <div style="color:#d97706;font-weight:700;font-size:13px;">✓ Already Tracked</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Status: <strong>${escapeHtml(state.existingStatus || 'Saved')}</strong></div>
        <a href="${CONFIG.DASHBOARD_URL}/jobs/${state.existingJobId || ''}" target="_blank"
           style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;color:#4f46e5;text-decoration:none;font-weight:600;">
          View in Talvyn →
        </a>
      `
      statusEl.style.display = 'block'
      break

    case 'error':
      saveBtn.textContent = 'Save Opportunity'
      saveBtn.disabled = false
      saveBtn.style.opacity = '1'
      statusEl.innerHTML = `
        <div style="color:#dc2626;font-size:12px;margin-top:4px;">${state.message || 'Failed to save. Please try again.'}</div>
      `
      statusEl.style.display = 'block'
      break

    case 'logged-out':
      if (actionsEl) {
        actionsEl.innerHTML = `
          <div style="font-size:12px;color:#64748b;">Sign in to Talvyn to track opportunities.</div>
          <button id="talvyn-signin-btn" style="
            margin-top:8px;width:100%;padding:8px;background:#4f46e5;color:white;
            border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          ">Sign In to Talvyn</button>
        `
        actionsEl.querySelector('#talvyn-signin-btn')?.addEventListener('click', () => {
          window.open(`${CONFIG.DASHBOARD_URL}/login`, '_blank')
        })
      }
      break
  }
}

export function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove()
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildPanelHTML(
  job: ExtractedJob,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
  }
): string {
  const oppType = options?.opportunityType || (job.jobType as OpportunityType) || 'JOB'
  const readiness = options?.readiness
  const deadline = options?.deadline

  const oppTypeLabel = oppType.replace(/_/g, ' ')

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="
          width:24px;height:24px;background:#4f46e5;border-radius:6px;
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;color:white;flex-shrink:0;
        ">T</div>
        <span style="font-weight:700;font-size:13px;color:#0f172a;">Talvyn</span>
        <span style="
          font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;
          background:#e0e7ff;color:#3730a3;text-transform:uppercase;
        ">${escapeHtml(oppTypeLabel)}</span>
      </div>
      <button id="talvyn-dismiss-btn" style="
        background:none;border:none;cursor:pointer;color:#94a3b8;font-size:18px;
        line-height:1;padding:0 2px;
      " title="Dismiss">×</button>
    </div>

    <div style="margin-bottom:10px;">
      <div style="font-size:13px;font-weight:600;color:#1e293b;line-height:1.3;margin-bottom:2px;">
        ${escapeHtml(job.title)}
      </div>
      <div style="font-size:12px;color:#64748b;">${escapeHtml(job.company)}</div>
      ${job.location ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">📍 ${escapeHtml(job.location)}</div>` : ''}
      ${deadline ? `<div style="font-size:11px;color:#b45309;font-weight:600;margin-top:2px;">⏰ Due by: ${escapeHtml(deadline)}</div>` : ''}
    </div>

    ${readiness ? `
      <div style="
        background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
        padding:8px 10px;margin-bottom:10px;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:600;color:#475569;">Application Readiness</span>
          <span style="font-size:11px;font-weight:700;color:${readiness.tier === 'READY' ? '#059669' : readiness.tier === 'MOSTLY_READY' ? '#2563eb' : '#d97706'};">
            ${readiness.score}%
          </span>
        </div>
        <div style="width:100%;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${readiness.score}%;background:${readiness.tier === 'READY' ? '#10b981' : readiness.tier === 'MOSTLY_READY' ? '#3b82f6' : '#f59e0b'};border-radius:2px;"></div>
        </div>
      </div>
    ` : ''}

    <div id="talvyn-status" style="display:none;margin-bottom:8px;"></div>

    <div id="talvyn-actions">
      <button id="talvyn-save-btn" style="
        width:100%;padding:8px 12px;background:#4f46e5;color:white;
        border:none;border-radius:8px;font-size:13px;font-weight:600;
        cursor:pointer;transition:background 0.15s;
      "
      onmouseover="this.style.background='#4338ca'"
      onmouseout="this.style.background='#4f46e5'">
        Save Opportunity
      </button>
      <button id="talvyn-dashboard-btn" style="
        width:100%;margin-top:6px;padding:6px 12px;background:transparent;
        color:#4f46e5;border:1.5px solid #e0e7ff;border-radius:8px;
        font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s;
      "
      onmouseover="this.style.background='#f0f4ff'"
      onmouseout="this.style.background='transparent'">
        Open Dashboard
      </button>
    </div>
  `
}

function applyPanelStyles(panel: HTMLElement): void {
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    width: '260px',
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08)',
    padding: '14px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    lineHeight: '1.5',
    border: '1px solid rgba(79,70,229,0.15)',
    boxSizing: 'border-box',
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
