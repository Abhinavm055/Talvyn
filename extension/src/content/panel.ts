import { ExtractedJob, OpportunityType, ApplicationReadinessResult, UserProfile } from '../types'
import { JobNormalizationResult, normalizeJob } from './jobNormalizer'
import { profileService } from '../services/profileService'
import { CONFIG } from '../utils/config'

export const PANEL_ID = 'talvyn-panel'
export const TALVYN_HOST_ID = 'talvyn-host'
export const POSITION_STORAGE_KEY = 'talvyn_panel_position'

export function getTalvynHost(): { host: HTMLElement; shadow: ShadowRoot } {
  let host = typeof document !== 'undefined' ? document.getElementById(TALVYN_HOST_ID) : null
  if (!host) {
    host = document.createElement('div')
    host.id = TALVYN_HOST_ID
    host.setAttribute('data-talvyn-host', 'true')
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.appendChild(host)
      } else if (document.documentElement) {
        document.documentElement.appendChild(host)
      }
    }
    const shadow = (host.attachShadow ? host.attachShadow({ mode: 'open' }) : host) as ShadowRoot

    if (typeof document !== 'undefined' && shadow) {
      const styleEl = document.createElement('style')
      styleEl.textContent = `
        :host {
          all: initial;
        }
        *, *::before, *::after {
          box-sizing: border-box;
        }
        button, input, select, textarea {
          font-family: inherit;
        }
      `
      shadow.appendChild(styleEl)
    }
  }
  const shadow = (host.shadowRoot || host) as ShadowRoot
  return { host, shadow }
}

export function getTalvynElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const host = document.getElementById(TALVYN_HOST_ID)
  if (host && host.shadowRoot) {
    const found = host.shadowRoot.getElementById(id)
    if (found) return found
  }
  return document.getElementById(id)
}

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

let currentOnSave: ((customJob?: ExtractedJob, customProfile?: any) => void | Promise<void>) | null = null
let currentOnApply: (() => void) | null = null
let currentOnDismiss: (() => void) | null = null
let currentOnProfileUpdated: ((profile: UserProfile) => void | Promise<void>) | null = null
let currentJobData: ExtractedJob | null = null
let currentOptionsData: any = null
let isPanelDark = false

export function injectPanel(
  job: ExtractedJob,
  onSave: (customJob?: ExtractedJob, customProfile?: any) => void | Promise<void>,
  onApply: () => void,
  onDismiss: () => void,
  options?: {
    opportunityType?: OpportunityType
    readiness?: ApplicationReadinessResult | null
    deadline?: string | null
    normalization?: JobNormalizationResult
    isConnected?: boolean
    theme?: 'light' | 'dark' | 'system'
    userProfile?: UserProfile | null
    resumeName?: string
    onProfileUpdated?: (profile: UserProfile) => void | Promise<void>
  }
): void {
  removePanel()

  currentOnSave = onSave
  currentOnApply = onApply
  currentOnDismiss = onDismiss
  currentOnProfileUpdated = options?.onProfileUpdated || null
  currentJobData = job
  currentOptionsData = options

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.setAttribute('data-talvyn', 'true')
  panel.style.pointerEvents = 'auto'

  const isDark =
    options?.theme === 'dark' ||
    (options?.theme !== 'light' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  isPanelDark = Boolean(isDark)

  panel.innerHTML = buildPanelHTML(job, options, isDark)
  applyPanelStyles(panel, isDark)

  const { shadow } = getTalvynHost()
  shadow.appendChild(panel)

  const header = panel.querySelector('#talvyn-panel-header') as HTMLElement | null
  if (header) {
    makeElementDraggable(panel, header, POSITION_STORAGE_KEY)
  }

  attachActionListeners(panel, job, options)

  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })

  panel.querySelector('#talvyn-collapse-btn')?.addEventListener('click', () => {
    toggleCollapse(panel)
  })
}

// ─── Draggable Viewport Implementation ───────────────────────────────────────

export function makeElementDraggable(
  panel: HTMLElement,
  header: HTMLElement,
  storageKey: string = POSITION_STORAGE_KEY
): void {
  if (
    !panel ||
    !header ||
    typeof header.addEventListener !== 'function'
  ) {
    return
  }

  header.style.cursor = 'grab'
  header.style.userSelect = 'none'
  header.style.touchAction = 'none'

  let isDragging = false
  let startX = 0
  let startY = 0
  let initialLeft = 0
  let initialTop = 0
  let hasMovedEnough = false
  let prevUserSelect = ''

  const onPointerDown = (e: PointerEvent | MouseEvent) => {
    if (e.target && (e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')) {
      return
    }

    if ('button' in e && e.button !== 0) return

    isDragging = true
    hasMovedEnough = false
    startX = e.clientX
    startY = e.clientY

    const rect = panel.getBoundingClientRect()
    initialLeft = rect.left
    initialTop = rect.top

    panel.style.bottom = 'auto'
    panel.style.right = 'auto'
    panel.style.left = `${initialLeft}px`
    panel.style.top = `${initialTop}px`

    if ('setPointerCapture' in header && 'pointerId' in e) {
      try {
        header.setPointerCapture((e as PointerEvent).pointerId)
      } catch {}
    }

    if (e.preventDefault) e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent | MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY

    if (!hasMovedEnough && Math.hypot(deltaX, deltaY) > 3) {
      hasMovedEnough = true
      header.style.cursor = 'grabbing'
      if (typeof document !== 'undefined' && document.body) {
        prevUserSelect = document.body.style.userSelect
        document.body.style.userSelect = 'none'
      }
    }

    if (!hasMovedEnough) return

    let newLeft = initialLeft + deltaX
    let newTop = initialTop + deltaY

    const panelWidth = panel.offsetWidth || 380
    const panelHeight = panel.offsetHeight || 580
    const viewWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200
    const viewHeight = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800
    const maxLeft = Math.max(0, viewWidth - panelWidth)
    const maxTop = Math.max(0, viewHeight - panelHeight)

    newLeft = Math.max(0, Math.min(newLeft, maxLeft))
    newTop = Math.max(0, Math.min(newTop, maxTop))

    panel.style.left = `${newLeft}px`
    panel.style.top = `${newTop}px`
  }

  const onPointerUp = (e?: PointerEvent | MouseEvent) => {
    if (!isDragging) return
    isDragging = false
    header.style.cursor = 'grab'
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.userSelect = prevUserSelect
    }

    if (e && 'releasePointerCapture' in header && 'pointerId' in e) {
      try {
        header.releasePointerCapture((e as PointerEvent).pointerId)
      } catch {}
    }

    if (hasMovedEnough) {
      try {
        const rect = panel.getBoundingClientRect()
        localStorage.setItem(storageKey, JSON.stringify({ x: rect.left, y: rect.top }))
      } catch {
        /* ignore */
      }
    }
  }

  header.addEventListener('pointerdown', onPointerDown as any)
  header.addEventListener('pointermove', onPointerMove as any)
  header.addEventListener('pointerup', onPointerUp as any)
  header.addEventListener('pointercancel', onPointerUp as any)

  // Mouse fallback for environments or tests where PointerEvent is polyfilled as MouseEvent
  header.addEventListener('mousedown', onPointerDown as any)
  const onDocMouseMove = (e: MouseEvent) => onPointerMove(e)
  const onDocMouseUp = (e: MouseEvent) => {
    onPointerUp(e)
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('mousemove', onDocMouseMove)
      document.removeEventListener('mouseup', onDocMouseUp)
    }
  }
  header.addEventListener('mousedown', () => {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('mousemove', onDocMouseMove)
      document.addEventListener('mouseup', onDocMouseUp)
    }
  })
}

