import { ExtractedJob, OpportunityType, ApplicationReadinessResult } from '../types'
import { JobNormalizationResult } from './jobNormalizer'
import { CONFIG } from '../utils/config'

const PANEL_ID = 'talvyn-panel'
const POSITION_STORAGE_KEY = 'talvyn_panel_position'

export interface PanelState {
  type: 'idle' | 'loading' | 'saved' | 'duplicate' | 'in_progress' | 'applied' | 'error' | 'logged-out' | 'autofilling' | 'autofill-complete'
  message?: string
  existingJobId?: string
  existingStatus?: string
  dateApplied?: string | null
  opportunityType?: OpportunityType
  readiness?: ApplicationReadinessResult | null
  deadline?: string | null
  job?: ExtractedJob
  normalization?: JobNormalizationResult
  autofillStats?: {
    filledFields: string[]
    reviewFields: string[]
  }
}

let currentOnSave: (() => void) | null = null
let currentOnApply: (() => void) | null = null
let currentJobData: ExtractedJob | null = null

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

  currentOnSave = onSave
  currentOnApply = onApply
  currentJobData = job

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

  // Make panel draggable via header with viewport constraints and saved position
  makePanelDraggable(panel)

  // Attach button event listeners
  attachActionListeners(panel, job)

  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })

  panel.querySelector('#talvyn-collapse-btn')?.addEventListener('click', () => {
    toggleCollapse(panel)
  })
}

function makePanelDraggable(panel: HTMLElement): void {
  const header = panel.querySelector('#talvyn-panel-header') as HTMLElement | null
  if (!header) return

  header.style.cursor = 'grab'
  header.style.userSelect = 'none'

  let isDragging = false
  let startX = 0
  let startY = 0
  let initialLeft = 0
  let initialTop = 0

  const onPointerDown = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (target && (target as HTMLElement).closest('button, a, input, select')) {
      return
    }

    isDragging = true
    header.style.cursor = 'grabbing'

    const rect = panel.getBoundingClientRect()
    initialLeft = rect.left
    initialTop = rect.top
    startX = clientX
    startY = clientY

    panel.style.bottom = 'auto'
    panel.style.right = 'auto'
    panel.style.left = `${initialLeft}px`
    panel.style.top = `${initialTop}px`
  }

  const onPointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return

    const deltaX = clientX - startX
    const deltaY = clientY - startY

    let newLeft = initialLeft + deltaX
    let newTop = initialTop + deltaY

    const panelWidth = panel.offsetWidth || 300
    const panelHeight = panel.offsetHeight || 420
    const viewWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200
    const viewHeight = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800
    const maxLeft = Math.max(0, viewWidth - panelWidth)
    const maxTop = Math.max(0, viewHeight - panelHeight)

    newLeft = Math.max(0, Math.min(newLeft, maxLeft))
    newTop = Math.max(0, Math.min(newTop, maxTop))

    panel.style.left = `${newLeft}px`
    panel.style.top = `${newTop}px`
  }

  const onPointerUp = () => {
    if (!isDragging) return
    isDragging = false
    header.style.cursor = 'grab'

    try {
      if (typeof panel.getBoundingClientRect === 'function' && typeof localStorage !== 'undefined') {
        const rect = panel.getBoundingClientRect()
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: rect.left, y: rect.top }))
      }
    } catch {
      /* ignore */
    }
  }

  if (typeof header.addEventListener === 'function') {
    header.addEventListener('mousedown', (e: MouseEvent) => {
      onPointerDown(e.clientX, e.clientY, e.target)
      const onMouseMove = (moveEvent: MouseEvent) => {
        onPointerMove(moveEvent.clientX, moveEvent.clientY)
      }
      const onMouseUp = () => {
        onPointerUp()
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
        }
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      }
    })

    header.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target)
      }
    }, { passive: true })

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('touchmove', (e: TouchEvent) => {
        if (isDragging && e.touches && e.touches.length > 0) {
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY)
        }
      }, { passive: true })

      document.addEventListener('touchend', () => {
        if (isDragging) onPointerUp()
      }, { passive: true })
    }
  }
}

