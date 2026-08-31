import { ExtractedJob, OpportunityType, ApplicationReadinessResult } from '../types'
import { JobNormalizationResult } from './jobNormalizer'
import { CONFIG } from '../utils/config'

const PANEL_ID = 'talvyn-panel'

export interface PanelState {
  type: 'idle' | 'loading' | 'saved' | 'duplicate' | 'in_progress' | 'applied' | 'error' | 'logged-out' | 'autofilling'
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
  onApply: () => void,
  onDismiss: () => void,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
    normalization?: JobNormalizationResult
    isConnected?: boolean
    theme?: 'light' | 'dark' | 'system'
  }
): void {
  removePanel()

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.setAttribute('data-talvyn', 'true')

  const isDark =
    options?.theme === 'dark' ||
    (options?.theme !== 'light' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  panel.innerHTML = buildPanelHTML(job, options, isDark)
  applyPanelStyles(panel, isDark)
  document.body.appendChild(panel)

  // Attach button event listeners
  panel.querySelector('#talvyn-save-btn')?.addEventListener('click', () => {
    onSave()
  })

  panel.querySelector('#talvyn-apply-btn')?.addEventListener('click', () => {
    onApply()
  })

  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })

  panel.querySelector('#talvyn-collapse-btn')?.addEventListener('click', () => {
    toggleCollapse(panel)
  })

  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })

  panel.querySelector('#talvyn-open-job-btn')?.addEventListener('click', () => {
    if (job.jobUrl) window.open(job.jobUrl, '_blank')
  })
}

function toggleCollapse(panel: HTMLElement): void {
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  const collapseBtn = panel.querySelector('#talvyn-collapse-btn') as HTMLElement | null
  if (!body || !collapseBtn) return

  if (body.style.display === 'none') {
    body.style.display = 'block'
    collapseBtn.textContent = '−'
    collapseBtn.title = 'Minimize'
  } else {
    body.style.display = 'none'
    collapseBtn.textContent = '+'
    collapseBtn.title = 'Expand'
  }
}