// ─── Attach Listeners ───────────────────────────────────────────────────────

function attachActionListeners(panel: HTMLElement, job?: ExtractedJob, options?: any): void {
  const saveBtn = panel.querySelector('#talvyn-save-btn')
  saveBtn?.addEventListener('click', () => {
    openReviewScreen(panel, job || currentJobData!, options || currentOptionsData)
  })

  panel.querySelector('#talvyn-back-to-jobs-btn')?.addEventListener('click', () => {
    if (options?.onBackToListing) {
      options.onBackToListing()
    }
  })

  panel.querySelector('#talvyn-profile-btn')?.addEventListener('click', () => {
    openProfileView(panel, job || currentJobData!, options || currentOptionsData)
  })

  panel.querySelector('#talvyn-apply-btn')?.addEventListener('click', () => {
    openApplyReviewScreen(panel, job || currentJobData!, options || currentOptionsData)
  })

  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })

  panel.querySelector('#talvyn-open-job-btn')?.addEventListener('click', () => {
    const url = job?.jobUrl || currentJobData?.jobUrl
    if (url) window.open(url, '_blank')
  })
}

export const CAPSULE_ID = 'talvyn-capsule'

function toggleCollapse(panel: HTMLElement): void {
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  const collapseBtn = panel.querySelector('#talvyn-collapse-btn') as HTMLElement | null
  const { shadow } = getTalvynHost()

  let capsule = getTalvynElement(CAPSULE_ID)
  if (!capsule) {
    capsule = document.createElement('div')
    capsule.id = CAPSULE_ID
    capsule.setAttribute('data-talvyn-capsule', 'true')
    capsule.style.display = 'none'
    capsule.style.pointerEvents = 'auto'
    capsule.innerHTML = `
      <div id="talvyn-capsule-handle" style="
        display:flex;align-items:center;gap:7px;padding:8px 14px;
        background:linear-gradient(135deg, #4f46e5, #6366f1);
        color:white;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
        font-size:12px;font-weight:800;letter-spacing:0.5px;
        box-shadow:0 6px 20px rgba(79,70,229,0.4);cursor:pointer;
        user-select:none;border:1.5px solid rgba(255,255,255,0.25);
        transition:transform 0.15s ease;
      " title="Click to open Talvyn Job Intelligence">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;"></span>
        <span>TALVYN</span>
      </div>
    `
    Object.assign(capsule.style, {
      position: 'fixed',
      zIndex: '2147483647',
      userSelect: 'none',
    })
    shadow.appendChild(capsule)
    const handle = capsule.querySelector('#talvyn-capsule-handle') as HTMLElement
    if (handle) {
      makeElementDraggable(capsule, handle, 'talvyn_capsule_position')
    }

    capsule.addEventListener('click', () => {
      restorePanel(panel)
    })
  }

  // Toggle between full panel and small capsule
  if (panel.style.display !== 'none' && (!body || body.style.display !== 'none')) {
    const rect = panel.getBoundingClientRect()
    panel.style.display = 'none'
    if (body) body.style.display = 'none'
    if (collapseBtn) {
      collapseBtn.textContent = '+'
      collapseBtn.title = 'Expand'
    }

    capsule.style.display = 'flex'
    capsule.style.left = `${Math.max(10, rect.left)}px`
    capsule.style.top = `${Math.max(10, rect.top)}px`
  } else {
    restorePanel(panel)
  }
}

export function restorePanel(panel: HTMLElement): void {
  const capsule = getTalvynElement(CAPSULE_ID)
  if (capsule) {
    capsule.style.display = 'none'
  }
  panel.style.display = 'flex'
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  if (body) {
    body.style.display = 'block'
  }
  const collapseBtn = panel.querySelector('#talvyn-collapse-btn') as HTMLElement | null
  if (collapseBtn) {
    collapseBtn.textContent = '−'
    collapseBtn.title = 'Minimize'
  }
}

// ─── Save Confirmation / Edit Screen (Part 10) ──────────────────────────────

export function openConfirmSaveScreen(panel: HTMLElement, job: ExtractedJob, options?: any): void {
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  if (!body) return

  const norm = options?.normalization
  const borderCard = isPanelDark ? '#334155' : '#e2e8f0'
  const textPrimary = isPanelDark ? '#f8fafc' : '#0f172a'
  const textSecondary = isPanelDark ? '#cbd5e1' : '#475569'
  const bgCard = isPanelDark ? '#1e293b' : '#f8fafc'
  const bgInput = isPanelDark ? '#0f172a' : '#ffffff'

  const currentExp = job.experience || norm?.experienceRequiredText || ''
  const currentEdu = job.education || norm?.educationRequiredText || ''

  body.innerHTML = `
    <div id="talvyn-confirm-save-view" style="font-size:12px;color:${textPrimary};">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${borderCard};">
        <div>
          <div style="font-weight:800;font-size:12px;letter-spacing:0.4px;color:#4f46e5;text-transform:uppercase;">
            CONFIRM JOB DETAILS
          </div>
          <div style="font-size:10.5px;color:${textSecondary};">
            Review and adjust details before saving to your Tracker.
          </div>
        </div>
        <button id="talvyn-save-cancel-x" style="background:none;border:none;color:${textSecondary};font-size:15px;cursor:pointer;padding:0 3px;">✕</button>
      </div>

      <div style="max-height:380px;overflow-y:auto;padding-right:2px;display:flex;flex-direction:column;gap:8px;">
        <!-- Editable Job Fields -->
        <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;">
          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Job Title
            </label>
            <input type="text" id="talvyn-edit-title" value="${escapeHtml(job.title || '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Company
            </label>
            <input type="text" id="talvyn-edit-company" value="${escapeHtml(job.company || '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Location
            </label>
            <input type="text" id="talvyn-edit-location" value="${escapeHtml(job.location || '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " placeholder="e.g. Bangalore, Remote" />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Salary / Stipend
            </label>
            <input type="text" id="talvyn-edit-salary" value="${escapeHtml(job.salary || '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " placeholder="e.g. ₹8–12 LPA, $120,000" />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Job Type
            </label>
            <input type="text" id="talvyn-edit-jobType" value="${escapeHtml(job.jobType ? formatJobType(job.jobType) : 'Full Time')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " placeholder="Full Time, Internship, Contract" />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Experience
            </label>
            <input type="text" id="talvyn-edit-experience" value="${escapeHtml(currentExp !== 'Not specified' ? currentExp : '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " placeholder="e.g. 2–4 years, Fresher" />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Education
            </label>
            <input type="text" id="talvyn-edit-education" value="${escapeHtml(currentEdu !== 'Not specified' ? currentEdu : '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " placeholder="e.g. B.Tech / equivalent, Bachelor's" />
          </div>

          <div>
            <label style="display:block;font-size:10.5px;font-weight:700;color:${textSecondary};margin-bottom:3px;text-transform:uppercase;">
              Job URL
            </label>
            <input type="text" id="talvyn-edit-url" value="${escapeHtml(job.jobUrl || '')}" style="
              width:100%;padding:6px 8px;font-size:12px;border:1px solid ${borderCard};border-radius:6px;
              background:${bgInput};color:${textPrimary};outline:none;
            " />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="talvyn-cancel-save-btn" style="
          flex:1;padding:8px 12px;background:transparent;color:${textSecondary};
          border:1px solid ${borderCard};border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;
        ">
          Cancel
        </button>
        <button id="talvyn-confirm-save-btn" style="
          flex:1.5;padding:8px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
          color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;
          box-shadow:0 2px 6px rgba(79,70,229,0.25);
        ">
          Confirm & Save
        </button>
      </div>
    </div>
  `

  const restoreCurrentView = () => {
    body.innerHTML = buildBodyHTML(job, options, isPanelDark)
    attachActionListeners(panel, job, options)
  }

  body.querySelector('#talvyn-save-cancel-x')?.addEventListener('click', restoreCurrentView)
  body.querySelector('#talvyn-cancel-save-btn')?.addEventListener('click', restoreCurrentView)
  body.querySelector('#talvyn-cancel-review-btn')?.addEventListener('click', restoreCurrentView)

  body.querySelector('#talvyn-confirm-save-btn')?.addEventListener('click', async () => {
    const titleVal = (body.querySelector('#talvyn-edit-title') as HTMLInputElement)?.value.trim() || job.title
    const compVal = (body.querySelector('#talvyn-edit-company') as HTMLInputElement)?.value.trim() || job.company
    const locVal = (body.querySelector('#talvyn-edit-location') as HTMLInputElement)?.value.trim() || job.location
    const salVal = (body.querySelector('#talvyn-edit-salary') as HTMLInputElement)?.value.trim() || job.salary
    const typeVal = (body.querySelector('#talvyn-edit-jobType') as HTMLInputElement)?.value.trim() || job.jobType
    const expVal = (body.querySelector('#talvyn-edit-experience') as HTMLInputElement)?.value.trim() || currentExp
    const eduVal = (body.querySelector('#talvyn-edit-education') as HTMLInputElement)?.value.trim() || currentEdu
    const urlVal = (body.querySelector('#talvyn-edit-url') as HTMLInputElement)?.value.trim() || job.jobUrl

    const updatedJob: ExtractedJob = {
      ...job,
      title: titleVal,
      company: compVal,
      location: locVal || undefined,
      salary: salVal || undefined,
      jobType: typeVal || undefined,
      experience: expVal || undefined,
      education: eduVal || undefined,
      jobUrl: urlVal,
    }

    if (currentOnSave) {
      await currentOnSave(updatedJob, options?.userProfile)
    }
  })
}

