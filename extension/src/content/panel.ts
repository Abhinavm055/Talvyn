import { ExtractedJob, OpportunityType, ApplicationReadinessResult } from '../types'
import { JobNormalizationResult } from './jobNormalizer'
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
  job?: ExtractedJob
  normalization?: JobNormalizationResult
}

export function injectPanel(
  job: ExtractedJob,
  onSave: () => void,
  onDismiss: () => void,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
    normalization?: JobNormalizationResult
    isConnected?: boolean
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
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })
  panel.querySelector('#talvyn-open-job-btn')?.addEventListener('click', () => {
    if (job.jobUrl) window.open(job.jobUrl, '_blank')
  })
}

export function updatePanelState(state: PanelState): void {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return

  const contentContainer = panel.querySelector('#talvyn-panel-content') as HTMLElement | null
  const saveBtn = panel.querySelector('#talvyn-save-btn') as HTMLButtonElement | null
  const statusEl = panel.querySelector('#talvyn-status') as HTMLElement | null
  const actionsEl = panel.querySelector('#talvyn-actions') as HTMLElement | null

  if (!contentContainer) return

  switch (state.type) {
    case 'loading':
      if (saveBtn) {
        saveBtn.textContent = 'Saving...'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.75'
      }
      if (statusEl) {
        statusEl.style.display = 'none'
      }
      break

    case 'saved':
      contentContainer.innerHTML = `
        <div style="text-align:center;padding:12px 4px 6px 4px;">
          <div style="
            width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#059669;
            font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;
            margin:0 auto 10px auto;border:2px solid #a7f3d0;box-shadow:0 2px 8px rgba(16,185,129,0.15);
          ">✓</div>
          <div style="font-weight:700;font-size:15px;color:#0f172a;margin-bottom:6px;">Job Saved</div>
          
          <div style="font-weight:600;font-size:13px;color:#1e293b;margin-bottom:2px;line-height:1.3;">
            ${escapeHtml(state.job?.title || 'Job Opportunity')}
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
            ${escapeHtml(state.job?.company || 'Company')}
          </div>
          
          <div style="font-size:12px;color:#475569;margin-bottom:14px;background:#f8fafc;padding:6px 10px;border-radius:8px;border:1px solid #e2e8f0;">
            Saved to your Talvyn tracker.
          </div>

          <div style="display:flex;flex-direction:column;gap:6px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
              width:100%;padding:9px 12px;background:#4f46e5;color:white;text-decoration:none;
              border-radius:8px;font-size:12.5px;font-weight:600;display:block;box-sizing:border-box;
              text-align:center;transition:background 0.15s;
            ">View in Tracker</a>
            ${state.job?.jobUrl ? `
              <a href="${escapeHtml(state.job.jobUrl)}" target="_blank" style="
                width:100%;padding:7px 12px;background:transparent;color:#64748b;text-decoration:none;
                border:1px solid #e2e8f0;border-radius:8px;font-size:11.5px;font-weight:500;
                display:block;box-sizing:border-box;text-align:center;
              ">Open Job ↗</a>
            ` : ''}
          </div>
        </div>
      `
      break

    case 'duplicate':
      contentContainer.innerHTML = `
        <div style="text-align:center;padding:12px 4px 6px 4px;">
          <div style="
            width:38px;height:38px;border-radius:50%;background:#eff6ff;color:#2563eb;
            font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;
            margin:0 auto 8px auto;border:2px solid #bfdbfe;
          ">✓</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px;">Already Saved ✓</div>
          
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">
            Status: <span style="font-weight:600;color:#1e293b;">${escapeHtml(state.existingStatus || 'SAVED')}</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
              width:100%;padding:9px 12px;background:#4f46e5;color:white;text-decoration:none;
              border-radius:8px;font-size:12.5px;font-weight:600;display:block;box-sizing:border-box;
              text-align:center;
            ">View in Tracker</a>
          </div>
        </div>
      `
      break

    case 'applied':
      contentContainer.innerHTML = `
        <div style="text-align:center;padding:12px 4px 6px 4px;">
          <div style="
            width:38px;height:38px;border-radius:50%;background:#ecfdf5;color:#059669;
            font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;
            margin:0 auto 8px auto;border:2px solid #a7f3d0;
          ">✓</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px;">Application Tracked</div>
          <div style="font-size:11.5px;color:#059669;font-weight:600;margin-bottom:12px;">Status: APPLIED</div>
          
          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            width:100%;padding:9px 12px;background:#4f46e5;color:white;text-decoration:none;
            border-radius:8px;font-size:12.5px;font-weight:600;display:block;box-sizing:border-box;
            text-align:center;
          ">View in Tracker</a>
        </div>
      `
      break

    case 'in_progress':
      contentContainer.innerHTML = `
        <div style="text-align:center;padding:12px 4px 6px 4px;">
          <div style="
            width:38px;height:38px;border-radius:50%;background:#eff6ff;color:#2563eb;
            font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;
            margin:0 auto 8px auto;border:2px solid #bfdbfe;
          ">⏳</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px;">In Progress</div>
          <div style="font-size:11.5px;color:#2563eb;font-weight:600;margin-bottom:12px;">Application Started</div>
          
          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            width:100%;padding:9px 12px;background:#4f46e5;color:white;text-decoration:none;
            border-radius:8px;font-size:12.5px;font-weight:600;display:block;box-sizing:border-box;
            text-align:center;
          ">View in Tracker</a>
        </div>
      `
      break

    case 'error':
      if (saveBtn) {
        saveBtn.textContent = 'Save Job'
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
      }
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="
            color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;
            border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.4;margin-top:6px;
          ">
            <span style="font-weight:700;">⚠ </span> ${escapeHtml(state.message || 'Failed to save job.')}
          </div>
        `
        statusEl.style.display = 'block'
      }
      break

    case 'logged-out':
      if (actionsEl) {
        actionsEl.innerHTML = `
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;text-align:center;">
            Connect your Talvyn account to save jobs with 1 click.
          </div>
          <button id="talvyn-signin-btn" style="
            width:100%;padding:9px;background:#4f46e5;color:white;
            border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;
          ">Connect Extension</button>
        `
        actionsEl.querySelector('#talvyn-signin-btn')?.addEventListener('click', () => {
          window.open(`${CONFIG.DASHBOARD_URL}/extension/connect`, '_blank')
        })
      }
      break
  }
}

export function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove()
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildPanelHTML(
  job: ExtractedJob,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
    normalization?: JobNormalizationResult
    isConnected?: boolean
  }
): string {
  const norm = options?.normalization
  const matchScore = norm?.matchScore ?? 82
  const matchedFactors = norm?.matchedFactors?.length ? norm.matchedFactors : ['Skills match', 'Experience match']
  const unmatchedFactors = norm?.unmatchedFactors?.length ? norm.unmatchedFactors : (norm?.missingOptionalFields.includes('salary') ? ['Salary unavailable'] : [])
  const locationText = job.location ? `📍 ${job.location}` : '📍 Location unavailable'

  return `
    <div id="talvyn-panel-content">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="
            width:22px;height:22px;background:linear-gradient(135deg, #4f46e5, #6366f1);
            border-radius:6px;display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:white;flex-shrink:0;
          ">T</div>
          <span style="font-weight:700;font-size:12.5px;color:#0f172a;">Talvyn Extension</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="
            font-size:10px;font-weight:700;color:#059669;background:#ecfdf5;
            padding:2px 6px;border-radius:999px;display:inline-flex;align-items:center;gap:3px;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:#10b981;display:inline-block;"></span>
            Connected
          </span>
          <button id="talvyn-dismiss-btn" style="
            background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;
            line-height:1;padding:0;
          " title="Dismiss">×</button>
        </div>
      </div>

      <!-- Job Card Details -->
      <div style="margin-bottom:10px;">
        <div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#059669;margin-bottom:4px;">
          <span>✓</span> Job detected
        </div>
        <div style="font-size:13.5px;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:2px;">
          ${escapeHtml(job.title)}
        </div>
        <div style="font-size:12px;color:#475569;font-weight:500;margin-bottom:2px;">
          ${escapeHtml(job.company)}
        </div>
        <div style="font-size:11px;color:#64748b;">
          ${escapeHtml(locationText)}
        </div>
      </div>

      <!-- Match Score Box -->
      <div style="
        background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
        padding:10px;margin-bottom:12px;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11.5px;font-weight:600;color:#475569;">Match with your profile</span>
          <span style="
            font-size:13px;font-weight:800;
            color:${matchScore >= 80 ? '#059669' : matchScore >= 70 ? '#2563eb' : '#d97706'};
          ">${matchScore}%</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:3px;">
          ${matchedFactors.slice(0, 2).map((f) => `
            <div style="font-size:11px;color:#059669;display:flex;align-items:center;gap:4px;">
              <span>✓</span> <span>${escapeHtml(f)}</span>
            </div>
          `).join('')}
          ${unmatchedFactors.slice(0, 1).map((u) => `
            <div style="font-size:11px;color:#d97706;display:flex;align-items:center;gap:4px;">
              <span>⚠</span> <span>${escapeHtml(u)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="talvyn-status" style="display:none;margin-bottom:8px;"></div>

      <!-- Action Buttons -->
      <div id="talvyn-actions">
        <button id="talvyn-save-btn" style="
          width:100%;padding:9px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
          color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;
          cursor:pointer;transition:opacity 0.15s, transform 0.1s;box-shadow:0 2px 6px rgba(79,70,229,0.25);
        ">
          Save Job
        </button>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <button id="talvyn-open-job-btn" style="
            padding:6px 10px;background:#ffffff;color:#475569;
            border:1px solid #e2e8f0;border-radius:8px;font-size:11.5px;font-weight:500;
            cursor:pointer;transition:background 0.15s;text-align:center;
          ">
            Open Job
          </button>
          <button id="talvyn-dashboard-btn" style="
            padding:6px 10px;background:#ffffff;color:#4f46e5;
            border:1px solid #e0e7ff;border-radius:8px;font-size:11.5px;font-weight:600;
            cursor:pointer;transition:background 0.15s;text-align:center;
          ">
            Dashboard
          </button>
        </div>
      </div>
    </div>
  `
}

function applyPanelStyles(panel: HTMLElement): void {
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    width: '280px',
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 10px 36px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
    padding: '14px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
    border: '1px solid #e2e8f0',
    boxSizing: 'border-box',
  })
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