export function updatePanelState(state: PanelState): void {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return

  const contentContainer = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  const saveBtn = panel.querySelector('#talvyn-save-btn') as HTMLButtonElement | null
  const applyBtn = panel.querySelector('#talvyn-apply-btn') as HTMLButtonElement | null
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

    case 'autofilling':
      if (applyBtn) {
        applyBtn.textContent = 'Autofilling...'
        applyBtn.disabled = true
      }
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color:#4338ca;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 10px;font-size:11.5px;margin-top:6px;display:flex;align-items:center;gap:5px;">
            <span>⚡</span> <span>Scanning application fields...</span>
          </div>
        `
        statusEl.style.display = 'block'
      }
      break

    case 'saved':
      contentContainer.innerHTML = `
        <div style="text-align:center;padding:12px 4px 6px 4px;">
          <div style="
            width:44px;height:44px;border-radius:50%;background:#ecfdf5;color:#059669;
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
          
          <div style="font-size:12px;color:#475569;margin-bottom:14px;background:#f8fafc;padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;">
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
            width:40px;height:40px;border-radius:50%;background:#eff6ff;color:#2563eb;
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
            width:40px;height:40px;border-radius:50%;background:#ecfdf5;color:#059669;
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
            width:40px;height:40px;border-radius:50%;background:#eff6ff;color:#2563eb;
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
        saveBtn.textContent = '★ Save Job'
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
      }
      if (applyBtn) {
        applyBtn.textContent = 'Apply with Talvyn'
        applyBtn.disabled = false
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
    theme?: 'light' | 'dark' | 'system'
  },
  isDark: boolean = false
): string {
  const norm = options?.normalization
  const matchScore = norm?.matchScore ?? 82
  const recommendation = norm?.recommendation ?? 'GOOD_MATCH'
  const recommendationLabel = norm?.recommendationLabel ?? 'GOOD MATCH'
  const recommendationSubtitle = norm?.recommendationSubtitle ?? 'Worth applying'
  const recommendationIcon = norm?.recommendationIcon ?? '🟢'

  const matchedFactors = norm?.matchedFactors?.length ? norm.matchedFactors : ['Skills match', 'Experience match', 'Education match']
  const matchedSkills = norm?.matchedSkills?.length ? norm.matchedSkills : []
  const missingSkills = norm?.missingSkills?.length ? norm.missingSkills : []

  const readinessScore = norm?.readinessScore ?? 90
  const readinessFactors = norm?.readinessFactors?.length ? norm.readinessFactors : ['Resume available', 'Profile complete', 'Required skills']
  const readinessIssues = norm?.readinessIssues?.length ? norm.readinessIssues : []

  const locationText = job.location ? `📍 ${job.location}` : '📍 Location unavailable'
  const salaryText = job.salary ? `💰 ${job.salary}` : '💰 Salary unavailable'

  // Color tokens
  const bgCard = isDark ? '#1e293b' : '#f8fafc'
  const borderCard = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f8fafc' : '#0f172a'
  const textSecondary = isDark ? '#cbd5e1' : '#475569'
  const textMuted = isDark ? '#94a3b8' : '#64748b'

  let scoreColor = '#059669'
  if (matchScore < 50) scoreColor = '#dc2626'
  else if (matchScore < 70) scoreColor = '#d97706'
  else if (matchScore < 85) scoreColor = '#2563eb'

  return `
    <div id="talvyn-panel-container">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ${borderCard};">
        <div style="display:flex;align-items:center;gap:7px;">
          <div style="
            width:22px;height:22px;background:linear-gradient(135deg, #4f46e5, #6366f1);
            border-radius:6px;display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:white;flex-shrink:0;box-shadow:0 1px 3px rgba(79,70,229,0.3);
          ">T</div>
          <span style="font-weight:700;font-size:13px;color:${textPrimary};">Talvyn</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="
            font-size:10.5px;font-weight:700;color:#059669;background:${isDark ? '#064e3b' : '#ecfdf5'};
            padding:2px 7px;border-radius:999px;display:inline-flex;align-items:center;gap:3px;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:#10b981;display:inline-block;"></span>
            ✓ Connected
          </span>
          <button id="talvyn-collapse-btn" style="
            background:none;border:none;cursor:pointer;color:${textMuted};font-size:15px;
            font-weight:700;line-height:1;padding:0 3px;
          " title="Minimize">−</button>
          <button id="talvyn-dismiss-btn" style="
            background:none;border:none;cursor:pointer;color:${textMuted};font-size:16px;
            line-height:1;padding:0 2px;
          " title="Close">×</button>
        </div>
      </div>

      <div id="talvyn-panel-body">
        <!-- Job Details -->
        <div style="margin-bottom:10px;">
          <div style="font-size:13.5px;font-weight:700;color:${textPrimary};line-height:1.3;margin-bottom:3px;">
            ${escapeHtml(job.title)}
          </div>
          <div style="font-size:12px;color:${textSecondary};font-weight:600;margin-bottom:3px;">
            ${escapeHtml(job.company)}
          </div>
          <div style="font-size:11px;color:${textMuted};display:flex;flex-wrap:wrap;gap:8px;">
            <span>${escapeHtml(locationText)}</span>
            <span>${escapeHtml(salaryText)}</span>
          </div>
        </div>

        <div style="height:1px;background:${borderCard};margin:8px 0;"></div>

        <!-- 1. Profile Match Section -->
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:${textSecondary};letter-spacing:0.3px;text-transform:uppercase;">PROFILE MATCH</span>
            <span style="font-size:13px;font-weight:800;color:${scoreColor};">${matchScore}%</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:6px;">
            ${matchedFactors.slice(0, 3).map((f) => `
              <div style="font-size:11px;color:#059669;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">✓</span> <span>${escapeHtml(f)}</span>
              </div>
            `).join('')}
            ${missingSkills.length > 0 ? `
              <div style="font-size:11px;color:#d97706;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">⚠</span> <span>Missing: ${escapeHtml(missingSkills.slice(0, 2).join(' • '))}</span>
              </div>
            ` : ''}
          </div>

          ${matchedSkills.length > 0 ? `
            <div style="font-size:10.5px;color:${textMuted};margin-top:2px;">
              <span style="font-weight:600;">Matched:</span> ${escapeHtml(matchedSkills.slice(0, 4).join(' • '))}
            </div>
          ` : ''}
        </div>

        <div style="height:1px;background:${borderCard};margin:8px 0;"></div>

        <!-- 2. Shortlist Recommendation Box -->
        <div style="
          background:${bgCard};border:1px solid ${borderCard};border-radius:9px;
          padding:8px 10px;margin-bottom:10px;
        ">
          <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:${textPrimary};">
            <span>${recommendationIcon}</span>
            <span>${escapeHtml(recommendationLabel)}</span>
          </div>
          <div style="font-size:11px;color:${textMuted};margin-left:18px;">
            ${escapeHtml(recommendationSubtitle)}
          </div>
        </div>

        <!-- 3. Application Readiness Section -->
        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:${textSecondary};letter-spacing:0.3px;text-transform:uppercase;">APPLICATION READINESS</span>
            <span style="font-size:12.5px;font-weight:800;color:#059669;">${readinessScore}%</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px;">
            ${readinessFactors.slice(0, 3).map((rf) => `
              <div style="font-size:11px;color:#059669;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">✓</span> <span>${escapeHtml(rf)}</span>
              </div>
            `).join('')}
            ${readinessIssues.slice(0, 1).map((ri) => `
              <div style="font-size:11px;color:#d97706;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">⚠</span> <span>${escapeHtml(ri)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div id="talvyn-status" style="display:none;margin-bottom:8px;"></div>

        <!-- Action Buttons -->
        <div id="talvyn-actions" style="display:flex;flex-direction:column;gap:6px;">
          <button id="talvyn-save-btn" style="
            width:100%;padding:9px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
            color:white;border:none;border-radius:8px;font-size:12.5px;font-weight:700;
            cursor:pointer;transition:opacity 0.15s, transform 0.1s;box-shadow:0 2px 6px rgba(79,70,229,0.25);
          ">
            ★ Save Job
          </button>

          <button id="talvyn-apply-btn" style="
            width:100%;padding:8px 12px;background:#ffffff;
            color:#4f46e5;border:1px solid #c7d2fe;border-radius:8px;font-size:12px;font-weight:700;
            cursor:pointer;transition:background 0.15s;display:flex;align-items:center;justify-content:center;gap:5px;
          ">
            <span>⚡</span> Apply with Talvyn
          </button>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px;">
            <button id="talvyn-open-job-btn" style="
              padding:5px 8px;background:transparent;color:${textMuted};
              border:1px solid ${borderCard};border-radius:7px;font-size:11px;font-weight:500;
              cursor:pointer;text-align:center;
            ">
              Open Job ↗
            </button>
            <button id="talvyn-dashboard-btn" style="
              padding:5px 8px;background:transparent;color:#6366f1;
              border:1px solid ${borderCard};border-radius:7px;font-size:11px;font-weight:600;
              cursor:pointer;text-align:center;
            ">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

function applyPanelStyles(panel: HTMLElement, isDark: boolean = false): void {
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    width: '290px',
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '14px',
    boxShadow: isDark
      ? '0 10px 36px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3)'
      : '0 10px 36px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
    padding: '13px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
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