export const openReviewScreen = openConfirmSaveScreen

// ─── Controlled Review Before Apply Modal ───────────────────────────────────

function openApplyReviewScreen(panel: HTMLElement, job: ExtractedJob, options?: any): void {
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  if (!body) return

  const profile = options?.userProfile
  const borderCard = isPanelDark ? '#334155' : '#e2e8f0'
  const textPrimary = isPanelDark ? '#f8fafc' : '#0f172a'
  const textSecondary = isPanelDark ? '#cbd5e1' : '#475569'
  const bgCard = isPanelDark ? '#1e293b' : '#f8fafc'

  const fullName = profile?.legalFullName || profile?.name || `${profile?.givenName || ''} ${profile?.familyName || ''}`.trim() || 'Candidate Name'
  const email = profile?.email || 'email@example.com'
  const phone = profile?.phoneNumber || profile?.phone || '— Not provided'
  const location = profile?.preferredLocations?.[0] || profile?.location || profile?.city || '— Not provided'
  const linkedin = profile?.linkedInUrl || profile?.linkedinUrl || '— Not provided'
  const github = profile?.githubUrl || '— Not provided'
  const resume = options?.resumeName || 'Default Resume'
  const workAuth = profile?.workAuthorization || 'Requires Review'
  const salary = profile?.expectedSalary || 'Requires Review'

  body.innerHTML = `
    <div id="talvyn-apply-review-view" style="font-size:12px;color:${textPrimary};">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${borderCard};">
        <div>
          <span style="font-weight:700;font-size:12px;letter-spacing:0.3px;color:#4f46e5;text-transform:uppercase;">
            CONTROLLED APPLICATION REVIEW
          </span>
          <div style="font-size:10.5px;color:${textSecondary};margin-top:1px;">
            Talvyn will autofill safe candidate fields and verify sensitive items.
          </div>
        </div>
        <button id="talvyn-apply-review-cancel-x" style="background:none;border:none;color:${textSecondary};font-size:14px;cursor:pointer;padding:0 3px;">✕</button>
      </div>

      <div style="max-height:360px;overflow-y:auto;padding-right:2px;display:flex;flex-direction:column;gap:8px;">
        <!-- SAFE FIELDS SECTION -->
        <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:8px;padding:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:11px;color:#059669;text-transform:uppercase;display:flex;align-items:center;gap:4px;">
              <span>✓</span> Safe Fields (Autofilled Directly)
            </span>
          </div>
          <div style="font-size:11px;color:${textSecondary};display:flex;flex-direction:column;gap:3px;">
            <div><strong>Name:</strong> ${escapeHtml(fullName)}</div>
            <div><strong>Email:</strong> ${escapeHtml(email)}</div>
            <div><strong>Phone:</strong> ${escapeHtml(phone)}</div>
            <div><strong>Location:</strong> ${escapeHtml(location)}</div>
            <div><strong>LinkedIn:</strong> ${escapeHtml(linkedin)}</div>
            <div><strong>GitHub:</strong> ${escapeHtml(github)}</div>
            <div><strong>Resume:</strong> ${escapeHtml(resume)}</div>
          </div>
        </div>

        <!-- SENSITIVE FIELDS SECTION -->
        <div style="background:${isPanelDark ? '#451a03' : '#fffbeb'};border:1px solid ${isPanelDark ? '#b45309' : '#fde68a'};border-radius:8px;padding:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:11px;color:#d97706;text-transform:uppercase;display:flex;align-items:center;gap:4px;">
              <span>🛡️</span> Sensitive Fields (Explicit User Review)
            </span>
          </div>
          <div style="font-size:10.5px;color:${isPanelDark ? '#fef3c7' : '#92400e'};line-height:1.4;display:flex;flex-direction:column;gap:4px;">
            <div>• <strong>Work Authorization / Visa:</strong> ${escapeHtml(workAuth)}</div>
            <div>• <strong>Expected Salary / CTC:</strong> ${escapeHtml(salary)}</div>
            <div>• <strong>Disability & Veteran Status:</strong> Prompt before fill</div>
            <div>• <strong>Legal Declarations / Sponsorship:</strong> Prompt before fill</div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="talvyn-review-continue-btn" style="
          flex:1;padding:8px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
          color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;
          box-shadow:0 2px 6px rgba(79,70,229,0.25);
        ">
          Review & Continue ⚡
        </button>
        <button id="talvyn-review-edit-profile-btn" style="
          padding:8px 12px;background:transparent;color:#4f46e5;
          border:1px solid #c7d2fe;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;
        ">
          👤 Edit Details
        </button>
        <button id="talvyn-cancel-apply-review-btn" style="
          padding:8px 10px;background:transparent;color:${textSecondary};
          border:1px solid ${borderCard};border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;
        ">
          Cancel
        </button>
      </div>
    </div>
  `

  const cancelAction = () => {
    body.innerHTML = buildBodyHTML(job, options, isPanelDark)
    attachActionListeners(panel, job, options)
  }

  body.querySelector('#talvyn-apply-review-cancel-x')?.addEventListener('click', cancelAction)
  body.querySelector('#talvyn-cancel-apply-review-btn')?.addEventListener('click', cancelAction)

  body.querySelector('#talvyn-review-edit-profile-btn')?.addEventListener('click', () => {
    openProfileView(panel, job, options)
  })

  body.querySelector('#talvyn-review-continue-btn')?.addEventListener('click', () => {
    body.innerHTML = buildBodyHTML(job, options, isPanelDark)
    attachActionListeners(panel, job, options)
    if (currentOnApply) {
      currentOnApply()
    }
  })
}