function attachActionListeners(panel: HTMLElement, job?: ExtractedJob): void {
  panel.querySelector('#talvyn-save-btn')?.addEventListener('click', () => {
    if (currentOnSave) currentOnSave()
  })

  panel.querySelector('#talvyn-apply-btn')?.addEventListener('click', () => {
    if (currentOnApply) currentOnApply()
  })

  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })

  panel.querySelector('#talvyn-open-job-btn')?.addEventListener('click', () => {
    const url = job?.jobUrl || currentJobData?.jobUrl
    if (url) window.open(url, '_blank')
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

  const saveBtn = panel.querySelector('#talvyn-save-btn') as HTMLButtonElement | null
  const applyBtn = panel.querySelector('#talvyn-apply-btn') as HTMLButtonElement | null
  const statusEl = panel.querySelector('#talvyn-status') as HTMLElement | null
  const actionsEl = panel.querySelector('#talvyn-actions') as HTMLElement | null

  if (state.job) {
    currentJobData = state.job
  }

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
        applyBtn.innerHTML = '<span>⚡</span> Autofilling safe fields...'
        applyBtn.disabled = true
      }
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color:#4338ca;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 10px;font-size:11.5px;margin-top:6px;display:flex;align-items:center;gap:5px;">
            <span>⚡</span> <span>Scanning application form & mapping profile fields...</span>
          </div>
        `
        statusEl.style.display = 'block'
      }
      break

    case 'autofill-complete':
      if (applyBtn) {
        applyBtn.innerHTML = '<span>⚡</span> Apply with Talvyn'
        applyBtn.disabled = false
      }
      if (statusEl) {
        const filled = state.autofillStats?.filledFields || []
        const review = state.autofillStats?.reviewFields || []
        statusEl.innerHTML = `
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;padding:8px 10px;margin-bottom:8px;font-size:11px;">
            <div style="font-weight:700;color:#065f46;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
              <span>✓</span> Autofill Complete
            </div>
            ${filled.length > 0 ? `
              <div style="color:#047857;margin-bottom:3px;">
                ✓ <strong>${filled.length} fields filled:</strong> ${escapeHtml(filled.slice(0, 4).join(', '))}${filled.length > 4 ? ` +${filled.length - 4} more` : ''}
              </div>
            ` : ''}
            ${review.length > 0 ? `
              <div style="color:#b45309;margin-top:3px;background:#fffbeb;padding:4px 6px;border-radius:6px;border:1px solid #fde68a;">
                ⚠ <strong>Review required:</strong> ${escapeHtml(review.slice(0, 3).join(', '))}. Sensitive fields are protected.
              </div>
            ` : ''}
            <div style="color:#64748b;font-size:10px;margin-top:4px;">
              Talvyn will never automatically submit your application.
            </div>
          </div>
        `
        statusEl.style.display = 'block'
      }
      break

    case 'saved':
    case 'duplicate': {
      const displayStatus = state.existingStatus || 'SAVED'
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="
            background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;
            padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;
          ">
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="color:#059669;font-weight:800;font-size:13px;">✓</span>
              <span style="font-weight:700;font-size:12px;color:#065f46;">ALREADY SAVED</span>
            </div>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;
              background:#ffffff;color:#047857;border:1px solid #a7f3d0;
            ">Status: ${escapeHtml(displayStatus)}</span>
          </div>
        `
        statusEl.style.display = 'block'
      }

      if (actionsEl) {
        actionsEl.innerHTML = `
          <button id="talvyn-apply-btn" style="
            width:100%;padding:9px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
            color:white;border:none;border-radius:8px;font-size:12.5px;font-weight:700;
            cursor:pointer;transition:opacity 0.15s;display:flex;align-items:center;justify-content:center;gap:6px;
            box-shadow:0 2px 6px rgba(79,70,229,0.25);
          ">
            <span>⚡</span> Apply with Talvyn
          </button>

          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            width:100%;padding:8px 12px;background:#f8fafc;color:#334155;border:1px solid #cbd5e1;
            text-decoration:none;border-radius:8px;font-size:12px;font-weight:600;display:block;
            box-sizing:border-box;text-align:center;transition:background 0.15s;
          ">View in Tracker</a>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px;">
            <button id="talvyn-open-job-btn" style="
              padding:5px 8px;background:transparent;color:#64748b;
              border:1px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:500;
              cursor:pointer;text-align:center;
            ">
              Open Job ↗
            </button>
            <button id="talvyn-dashboard-btn" style="
              padding:5px 8px;background:transparent;color:#6366f1;
              border:1px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:600;
              cursor:pointer;text-align:center;
            ">
              Dashboard
            </button>
          </div>
        `
        attachActionListeners(panel, currentJobData || undefined)
      }
      break
    }

    case 'applied': {
      const displayStatus = state.existingStatus || 'APPLIED'
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="
            background:#eef2ff;border:1px solid #c7d2fe;border-radius:9px;
            padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;
          ">
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="color:#4f46e5;font-weight:800;font-size:13px;">✓</span>
              <span style="font-weight:700;font-size:12px;color:#3730a3;">APPLICATION TRACKED</span>
            </div>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;
              background:#ffffff;color:#4338ca;border:1px solid #c7d2fe;
            ">Status: ${escapeHtml(displayStatus)}</span>
          </div>
        `
        statusEl.style.display = 'block'
      }

      if (actionsEl) {
        actionsEl.innerHTML = `
          <button id="talvyn-apply-btn" style="
            width:100%;padding:9px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
            color:white;border:none;border-radius:8px;font-size:12.5px;font-weight:700;
            cursor:pointer;transition:opacity 0.15s;display:flex;align-items:center;justify-content:center;gap:6px;
            box-shadow:0 2px 6px rgba(79,70,229,0.25);
          ">
            <span>⚡</span> Apply with Talvyn
          </button>

          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            width:100%;padding:8px 12px;background:#f8fafc;color:#334155;border:1px solid #cbd5e1;
            text-decoration:none;border-radius:8px;font-size:12px;font-weight:600;display:block;
            box-sizing:border-box;text-align:center;
          ">View in Tracker</a>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px;">
            <button id="talvyn-open-job-btn" style="
              padding:5px 8px;background:transparent;color:#64748b;
              border:1px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:500;
              cursor:pointer;text-align:center;
            ">
              Open Job ↗
            </button>
            <button id="talvyn-dashboard-btn" style="
              padding:5px 8px;background:transparent;color:#6366f1;
              border:1px solid #e2e8f0;border-radius:7px;font-size:11px;font-weight:600;
              cursor:pointer;text-align:center;
            ">
              Dashboard
            </button>
          </div>
        `
        attachActionListeners(panel, currentJobData || undefined)
      }
      break
    }

    case 'in_progress': {
      const displayStatus = state.existingStatus || 'IN_PROGRESS'
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="
            background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;
            padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;
          ">
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="color:#2563eb;font-weight:800;font-size:13px;">⏳</span>
              <span style="font-weight:700;font-size:12px;color:#1e40af;">IN PROGRESS</span>
            </div>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;
              background:#ffffff;color:#1d4ed8;border:1px solid #bfdbfe;
            ">Status: ${escapeHtml(displayStatus)}</span>
          </div>
        `
        statusEl.style.display = 'block'
      }
      break
    }

    case 'error':
      if (saveBtn) {
        saveBtn.textContent = '★ Save Job'
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
      }
      if (applyBtn) {
        applyBtn.innerHTML = '<span>⚡</span> Apply with Talvyn'
        applyBtn.disabled = false
      }
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="
            color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;
            border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.4;margin-top:6px;
          ">
            <span style="font-weight:700;">⚠ </span> ${escapeHtml(state.message || 'Failed to perform action.')}
          </div>
        `
        statusEl.style.display = 'block'
      }
      break

    case 'idle':
      if (applyBtn) {
        applyBtn.innerHTML = '<span>⚡</span> Apply with Talvyn'
        applyBtn.disabled = false
      }
      break

    case 'logged-out':
      if (actionsEl) {
        actionsEl.innerHTML = `
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;text-align:center;">
            Connect your Talvyn account to save jobs and apply with 1 click.
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
  const recommendationLabel = norm?.recommendationLabel ?? 'GOOD MATCH'
  const recommendationSubtitle = norm?.recommendationSubtitle ?? 'Worth applying'
  const recommendationIcon = norm?.recommendationIcon ?? '🟢'

  const matchedSkills = norm?.matchedSkills?.length ? norm.matchedSkills : []
  const missingSkills = norm?.missingSkills?.length ? norm.missingSkills : []

  const readinessScore = norm?.readinessScore ?? 90
  const readinessFactors = norm?.readinessFactors?.length ? norm.readinessFactors : ['Resume available', 'Profile complete', 'Experience suitable']
  const readinessIssues = norm?.readinessIssues?.length ? norm.readinessIssues : []

  const locationText = job.location ? `📍 ${job.location}` : '📍 Location unavailable'
  const salaryText = job.salary ? `💰 ${job.salary}` : '💰 Salary unavailable'
  const jobTypeText = job.jobType ? `💼 ${formatJobType(job.jobType)}` : '💼 Full Time'

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

  // Factor statuses
  const isRoleMatch = norm?.roleMatchStatus === 'MATCH'
  const isRoleMismatch = norm?.roleMatchStatus === 'MISMATCH'

  const isExpMatch = norm?.experienceMatchStatus === 'MATCH'
  const isExpMismatch = norm?.experienceMatchStatus === 'MISMATCH'

  const isEduMatch = norm?.educationMatchStatus === 'MATCH'
  const isEduMismatch = norm?.educationMatchStatus === 'MISMATCH'
  const isEduUnspecified = norm?.educationMatchStatus === 'UNSPECIFIED' || !norm?.educationMatchStatus

  const isSkillsMatch = norm?.skillsMatchStatus !== 'MISMATCH'

  const isLocMatch = norm?.locationMatchStatus === 'MATCH'
  const isLocMismatch = norm?.locationMatchStatus === 'MISMATCH'
  const isLocUnspecified = norm?.locationMatchStatus === 'UNSPECIFIED' || !norm?.locationMatchStatus

  return `
    <div id="talvyn-panel-container">
      <!-- Header (Draggable Handle) -->
      <div id="talvyn-panel-header" style="
        display:flex;align-items:center;justify-content:space-between;
        margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ${borderCard};
        cursor:grab;user-select:none;
      " title="Drag to move panel">
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
        <!-- 1. JOB Details -->
        <div style="margin-bottom:10px;">
          <div style="font-size:13.5px;font-weight:700;color:${textPrimary};line-height:1.3;margin-bottom:3px;">
            ${escapeHtml(job.title)}
          </div>
          <div style="font-size:12px;color:${textSecondary};font-weight:600;margin-bottom:4px;">
            ${escapeHtml(job.company)}
          </div>
          <div style="font-size:11px;color:${textMuted};display:flex;flex-wrap:wrap;gap:8px;">
            <span>${escapeHtml(locationText)}</span>
            <span>${escapeHtml(salaryText)}</span>
            <span>${escapeHtml(jobTypeText)}</span>
          </div>
        </div>

        <div style="height:1px;background:${borderCard};margin:8px 0;"></div>

        <!-- 2. PROFILE MATCH Section -->
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:${textSecondary};letter-spacing:0.3px;text-transform:uppercase;">PROFILE MATCH</span>
            <span style="font-size:14px;font-weight:800;color:${scoreColor};">${matchScore}%</span>
          </div>

          <!-- Factor Checkmarks & Statuses -->
          <div style="display:flex;flex-direction:column;gap:3.5px;margin-bottom:6px;">
            <!-- Role match -->
            <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isRoleMatch ? '#059669' : isRoleMismatch ? '#dc2626' : textMuted};">
              <span style="font-weight:800;">${isRoleMatch ? '✓' : isRoleMismatch ? '⚠' : '—'}</span>
              <span>${isRoleMatch ? 'Role match' : isRoleMismatch ? 'Role mismatch' : 'Role: Unspecified'}</span>
            </div>

            <!-- Experience match -->
            <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isExpMismatch ? '#dc2626' : isExpMatch ? '#059669' : textMuted};">
              <span style="font-weight:800;">${isExpMismatch ? '⚠' : isExpMatch ? '✓' : '—'}</span>
              <span>${isExpMismatch ? 'Experience mismatch' : isExpMatch ? 'Experience match' : 'Experience: Flexible'}</span>
            </div>

            <!-- Education match -->
            <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isEduMismatch ? '#dc2626' : isEduUnspecified ? textMuted : '#059669'};">
              <span style="font-weight:800;">${isEduMismatch ? '⚠' : isEduUnspecified ? '—' : '✓'}</span>
              <span>${isEduMismatch ? 'Education mismatch' : isEduUnspecified ? 'Education: Not specified' : 'Education match'}</span>
            </div>

            <!-- Skills match -->
            <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isSkillsMatch ? '#059669' : '#dc2626'};">
              <span style="font-weight:800;">${isSkillsMatch ? '✓' : '⚠'}</span>
              <span>${isSkillsMatch ? 'Skills match' : 'Missing required skills'}</span>
            </div>

            <!-- Location match -->
            <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isLocMismatch ? '#dc2626' : isLocMatch ? '#059669' : textMuted};">
              <span style="font-weight:800;">${isLocMatch ? '✓' : isLocMismatch ? '⚠' : '—'}</span>
              <span>${isLocMatch ? 'Location match' : isLocMismatch ? 'Location mismatch' : 'Location: Flexible / Remote'}</span>
            </div>
          </div>

          <!-- Experience Mismatch Callout -->
          ${isExpMismatch ? `
            <div style="
              font-size:10.5px;color:${isDark ? '#fca5a5' : '#b91c1c'};
              background:${isDark ? '#450a0a' : '#fef2f2'};
              border:1px solid ${isDark ? '#7f1d1d' : '#fecaca'};
              border-radius:7px;padding:6px 8px;margin-bottom:6px;line-height:1.4;
            ">
              <div style="font-weight:700;">⚠ Experience mismatch</div>
              <div>Required: ${escapeHtml(norm?.experienceRequiredText || '2–4 years')}</div>
              <div>Your profile: ${escapeHtml(norm?.experienceProfileText || 'Fresher')}</div>
            </div>
          ` : ''}

          <!-- Matched Skills -->
          ${matchedSkills.length > 0 ? `
            <div style="font-size:10.5px;color:${textSecondary};margin-top:4px;">
              <span style="font-weight:700;color:${textPrimary};">Matched:</span>
              <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">
                ${matchedSkills.map((s) => `
                  <span style="
                    font-size:10px;padding:1px 6px;border-radius:4px;
                    background:${isDark ? '#064e3b' : '#ecfdf5'};color:#059669;border:1px solid ${isDark ? '#047857' : '#a7f3d0'};
                  ">✓ ${escapeHtml(s)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Missing Skills -->
          ${missingSkills.length > 0 ? `
            <div style="font-size:10.5px;color:${textSecondary};margin-top:4px;">
              <span style="font-weight:700;color:${textPrimary};">Missing:</span>
              <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">
                ${missingSkills.map((s) => `
                  <span style="
                    font-size:10px;padding:1px 6px;border-radius:4px;
                    background:${isDark ? '#451a03' : '#fffbeb'};color:#d97706;border:1px solid ${isDark ? '#b45309' : '#fde68a'};
                  ">⚠ ${escapeHtml(s)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div style="height:1px;background:${borderCard};margin:8px 0;"></div>

        <!-- 3. SHORTLIST Recommendation Box -->
        <div style="
          background:${bgCard};border:1px solid ${borderCard};border-radius:9px;
          padding:8px 10px;margin-bottom:10px;
        ">
          <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:${textPrimary};">
            <span>${recommendationIcon}</span>
            <span>${escapeHtml(recommendationLabel)}</span>
          </div>
          <div style="font-size:11px;color:${textMuted};margin-left:18px;margin-top:1px;">
            ${escapeHtml(recommendationSubtitle)}
          </div>
        </div>

        <!-- 4. APPLICATION READINESS Section -->
        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:${textSecondary};letter-spacing:0.3px;text-transform:uppercase;">APPLICATION READINESS</span>
            <span style="font-size:12.5px;font-weight:800;color:#059669;">${readinessScore}%</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px;">
            ${readinessFactors.map((rf) => `
              <div style="font-size:11px;color:#059669;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">✓</span> <span>${escapeHtml(rf)}</span>
              </div>
            `).join('')}
            ${readinessIssues.map((ri) => `
              <div style="font-size:11px;color:#dc2626;display:flex;align-items:center;gap:4px;">
                <span style="font-weight:700;">⚠</span> <span>${escapeHtml(ri)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div id="talvyn-status" style="display:none;margin-bottom:8px;"></div>

        <!-- 5. Action Buttons -->
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

export function injectUnsupportedNotice(onDismiss: () => void, theme: 'light' | 'dark' | 'system' = 'system'): void {
  removePanel()

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.setAttribute('data-talvyn', 'true')

  const isDark =
    theme === 'dark' ||
    (theme !== 'light' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const borderCard = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f8fafc' : '#0f172a'
  const textSecondary = isDark ? '#cbd5e1' : '#475569'

  panel.innerHTML = `
    <div id="talvyn-panel-container">
      <div id="talvyn-panel-header" style="
        display:flex;align-items:center;justify-content:space-between;
        margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ${borderCard};
        cursor:grab;user-select:none;
      " title="Drag to move">
        <div style="display:flex;align-items:center;gap:7px;">
          <div style="
            width:22px;height:22px;background:linear-gradient(135deg, #4f46e5, #6366f1);
            border-radius:6px;display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:white;flex-shrink:0;box-shadow:0 1px 3px rgba(79,70,229,0.3);
          ">T</div>
          <span style="font-weight:700;font-size:13px;color:${textPrimary};">Talvyn Intelligence</span>
        </div>
        <button id="talvyn-dismiss-btn" style="
          background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;padding:0 2px;
        " title="Close">×</button>
      </div>

      <div style="padding:4px 2px;">
        <div style="
          background:${isDark ? '#1e293b' : '#f0fdf4'};
          border:1px solid ${isDark ? '#334155' : '#bbf7d0'};
          border-radius:10px;padding:12px;margin-bottom:10px;text-align:center;
        ">
          <div style="font-size:22px;margin-bottom:6px;">💼</div>
          <div style="font-weight:700;font-size:13px;color:${textPrimary};margin-bottom:4px;">
            Open a job page to analyze this opportunity.
          </div>
          <p style="font-size:11.5px;color:${textSecondary};line-height:1.4;margin:0;">
            Navigate to any job detail page on <strong>Unstop</strong>, <strong>Indeed</strong>, <strong>LinkedIn</strong>, or supported portals to analyze and autofill.
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <button id="talvyn-dashboard-btn" style="
            width:100%;padding:9px;background:#4f46e5;color:white;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;
          ">
            Open Talvyn Dashboard
          </button>
        </div>
      </div>
    </div>
  `

  applyPanelStyles(panel, isDark)
  document.body.appendChild(panel)
  makePanelDraggable(panel)

  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })

  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })
}

function applyPanelStyles(panel: HTMLElement, isDark: boolean = false): void {
  let savedPos: { x: number; y: number } | null = null
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (raw) savedPos = JSON.parse(raw)
  } catch {}

  const defaultWidth = 300
  let left = Math.max(16, window.innerWidth - defaultWidth - 24)
  let top = Math.max(16, window.innerHeight - 560)

  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    const maxLeft = Math.max(0, window.innerWidth - defaultWidth)
    const maxTop = Math.max(0, window.innerHeight - 200)
    left = Math.max(0, Math.min(savedPos.x, maxLeft))
    top = Math.max(0, Math.min(savedPos.y, maxTop))
  }

  Object.assign(panel.style, {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    bottom: 'auto',
    right: 'auto',
    zIndex: '2147483647',
    width: `${defaultWidth}px`,
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
    transition: 'box-shadow 0.2s ease',
  })
}

export function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove()
}

function formatJobType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