// ─── Candidate Profile Inspector / Editor Modal ──────────────────────────────

function openProfileView(panel: HTMLElement, job: ExtractedJob, options?: any): void {
  const body = panel.querySelector('#talvyn-panel-body') as HTMLElement | null
  if (!body) return

  const profile = options?.userProfile
  const borderCard = isPanelDark ? '#334155' : '#e2e8f0'
  const textPrimary = isPanelDark ? '#f8fafc' : '#0f172a'
  const textSecondary = isPanelDark ? '#cbd5e1' : '#475569'
  const bgCard = isPanelDark ? '#1e293b' : '#f8fafc'
  const bgInput = isPanelDark ? '#0f172a' : '#ffffff'

  const givenName = profile?.givenName || profile?.name?.split(' ')[0] || ''
  const familyName = profile?.familyName || profile?.name?.split(' ').slice(1).join(' ') || ''
  const email = profile?.email || ''
  const phone = profile?.phoneNumber || profile?.phone || ''
  const loc = profile?.preferredLocations?.[0] || profile?.location || profile?.city || ''
  const roles = (profile?.preferredRoles || []).join(', ')
  const expYears = profile?.experienceYears !== undefined && profile?.experienceYears !== null ? String(profile?.experienceYears) : '0'
  const degree = profile?.degree || profile?.education || ''
  const skills = (profile?.skills || []).join(', ')
  const linkedin = profile?.linkedInUrl || profile?.linkedinUrl || ''
  const github = profile?.githubUrl || ''
  const workAuth = profile?.workAuthorization || ''
  const expectedSalary = profile?.expectedSalary || ''

  body.innerHTML = `
    <div id="talvyn-profile-view" style="font-size:12px;color:${textPrimary};">
      <!-- Top Title -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${borderCard};">
        <div>
          <span style="font-weight:700;font-size:12px;letter-spacing:0.3px;color:#4f46e5;text-transform:uppercase;">
            CANDIDATE PROFILE
          </span>
          <div style="font-size:10.5px;color:${textSecondary};margin-top:1px;">
            Edit profile data to update deterministic matching
          </div>
        </div>
        <button id="talvyn-profile-cancel-x" style="background:none;border:none;color:${textSecondary};font-size:14px;cursor:pointer;padding:0 3px;">✕</button>
      </div>

      <div style="max-height:360px;overflow-y:auto;padding-right:2px;display:flex;flex-direction:column;gap:8px;">
        <!-- CAREER TARGETS -->
        <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:8px;padding:8px;">
          <div style="font-weight:700;font-size:11px;color:${textSecondary};margin-bottom:6px;text-transform:uppercase;">
            🎯 Career Targeting
          </div>
          ${renderEditableRow('Target Roles', 'p-roles', roles, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Exp (Years)', 'p-exp', expYears, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Degree', 'p-degree', degree, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Skills', 'p-skills', skills, bgInput, borderCard, textPrimary)}
        </div>

        <!-- PERSONAL & CONTACT -->
        <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:8px;padding:8px;">
          <div style="font-weight:700;font-size:11px;color:${textSecondary};margin-bottom:6px;text-transform:uppercase;">
            👤 Contact & Links
          </div>
          ${renderEditableRow('Given Name', 'p-given', givenName, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Family Name', 'p-family', familyName, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Email', 'p-email', email, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Phone', 'p-phone', phone, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Location', 'p-loc', loc, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('LinkedIn', 'p-linkedin', linkedin, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('GitHub', 'p-github', github, bgInput, borderCard, textPrimary)}
        </div>

        <!-- PREFERENCES & SENSITIVE -->
        <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:8px;padding:8px;">
          <div style="font-weight:700;font-size:11px;color:${textSecondary};margin-bottom:6px;text-transform:uppercase;">
            🛡️ Preferences & Authorization
          </div>
          ${renderEditableRow('Work Auth', 'p-auth', workAuth, bgInput, borderCard, textPrimary)}
          ${renderEditableRow('Exp Salary', 'p-salary', expectedSalary, bgInput, borderCard, textPrimary)}
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="talvyn-save-profile-btn" style="
          flex:1;padding:8px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);
          color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;
          box-shadow:0 2px 6px rgba(79,70,229,0.25);
        ">
          💾 Save Profile & Re-Run Matching
        </button>
        <button id="talvyn-cancel-profile-btn" style="
          padding:8px 12px;background:transparent;color:${textSecondary};
          border:1px solid ${borderCard};border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;
        ">
          Cancel
        </button>
      </div>
    </div>
  `

  // Attach Edit toggles
  body.querySelectorAll('.talvyn-edit-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const fieldId = (e.currentTarget as HTMLElement).getAttribute('data-field')
      if (!fieldId) return
      const displaySpan = body.querySelector(`#disp-${fieldId}`) as HTMLElement | null
      const inputEl = body.querySelector(`#inp-${fieldId}`) as HTMLInputElement | null
      const toggleBtn = e.currentTarget as HTMLElement

      if (inputEl && displaySpan) {
        if (inputEl.style.display === 'none') {
          inputEl.style.display = 'block'
          displaySpan.style.display = 'none'
          inputEl.focus()
          toggleBtn.textContent = 'Done'
        } else {
          inputEl.style.display = 'none'
          displaySpan.style.display = 'block'
          displaySpan.textContent = inputEl.value.trim() || '—'
          toggleBtn.textContent = 'Edit'
        }
      }
    })
  })

  // Cancel action
  const cancelAction = () => {
    body.innerHTML = buildBodyHTML(job, options, isPanelDark)
    attachActionListeners(panel, job, options)
  }
  body.querySelector('#talvyn-profile-cancel-x')?.addEventListener('click', cancelAction)
  body.querySelector('#talvyn-cancel-profile-btn')?.addEventListener('click', cancelAction)

  // Save profile and re-run matching
  body.querySelector('#talvyn-save-profile-btn')?.addEventListener('click', async (e) => {
    const saveBtn = e.currentTarget as HTMLButtonElement
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving Profile...'

    const getValue = (id: string, fallback: string) => {
      const inp = body.querySelector(`#inp-${id}`) as HTMLInputElement | null
      return inp ? inp.value.trim() : fallback
    }

    const expStr = getValue('p-exp', expYears)
    const parsedExp = parseInt(expStr, 10)
    const finalExpYears = isNaN(parsedExp) ? 0 : parsedExp

    const rawRoles = getValue('p-roles', roles)
    const preferredRoles = rawRoles ? rawRoles.split(',').map((r) => r.trim()).filter(Boolean) : []

    const rawSkills = getValue('p-skills', skills)
    const skillsArray = rawSkills ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean) : []

    const updatedProfile: UserProfile = {
      ...(profile || {}),
      id: profile?.id || 'user',
      userId: profile?.userId || 'user',
      givenName: getValue('p-given', givenName),
      familyName: getValue('p-family', familyName),
      name: `${getValue('p-given', givenName)} ${getValue('p-family', familyName)}`.trim(),
      email: getValue('p-email', email),
      phoneNumber: getValue('p-phone', phone),
      location: getValue('p-loc', loc),
      preferredLocations: [getValue('p-loc', loc)].filter(Boolean),
      preferredRoles,
      experienceYears: finalExpYears,
      degree: getValue('p-degree', degree),
      skills: skillsArray,
      linkedInUrl: getValue('p-linkedin', linkedin),
      githubUrl: getValue('p-github', github),
      workAuthorization: getValue('p-auth', workAuth),
      expectedSalary: getValue('p-salary', expectedSalary),
      preferredJobTypes: profile?.preferredJobTypes || [],
      otherLinks: profile?.otherLinks || [],
      workStyle: profile?.workStyle || 'ANY',
      onboardingCompleted: true,
    }

    try {
      await profileService.update({
        givenName: updatedProfile.givenName,
        familyName: updatedProfile.familyName,
        email: updatedProfile.email,
        phone: updatedProfile.phoneNumber,
        preferredRoles: updatedProfile.preferredRoles,
        experienceYears: updatedProfile.experienceYears,
        degree: updatedProfile.degree,
        skills: updatedProfile.skills,
        preferredLocations: updatedProfile.preferredLocations,
        linkedinUrl: updatedProfile.linkedInUrl,
        githubUrl: updatedProfile.githubUrl,
        workAuthorization: updatedProfile.workAuthorization,
        expectedSalary: updatedProfile.expectedSalary,
      } as any)
    } catch (err) {
      console.warn('[Talvyn] Profile update error:', err)
    }

    // Re-run matching with updated profile
    const newNorm = normalizeJob(job, updatedProfile)
    if (options) {
      options.userProfile = updatedProfile
      options.normalization = newNorm
    }
    currentOptionsData = options

    if (currentOnProfileUpdated) {
      try {
        await currentOnProfileUpdated(updatedProfile)
      } catch {}
    }

    // Restore intelligence view with new normalization
    body.innerHTML = buildBodyHTML(job, options, isPanelDark)
    attachActionListeners(panel, job, options)
  })
}

function renderEditableRow(
  label: string,
  fieldId: string,
  value: string,
  bgInput: string,
  borderCard: string,
  textPrimary: string
): string {
  const displayVal = value.trim() ? value : '—'
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;font-size:11px;">
      <span style="color:#64748b;font-weight:500;min-width:65px;flex-shrink:0;">${escapeHtml(label)}:</span>
      <div style="flex:1;min-width:0;">
        <span id="disp-${fieldId}" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">
          ${escapeHtml(displayVal)}
        </span>
        <input id="inp-${fieldId}" value="${escapeHtml(value)}" style="
          display:none;width:100%;padding:2px 5px;font-size:11px;border:1px solid #4f46e5;
          border-radius:4px;background:${bgInput};color:${textPrimary};box-sizing:border-box;
        " />
      </div>
      <button class="talvyn-edit-toggle" data-field="${fieldId}" style="
        background:none;border:1px solid ${borderCard};border-radius:4px;padding:1px 5px;
        font-size:10px;font-weight:600;color:#4f46e5;cursor:pointer;flex-shrink:0;
      ">Edit</button>
    </div>
  `
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildPanelHTML(job: ExtractedJob, options?: any, isDark: boolean = false): string {
  const borderCard = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f8fafc' : '#0f172a'
  const textMuted = isDark ? '#94a3b8' : '#64748b'

  return `
    <div id="talvyn-panel-container" style="display:flex;flex-direction:column;height:100%;max-height:580px;overflow:hidden;width:100%;box-sizing:border-box;">
      <!-- Header (Draggable Handle) -->
      <div id="talvyn-panel-header" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 14px;border-bottom:1px solid ${borderCard};
        cursor:grab;user-select:none;flex-shrink:0;background:${isDark ? '#1e293b' : '#4f46e5'};
        color:white;border-top-left-radius:14px;border-top-right-radius:14px;
      " title="Drag to move panel">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="
            width:22px;height:22px;background:rgba(255,255,255,0.25);
            border-radius:6px;display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:white;flex-shrink:0;
          ">T</div>
          <span style="font-weight:800;font-size:13px;letter-spacing:0.3px;">Talvyn</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${options?.isConnected !== false ? `
          <span style="
            font-size:10.5px;font-weight:700;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;
            padding:2px 7px;border-radius:999px;display:inline-flex;align-items:center;gap:3px;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:#10b981;display:inline-block;"></span>
            ● Connected
          </span>
          ` : `
          <span style="
            font-size:10.5px;font-weight:700;color:${isDark ? '#94a3b8' : '#64748b'};background:${isDark ? '#0f172a' : '#f1f5f9'};
            padding:2px 7px;border-radius:999px;display:inline-flex;align-items:center;gap:3px;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
            Guest
          </span>
          `}
          <button id="talvyn-profile-btn" style="
            background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:6px;
            padding:2px 6px;cursor:pointer;color:white;font-size:11px;font-weight:600;
          " title="Candidate Profile">👤 Profile</button>
          <button id="talvyn-collapse-btn" style="
            background:rgba(255,255,255,0.15);border:none;cursor:pointer;color:white;font-size:15px;
            font-weight:700;line-height:1;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          " title="Minimize">−</button>
          <button id="talvyn-dismiss-btn" style="
            background:rgba(255,255,255,0.15);border:none;cursor:pointer;color:white;font-size:16px;
            line-height:1;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          " title="Close">×</button>
        </div>
      </div>

      <div id="talvyn-panel-body" style="
        flex:1;overflow-y:auto;padding:12px 14px;background:${isDark ? '#0f172a' : '#ffffff'};
        display:flex;flex-direction:column;
      ">
        ${buildBodyHTML(job, options, isDark)}
      </div>
    </div>
  `
}

export interface StructuredJobSections {
  overview: {
    title: string
    company: string
    location: string
    jobType: string
    salary: string
    experience: string
    education: string
  }
  descriptionSummary: string
  responsibilities: string[]
  requirements: string[]
  reason: string
}

export function extractStructuredSections(job: ExtractedJob, norm?: JobNormalizationResult): StructuredJobSections {
  const currentExp = job.experience || norm?.experienceRequiredText || '— Not specified'
  const currentEdu = job.education || norm?.educationRequiredText || '— Not specified'
  const location = job.location || '— Not specified'
  const salary = job.salary || '— Not specified'
  const jobType = job.jobType ? formatJobType(job.jobType) : '— Not specified'

  // Deterministic description summary
  let descriptionSummary = '— Not specified'
  const rawDesc = job.description || ''
  if (rawDesc.trim()) {
    const cleanText = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (cleanText.length > 0) {
      // Strip leading metadata chip phrases like "Eligibility Fresher Locations Delhi"
      const cleanedDesc = cleanText.replace(/^(eligibility\s+fresher\s+locations?\s+[a-z0-9\s,.-]+(?=[A-Z]|\.|$)|eligibility\s*:\s*[^\.\n]+|locations?\s*:\s*[^\.\n]+)\s*/i, '').trim()
      const targetSummaryText = cleanedDesc.length > 20 ? cleanedDesc : cleanText
      const sentences = targetSummaryText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15)
      if (sentences.length > 0) {
        descriptionSummary = sentences.slice(0, 2).join(' ')
        if (descriptionSummary.length > 280) {
          descriptionSummary = descriptionSummary.substring(0, 280) + '...'
        }
      } else {
        descriptionSummary = targetSummaryText.length > 200 ? targetSummaryText.substring(0, 200) + '...' : targetSummaryText
      }
    }
  }

  // Deterministic responsibilities extraction
  let responsibilities: string[] = []
  if (job.responsibilities && job.responsibilities.length > 0) {
    responsibilities = job.responsibilities.slice(0, 4)
  } else if (job.description) {
    const text = job.description
    const respMatch = text.match(/(?:responsibilities|duties|what you(?:'ll|\s+will)\s+do|key responsibilities|major responsibilities|primary responsibilities|your role|role and responsibilities|role & responsibilities|day[ -]to[ -]day)[:\s]+([\s\S]*?)(?:requirements|qualifications|skills|who you are|eligibility|what you(?:'ll|\s+will)\s+need|what we offer|benefits|about us|$)/i)
    const targetText = (respMatch && respMatch[1]) ? respMatch[1] : (text || '')
    const lines = targetText
      .split(/\n|<br\s*\/?>|<li>/i)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .filter((l) => {
        if (!l || l.length < 8) return false
        const isBullet = /^[•\-*–—\u2022\u2023\u25E6\u2043\u2219]|\d+[\.\)]/.test(l)
        if (isBullet) return true
        if (respMatch && l.length >= 15 && l.length <= 250 && !/^(about|overview|details|company|salary|location|apply)/i.test(l)) return true
        return /^(design|develop|build|collaborate|lead|manage|maintain|implement|create|deliver|support|coordinate|review|test|activate|enroll|convert|drive|sell|promote|execute|identify|generate|assist|prepare|conduct|ensure|participate|oversee)\b/i.test(l)
      })
      .map((l) => l.replace(/^[•\-*–—\u2022\u2023\u25E6\u2043\u2219]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((l) => l.length > 10 && l.length < 250)

    if (lines.length > 0) {
      responsibilities = lines.slice(0, 4)
    }
  }
  if (responsibilities.length === 0) {
    responsibilities = ['— Not specified']
  }

  // Deterministic requirements extraction
  let requirements: string[] = []
  if (job.requirements && job.requirements.length > 0) {
    requirements = job.requirements.slice(0, 4)
  } else if (job.description) {
    const text = job.description
    const reqMatch = text.match(/(?:requirements|qualifications|basic qualifications|minimum qualifications|preferred qualifications|what we(?:'re|\s+are)\s+looking\s+for|who you are|must have|what you(?:'ll|\s+will)\s+need|skills and qualifications|skills & requirements|key requirements|eligibility(?: criteria)?|skills)[:\s]+([\s\S]*?)(?:responsibilities|duties|what you will do|what you'll do|benefits|about us|perks|what we offer|$)/i)
    const targetText = (reqMatch && reqMatch[1]) ? reqMatch[1] : (text || '')
    const lines = targetText
      .split(/\n|<br\s*\/?>|<li>/i)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .filter((l) => {
        if (!l || l.length < 8) return false
        const isBullet = /^[•\-*–—\u2022\u2023\u25E6\u2043\u2219]|\d+[\.\)]/.test(l)
        if (isBullet) return true
        if (reqMatch && l.length >= 15 && l.length <= 250 && !/^(about|overview|details|company|salary|location|apply)/i.test(l)) return true
        return /^(bachelor|master|degree|\d+\+?\s*years|experience|proficiency|strong|knowledge|familiarity|good|ability|willingness|excellent|proven|hands-on)\b/i.test(l)
      })
      .map((l) => l.replace(/^[•\-*–—\u2022\u2023\u25E6\u2043\u2219]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((l) => l.length > 10 && l.length < 250)

    if (lines.length > 0) {
      requirements = lines.slice(0, 4)
    }
  }
  if (requirements.length === 0 && (norm?.missingSkills?.length || norm?.matchedSkills?.length)) {
    requirements = [
      currentExp !== '— Not specified' ? `Experience: ${currentExp}` : '',
      currentEdu !== '— Not specified' ? `Education: ${currentEdu}` : '',
      ...(norm?.missingSkills || []).slice(0, 2).map((s) => `Proficiency in ${s}`),
    ].filter(Boolean)
  }
  if (requirements.length === 0) {
    requirements = ['— Not specified']
  }

  // Deterministic recommendation reason
  let reason = 'Moderate alignment with partial skill and requirement overlap.'
  if (norm?.experienceMatchStatus === 'MISMATCH') {
    reason = `Experience mismatch: Requires ${norm.experienceRequiredText || '2–4 years'}, but candidate is ${norm.experienceProfileText || 'Fresher'}.`
  } else if (norm?.roleMatchStatus === 'MISMATCH') {
    reason = `Role mismatch: Requires ${norm.roleRequiredText || job.title}, which differs from target role.`
  } else if (norm?.educationMatchStatus === 'MISMATCH') {
    reason = `Education mismatch: Requires ${norm.educationRequiredText}, which does not match candidate education.`
  } else if (norm?.skillsMatchStatus === 'MISMATCH') {
    reason = `Skills gap: Missing critical skills (${(norm.missingSkills || []).slice(0, 3).join(', ')}).`
  } else if ((norm?.matchScore ?? 0) >= 85) {
    reason = 'Strong profile alignment across role, experience, education, and skills.'
  } else if ((norm?.matchScore ?? 0) >= 70) {
    reason = 'Good profile match with suitable experience and relevant skills.'
  }

  return {
    overview: {
      title: job.title || '— Not specified',
      company: job.company || '— Not specified',
      location,
      jobType,
      salary,
      experience: currentExp,
      education: currentEdu,
    },
    descriptionSummary,
    responsibilities,
    requirements,
    reason,
  }
}

function buildBodyHTML(job: ExtractedJob, options?: any, isDark: boolean = false): string {
  const norm = options?.normalization
  const matchScore = norm?.matchScore ?? 82
  const recommendationLabel = norm?.recommendationLabel ?? 'GOOD MATCH'
  const recommendationSubtitle = norm?.recommendationSubtitle ?? 'Worth applying'
  const recommendationIcon = norm?.recommendationIcon ?? '🟢'

  const matchedSkills: string[] = norm?.matchedSkills?.length ? norm.matchedSkills : []
  const missingSkills: string[] = norm?.missingSkills?.length ? norm.missingSkills : []

  const readinessScore = norm?.readinessScore ?? 90
  const readinessFactors: string[] = norm?.readinessFactors?.length ? norm.readinessFactors : ['Resume available', 'Profile complete', 'Experience suitable']
  const readinessIssues: string[] = norm?.readinessIssues?.length ? norm.readinessIssues : []

  const sections = extractStructuredSections(job, norm)

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
    <!-- Back to Job Listing (if drilled down from multi-job view) -->
    ${options?.onBackToListing ? `
      <div style="margin-bottom:8px;">
        <button id="talvyn-back-to-jobs-btn" style="
          display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:#4f46e5;
          font-size:11.5px;font-weight:700;cursor:pointer;padding:0;
        ">
          ← Back to Jobs
        </button>
      </div>
    ` : ''}

    <!-- 1. JOB OVERVIEW Section -->
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        JOB OVERVIEW
      </div>
      <div style="font-size:13.5px;font-weight:700;color:${textPrimary};line-height:1.3;margin-bottom:3px;">
        ${escapeHtml(sections.overview.title)}
      </div>
      <div style="font-size:12px;color:${textSecondary};font-weight:600;margin-bottom:4px;">
        ${escapeHtml(sections.overview.company)}
      </div>
      <div style="font-size:11px;color:${textMuted};display:flex;flex-wrap:wrap;gap:8px;">
        <span>📍 ${escapeHtml(sections.overview.location)}</span>
        <span>💼 ${escapeHtml(sections.overview.jobType)}</span>
        <span>💰 ${escapeHtml(sections.overview.salary)}</span>
      </div>
      <div style="font-size:10.5px;color:${textSecondary};margin-top:4px;display:flex;flex-wrap:wrap;gap:8px;">
        <span><strong>Experience:</strong> ${escapeHtml(sections.overview.experience)}</span>
        <span><strong>Education:</strong> ${escapeHtml(sections.overview.education)}</span>
      </div>
    </div>

    <!-- 2. DESCRIPTION Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        DESCRIPTION
      </div>
      <p style="font-size:11px;color:${textSecondary};line-height:1.4;margin:0;">
        ${escapeHtml(sections.descriptionSummary)}
      </p>
    </div>

    <!-- 3. RESPONSIBILITIES Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        RESPONSIBILITIES
      </div>
      <ul style="margin:0;padding-left:14px;font-size:11px;color:${textSecondary};line-height:1.4;">
        ${sections.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>

    <!-- 4. REQUIREMENTS Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        REQUIREMENTS
      </div>
      <ul style="margin:0;padding-left:14px;font-size:11px;color:${textSecondary};line-height:1.4;">
        ${sections.requirements.map((req) => `<li>${escapeHtml(req)}</li>`).join('')}
      </ul>
    </div>

    <!-- 5. SKILLS Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        SKILLS
      </div>
      <div style="font-size:10.5px;color:${textSecondary};margin-top:2px;">
        <span style="font-weight:700;color:${textPrimary};">Matched Skills:</span>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">
          ${matchedSkills.length > 0 ? matchedSkills.map((s) => `
            <span style="
              font-size:10px;padding:1px 6px;border-radius:4px;
              background:${isDark ? '#064e3b' : '#ecfdf5'};color:#059669;border:1px solid ${isDark ? '#047857' : '#a7f3d0'};
            ">✓ ${escapeHtml(s)}</span>
          `).join('') : `<span style="color:${textMuted};">None</span>`}
        </div>
      </div>
      <div style="font-size:10.5px;color:${textSecondary};margin-top:4px;">
        <span style="font-weight:700;color:${textPrimary};">Missing Skills:</span>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">
          ${missingSkills.length > 0 ? missingSkills.map((s) => `
            <span style="
              font-size:10px;padding:1px 6px;border-radius:4px;
              background:${isDark ? '#451a03' : '#fffbeb'};color:#d97706;border:1px solid ${isDark ? '#b45309' : '#fde68a'};
            ">⚠ ${escapeHtml(s)}</span>
          `).join('') : `<span style="color:${textMuted};">— None</span>`}
        </div>
      </div>
    </div>

    <!-- 6. PROFILE MATCH Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
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
          <span>${isRoleMatch ? 'Role match' : isRoleMismatch ? 'Role mismatch' : '— Role: Not specified'}</span>
        </div>

        <!-- Experience match -->
        <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isExpMismatch ? '#dc2626' : isExpMatch ? '#059669' : textMuted};">
          <span style="font-weight:800;">${isExpMismatch ? '⚠' : isExpMatch ? '✓' : '—'}</span>
          <span>${isExpMismatch ? 'Experience mismatch' : isExpMatch ? 'Experience match' : '— Experience: Not specified'}</span>
        </div>

        <!-- Education match -->
        <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isEduMismatch ? '#dc2626' : isEduUnspecified ? textMuted : '#059669'};">
          <span style="font-weight:800;">${isEduMismatch ? '⚠' : isEduUnspecified ? '—' : '✓'}</span>
          <span>${isEduMismatch ? 'Education mismatch' : isEduUnspecified ? '— Education: Not specified' : 'Education match'}</span>
        </div>

        <!-- Skills match -->
        <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isSkillsMatch ? '#059669' : '#dc2626'};">
          <span style="font-weight:800;">${isSkillsMatch ? '✓' : '⚠'}</span>
          <span>${isSkillsMatch ? 'Skills match' : 'Missing required skills'}</span>
        </div>

        <!-- Location match -->
        <div style="font-size:11px;display:flex;align-items:center;gap:5px;color:${isLocMismatch ? '#dc2626' : isLocMatch ? '#059669' : textMuted};">
          <span style="font-weight:800;">${isLocMatch ? '✓' : isLocMismatch ? '⚠' : '—'}</span>
          <span>${isLocMatch ? 'Location match' : isLocMismatch ? 'Location mismatch' : '— Location: Not specified'}</span>
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

      <!-- Education Mismatch Callout -->
      ${isEduMismatch && norm?.educationRequiredText && norm.educationRequiredText !== 'Not specified' ? `
        <div style="
          font-size:10.5px;color:${isDark ? '#fca5a5' : '#b91c1c'};
          background:${isDark ? '#450a0a' : '#fef2f2'};
          border:1px solid ${isDark ? '#7f1d1d' : '#fecaca'};
          border-radius:7px;padding:6px 8px;margin-bottom:6px;line-height:1.4;
        ">
          <div style="font-weight:700;">⚠ Education mismatch</div>
          <div>Required: ${escapeHtml(norm.educationRequiredText)}</div>
          <div>Your profile: ${escapeHtml(norm?.educationProfileText || 'Not specified')}</div>
        </div>
      ` : ''}

      <!-- Role Mismatch Callout -->
      ${isRoleMismatch && norm?.roleProfileText && norm.roleProfileText !== 'Not specified' ? `
        <div style="
          font-size:10.5px;color:${isDark ? '#fca5a5' : '#b91c1c'};
          background:${isDark ? '#450a0a' : '#fef2f2'};
          border:1px solid ${isDark ? '#7f1d1d' : '#fecaca'};
          border-radius:7px;padding:6px 8px;margin-bottom:6px;line-height:1.4;
        ">
          <div style="font-weight:700;">⚠ Role mismatch</div>
          <div>Required: ${escapeHtml(norm?.roleRequiredText || job.title)}</div>
          <div>Target role: ${escapeHtml(norm.roleProfileText)}</div>
        </div>
      ` : ''}
    </div>

    <!-- 7. SHORTLIST & 8. REASON Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        SHORTLIST
      </div>
      <div style="
        background:${bgCard};border:1px solid ${borderCard};border-radius:9px;
        padding:8px 10px;margin-bottom:8px;
      ">
        <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:${textPrimary};">
          <span>${recommendationIcon}</span>
          <span>${escapeHtml(recommendationLabel)}</span>
        </div>
        <div style="font-size:11px;color:${textMuted};margin-left:18px;margin-top:1px;">
          ${escapeHtml(recommendationSubtitle)}
        </div>
      </div>

      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.4px;margin-bottom:4px;text-transform:uppercase;">
        REASON
      </div>
      <div style="font-size:11px;color:${textSecondary};line-height:1.4;margin-bottom:4px;">
        ${escapeHtml(sections.reason)}
      </div>
    </div>

    <!-- 9. APPLICATION READINESS Section -->
    <div style="height:1px;background:${borderCard};margin:8px 0;"></div>
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

    <!-- Persistent Sticky Action Footer -->
    <div id="talvyn-actions-footer" style="
      position:sticky;bottom:-12px;margin:14px -14px -12px -14px;
      padding:10px 14px;background:${isDark ? '#0f172a' : '#ffffff'};
      border-top:1px solid ${borderCard};z-index:10;box-shadow:0 -4px 12px rgba(0,0,0,0.05);
    ">
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
  `
}

// ─── Unsupported Page Notice ────────────────────────────────────────────────

export function injectUnsupportedNotice(
  onDismiss: () => void,
  onReanalyze?: () => void,
  theme: 'light' | 'dark' | 'system' = 'system'
): void {
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
          background:${isDark ? '#1e293b' : '#f8fafc'};
          border:1px solid ${isDark ? '#334155' : '#e2e8f0'};
          border-radius:10px;padding:14px 12px;margin-bottom:10px;text-align:center;
        ">
          <div style="font-size:22px;margin-bottom:6px;">💼</div>
          <div style="font-weight:700;font-size:13px;color:${textPrimary};margin-bottom:4px;">
            No job opportunities detected on this page.
          </div>
          <p style="font-size:11.5px;color:${textSecondary};line-height:1.4;margin:0;">
            Make sure you are on an active job posting, detail page, or career listings portal.
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <button id="talvyn-reanalyze-btn" style="
            width:100%;padding:9px;background:linear-gradient(to right, #4f46e5, #6366f1);
            color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 2px 6px rgba(79,70,229,0.25);
          ">
            Analyze Again
          </button>
          <button id="talvyn-dashboard-btn" style="
            width:100%;padding:8px;background:transparent;color:#6366f1;
            border:1px solid ${borderCard};border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;
          ">
            Open Talvyn Dashboard
          </button>
        </div>
      </div>
    </div>
  `

  applyPanelStyles(panel, isDark)
  const { shadow } = getTalvynHost()
  shadow.appendChild(panel)

  const header = panel.querySelector('#talvyn-panel-header') as HTMLElement | null
  if (header) {
    makeElementDraggable(panel, header, POSITION_STORAGE_KEY)
  }

  panel.querySelector('#talvyn-dismiss-btn')?.addEventListener('click', () => {
    onDismiss()
    removePanel()
  })

  panel.querySelector('#talvyn-reanalyze-btn')?.addEventListener('click', () => {
    if (onReanalyze) {
      onReanalyze()
    }
  })

  panel.querySelector('#talvyn-dashboard-btn')?.addEventListener('click', () => {
    window.open(`${CONFIG.DASHBOARD_URL}/dashboard`, '_blank')
  })
}

// ─── Style Application ──────────────────────────────────────────────────────

function applyPanelStyles(panel: HTMLElement, isDark: boolean = false): void {
  let savedPos: { x: number; y: number } | null = null
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (raw) savedPos = JSON.parse(raw)
  } catch {}

  const width = 380
  const height = 580
  const viewWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200
  const viewHeight = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800

  let left = Math.max(16, viewWidth - width - 24)
  let top = Math.max(16, viewHeight - height - 24)

  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    const maxLeft = Math.max(0, viewWidth - width)
    const maxTop = Math.max(0, viewHeight - 200)
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
    width: `${width}px`,
    maxHeight: `${height}px`,
    height: `${height}px`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '14px',
    boxShadow: isDark
      ? '0 12px 40px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3)'
      : '0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
    border: isDark ? '1px solid #334155' : '1px solid rgba(99,102,241,0.2)',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.2s ease',
  })
}

export function updatePanelState(state: PanelState): void {
  const panel = getTalvynElement(PANEL_ID)
  if (!panel) return

  const statusEl = panel.querySelector('#talvyn-status') as HTMLElement | null
  const actionsEl = panel.querySelector('#talvyn-actions') as HTMLElement | null
  const saveBtn = panel.querySelector('#talvyn-save-btn') as HTMLButtonElement | null
  const applyBtn = panel.querySelector('#talvyn-apply-btn') as HTMLButtonElement | null

  if (!statusEl) return

  switch (state.type) {
    case 'loading':
      if (saveBtn) {
        saveBtn.textContent = 'Saving...'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.7'
      }
      statusEl.style.display = 'none'
      break

    case 'saved':
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.7'
        saveBtn.style.cursor = 'default'
      }
      statusEl.innerHTML = `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="color:#059669;font-weight:700;font-size:12px;display:flex;align-items:center;gap:4px;">
              <span>✓</span> <span>ALREADY SAVED</span>
            </div>
            <span style="font-size:11px;font-weight:600;color:#047857;">Status: ${escapeHtml(state.existingStatus || 'SAVED')}</span>
          </div>
          <div style="margin-top:5px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="color:#4f46e5;font-size:11px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
              View in Tracker →
            </a>
          </div>
        </div>
      `
      statusEl.style.display = 'block'
      break

    case 'duplicate':
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.7'
        saveBtn.style.cursor = 'default'
      }
      statusEl.innerHTML = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="color:#d97706;font-weight:700;font-size:12px;display:flex;align-items:center;gap:4px;">
              <span>✓</span> <span>ALREADY SAVED</span>
            </div>
            <span style="font-size:11px;font-weight:600;color:#b45309;">Status: ${escapeHtml(state.existingStatus || 'SAVED')}</span>
          </div>
          <div style="margin-top:5px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="color:#4f46e5;font-size:11px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
              View in Tracker →
            </a>
          </div>
        </div>
      `
      statusEl.style.display = 'block'
      break

    case 'applied':
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.7'
        saveBtn.style.cursor = 'default'
      }
      statusEl.innerHTML = `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="color:#059669;font-weight:700;font-size:12px;display:flex;align-items:center;gap:4px;">
              <span>✓</span> <span>APPLICATION TRACKED</span>
            </div>
            <span style="font-size:11px;font-weight:600;color:#047857;">Status: ${escapeHtml(state.existingStatus || 'APPLIED')}</span>
          </div>
          ${state.dateApplied ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px;">Submitted ${escapeHtml(state.dateApplied)}</div>` : ''}
          <div style="margin-top:5px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="color:#4f46e5;font-size:11px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
              View in Tracker →
            </a>
          </div>
        </div>
      `
      statusEl.style.display = 'block'
      break

    case 'in_progress':
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved'
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.7'
        saveBtn.style.cursor = 'default'
      }
      statusEl.innerHTML = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="color:#2563eb;font-weight:700;font-size:12px;display:flex;align-items:center;gap:4px;">
              <span>⏳</span> <span>IN PROGRESS</span>
            </div>
            <span style="font-size:11px;font-weight:600;color:#1d4ed8;">Status: ${escapeHtml(state.existingStatus || 'IN_PROGRESS')}</span>
          </div>
          <div style="margin-top:5px;">
            <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="color:#4f46e5;font-size:11px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
              View in Tracker →
            </a>
          </div>
        </div>
      `
      statusEl.style.display = 'block'
      break

    case 'autofilling':
      if (applyBtn) {
        applyBtn.textContent = '⏳ Autofilling...'
        applyBtn.disabled = true
      }
      break

    case 'autofill-complete':
      if (applyBtn) {
        applyBtn.textContent = '⚡ Apply with Talvyn'
        applyBtn.disabled = false
      }
      break

    case 'error':
      if (saveBtn) {
        saveBtn.textContent = '★ Save Job'
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
        saveBtn.style.cursor = 'pointer'
      }
      if (applyBtn) {
        applyBtn.disabled = false
      }
      statusEl.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;margin-bottom:8px;color:#dc2626;font-size:11.5px;line-height:1.4;">
          <div style="font-weight:700;">⚠ Error</div>
          <div>${escapeHtml(state.message || 'Failed to complete action. Please try again.')}</div>
        </div>
      `
      statusEl.style.display = 'block'
      break

    case 'logged-out':
      statusEl.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11.5px;color:#475569;">
          <div>Sign in to Talvyn to track opportunities.</div>
          <button id="talvyn-signin-btn" style="
            margin-top:6px;width:100%;padding:6px;background:#4f46e5;color:white;
            border:none;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;
          ">Sign In to Talvyn</button>
        </div>
      `
      statusEl.style.display = 'block'
      panel.querySelector('#talvyn-signin-btn')?.addEventListener('click', () => {
        window.open(`${CONFIG.DASHBOARD_URL}/login`, '_blank')
      })
      break

    case 'idle':
    default:
      if (saveBtn) {
        saveBtn.textContent = '★ Save Job'
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
        saveBtn.style.cursor = 'pointer'
      }
      if (applyBtn) {
        applyBtn.disabled = false
      }
      statusEl.style.display = 'none'
      break
  }
}

export function removePanel(): void {
  getTalvynElement(PANEL_ID)?.remove()
  getTalvynElement(CAPSULE_ID)?.remove()
  if (typeof document !== 'undefined') {
    document.getElementById(PANEL_ID)?.remove()
    document.getElementById(CAPSULE_ID)?.remove()
  }
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
