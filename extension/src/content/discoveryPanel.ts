import { AnalyzedJob, JobListAnalysisSummary } from '../types'
import { CONFIG } from '../utils/config'
import { makeElementDraggable, POSITION_STORAGE_KEY, getTalvynHost, getTalvynElement } from './panel'

export const DISCOVERY_PANEL_ID = 'talvyn-discovery-panel'

export type FilterCategory = 'ALL' | 'STRONG' | 'GOOD' | 'MODERATE' | 'LOW' | 'SAVED'

export interface DiscoveryPanelCallbacks {
  onSaveJob: (job: AnalyzedJob, btnEl: HTMLButtonElement) => Promise<void>
  onDismiss: () => void
  onRefresh?: () => void
}

export class DiscoveryPanelManager {
  private isMinimized = false
  private currentFilter: FilterCategory = 'ALL'
  private summary: JobListAnalysisSummary | null = null
  private callbacks: DiscoveryPanelCallbacks | null = null

  render(summary: JobListAnalysisSummary, callbacks: DiscoveryPanelCallbacks): void {
    this.summary = summary
    this.callbacks = callbacks
    this.remove()

    const panel = document.createElement('div')
    panel.id = DISCOVERY_PANEL_ID
    panel.setAttribute('data-talvyn', 'true')
    panel.style.pointerEvents = 'auto'

    panel.innerHTML = this.isMinimized
      ? this.buildMinimizedHTML(summary)
      : this.buildExpandedHTML(summary)

    this.applyStyles(panel, this.isMinimized)
    const { shadow } = getTalvynHost()
    shadow.appendChild(panel)

    const header = panel.querySelector('#talvyn-discovery-header') as HTMLElement | null
    if (header) {
      makeElementDraggable(panel, header, POSITION_STORAGE_KEY)
    }

    this.attachEventListeners(panel)
  }

  updateSummary(summary: JobListAnalysisSummary): void {
    this.summary = summary
    const panel = getTalvynElement(DISCOVERY_PANEL_ID)
    if (!panel || !this.callbacks) return

    panel.innerHTML = this.isMinimized
      ? this.buildMinimizedHTML(summary)
      : this.buildExpandedHTML(summary)

    this.applyStyles(panel, this.isMinimized)
    const header = panel.querySelector('#talvyn-discovery-header') as HTMLElement | null
    if (header) {
      makeElementDraggable(panel, header, POSITION_STORAGE_KEY)
    }
    this.attachEventListeners(panel)
  }

  remove(): void {
    getTalvynElement(DISCOVERY_PANEL_ID)?.remove()
    if (typeof document !== 'undefined') {
      document.getElementById(DISCOVERY_PANEL_ID)?.remove()
    }
  }

  // ─── HTML Builders ─────────────────────────────────────────────────────────

  private buildMinimizedHTML(summary: JobListAnalysisSummary): string {
    const topMatches = summary.excellentCount + summary.highlyRelevantCount
    return `
      <div id="talvyn-expand-btn" style="
        display:flex;align-items:center;gap:8px;padding:10px 14px;
        background:#6366f1;color:white;border-radius:24px;cursor:pointer;
        box-shadow:0 4px 20px rgba(99,102,241,0.4);font-weight:600;font-size:13px;
        transition:transform 0.15s, background 0.15s;user-select:none;
      ">
        <div style="
          width:20px;height:20px;background:rgba(255,255,255,0.25);border-radius:6px;
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
        ">T</div>
        <span>Talvyn Discovery (${summary.totalDetected} jobs${topMatches > 0 ? ` · ${topMatches} top` : ''})</span>
      </div>
    `
  }

  private buildExpandedHTML(summary: JobListAnalysisSummary): string {
    const filteredJobs = this.filterJobs(summary.analyzedJobs)
    const topCount = summary.excellentCount + summary.highlyRelevantCount

    return `
      <div style="display:flex;flex-direction:column;max-height:560px;">
        <!-- Header (Draggable Handle) -->
        <div id="talvyn-discovery-header" style="
          padding:12px 14px;background:#4f46e5;border-top-left-radius:14px;
          border-top-right-radius:14px;color:white;display:flex;align-items:center;
          justify-content:space-between;flex-shrink:0;cursor:grab;user-select:none;
        " title="Drag to move panel">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="
              width:24px;height:24px;background:rgba(255,255,255,0.2);border-radius:6px;
              display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;
            ">T</div>
            <div>
              <div style="font-weight:800;font-size:13px;letter-spacing:0.3px;">TALVYN JOB INTELLIGENCE</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.85);">${summary.totalDetected} jobs analyzed</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="talvyn-minimize-btn" title="Minimize panel" style="
              background:rgba(255,255,255,0.15);border:none;color:white;width:24px;height:24px;
              border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;
            ">−</button>
            <button id="talvyn-close-btn" title="Close panel" style="
              background:rgba(255,255,255,0.15);border:none;color:white;width:24px;height:24px;
              border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;
            ">×</button>
          </div>
        </div>

        <!-- Metrics Breakdown Bar -->
        <div style="
          padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
          display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:4px;
        ">
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:10px;
              background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;
            ">
              Strong Match: ${summary.excellentCount}
            </span>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:10px;
              background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;
            ">
              Good Match: ${summary.highlyRelevantCount}
            </span>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:10px;
              background:#fffbeb;color:#92400e;border:1px solid #fde68a;
            ">
              Moderate Match: ${summary.relevantCount}
            </span>
            <span style="
              font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:10px;
              background:#fef2f2;color:#991b1b;border:1px solid #fecaca;
            ">
              Low Match: ${summary.lowRelevanceCount}
            </span>
          </div>
        </div>

        <!-- Action & Control Bar: [ Analyze This Page ] and [ Save Top Matches ] -->
        <div style="
          display:flex;padding:8px 12px;gap:6px;background:#ffffff;
          border-bottom:1px solid #f1f5f9;align-items:center;justify-content:space-between;flex-shrink:0;
        ">
          <button id="talvyn-reanalyze-page-btn" style="
            padding:5px 10px;background:#f8fafc;color:#4f46e5;border:1px solid #c7d2fe;
            border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;
            transition:all 0.15s;
          ">
            <span>🔄</span> Analyze This Page
          </button>

          <button id="talvyn-save-all-top-btn" ${topCount === 0 ? 'disabled' : ''} style="
            padding:5px 12px;background:linear-gradient(to right, #4f46e5, #6366f1);color:white;border:none;border-radius:8px;
            font-size:11px;font-weight:700;cursor:${topCount === 0 ? 'not-allowed' : 'pointer'};white-space:nowrap;
            opacity:${topCount === 0 ? '0.6' : '1'};box-shadow:0 1px 4px rgba(79,70,229,0.3);transition:background 0.15s;
          ">
            ★ Save Top Matches (${topCount})
          </button>
        </div>

        <!-- Filter Tabs -->
        <div style="
          display:flex;padding:6px 12px;gap:4px;background:#f8fafc;
          border-bottom:1px solid #e2e8f0;overflow-x:auto;flex-shrink:0;align-items:center;
        ">
          ${this.renderFilterTab('ALL', `All (${summary.totalDetected})`)}
          ${this.renderFilterTab('STRONG', `Strong (${summary.excellentCount})`)}
          ${this.renderFilterTab('GOOD', `Good (${summary.highlyRelevantCount})`)}
          ${this.renderFilterTab('MODERATE', `Moderate (${summary.relevantCount})`)}
          ${this.renderFilterTab('LOW', `Low (${summary.lowRelevanceCount})`)}
          ${this.renderFilterTab('SAVED', 'Saved')}
        </div>

        <!-- Scrollable Job List -->
        <div id="talvyn-cards-container" style="
          padding:10px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;
          background:#f8fafc;
        ">
          ${filteredJobs.length === 0 ? `
            <div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:12px;">
              No jobs in this category.
            </div>
          ` : filteredJobs.map((j) => this.renderJobCard(j)).join('')}
        </div>

        <!-- Footer -->
        <div style="
          padding:8px 12px;background:#ffffff;border-top:1px solid #e2e8f0;
          display:flex;align-items:center;justify-content:space-between;flex-shrink:0;font-size:11px;
        ">
          <span style="color:#94a3b8;">Deterministic relevance score</span>
          <a href="${CONFIG.DASHBOARD_URL}/tracker" target="_blank" style="
            color:#4f46e5;text-decoration:none;font-weight:600;
          ">View in Tracker →</a>
        </div>
      </div>
    `
  }

  private renderFilterTab(category: FilterCategory, label: string): string {
    const isActive = this.currentFilter === category
    return `
      <button class="talvyn-tab-btn" data-filter="${category}" style="
        padding:3px 9px;border-radius:10px;font-size:10.5px;font-weight:600;cursor:pointer;
        border:1px solid ${isActive ? '#6366f1' : '#e2e8f0'};
        background:${isActive ? '#6366f1' : '#ffffff'};
        color:${isActive ? '#ffffff' : '#64748b'};
        white-space:nowrap;transition:all 0.15s;
      ">${label}</button>
    `
  }

  private renderJobCard(analyzed: AnalyzedJob): string {
    const { job, relevanceScore, category, isSaved } = analyzed
    const cardId = `job-card-${this.hashUrl(job.jobUrl)}`

    const expReq = analyzed.experienceMatch?.requiredText || 'Not specified'
    const eduReq = analyzed.educationMatch?.requiredText || 'Not specified'

    const isRoleMatch = analyzed.roleMatch?.score !== undefined ? analyzed.roleMatch.score >= 0.6 : true
    const isExpMatch = analyzed.experienceMatch?.status === 'MATCH'
    const isExpMismatch = analyzed.experienceMatch?.status === 'MISMATCH'
    const isEduMatch = analyzed.educationMatch?.status === 'MATCH'
    const isEduMismatch = analyzed.educationMatch?.status === 'MISMATCH'
    const isSkillsMatch = analyzed.skillsMatch?.status !== 'MISMATCH'
    const isLocMatch = analyzed.locationMatch?.score !== undefined ? analyzed.locationMatch.score >= 0.7 : true

    // Shortlist tier & color theme
    let badgeBg = '#fef2f2'
    let badgeColor = '#991b1b'
    let badgeBorder = '#fecaca'
    let shortlistLabel = '🔴 LOW MATCH'

    if (category === 'EXCELLENT') {
      badgeBg = '#ecfdf5'
      badgeColor = '#065f46'
      badgeBorder = '#6ee7b7'
      shortlistLabel = '🟢 STRONG MATCH'
    } else if (category === 'HIGHLY_RELEVANT') {
      badgeBg = '#eef2ff'
      badgeColor = '#4338ca'
      badgeBorder = '#a5b4fc'
      shortlistLabel = '🟢 GOOD MATCH'
    } else if (category === 'RELEVANT') {
      badgeBg = '#fffbeb'
      badgeColor = '#92400e'
      badgeBorder = '#fde68a'
      shortlistLabel = '🟡 MODERATE MATCH'
    } else {
      shortlistLabel = '🔴 LOW MATCH'
    }

    return `
      <div id="${cardId}" style="
        background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;
        padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);transition:all 0.15s;
      ">
        <!-- Top Title & Match % -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:2px;">
          <div style="font-weight:700;font-size:12.5px;color:#0f172a;line-height:1.3;flex:1;">
            ${this.escapeHtml(job.title)}
          </div>
          <div style="
            display:inline-flex;align-items:center;gap:3px;padding:2px 6px;
            border-radius:8px;font-size:10px;font-weight:800;
            background:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder};
            flex-shrink:0;
          ">
            <span>PROFILE MATCH: ${relevanceScore}%</span>
          </div>
        </div>

        <!-- Company & Location -->
        <div style="font-size:11.5px;color:#475569;font-weight:600;margin-bottom:6px;">
          ${this.escapeHtml(job.company)}${job.location ? ` · <span style="color:#64748b;font-weight:400;">📍 ${this.escapeHtml(job.location)}</span>` : ''}
        </div>

        <!-- 5 Factor Match Breakdown -->
        <div style="
          background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;
          padding:6px 8px;margin-bottom:6px;font-size:10.5px;display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;
        ">
          <div style="color:${isRoleMatch ? '#059669' : '#dc2626'};display:flex;align-items:center;gap:3px;">
            <span>${isRoleMatch ? '✓' : '⚠'}</span> <span>Role</span>
          </div>
          <div style="color:${isExpMismatch ? '#dc2626' : isExpMatch ? '#059669' : '#64748b'};display:flex;align-items:center;gap:3px;">
            <span>${isExpMismatch ? '⚠' : isExpMatch ? '✓' : '—'}</span> <span>Experience</span>
          </div>
          <div style="color:${isEduMismatch ? '#dc2626' : isEduMatch ? '#059669' : '#64748b'};display:flex;align-items:center;gap:3px;">
            <span>${isEduMismatch ? '⚠' : isEduMatch ? '✓' : '—'}</span> <span>Education</span>
          </div>
          <div style="color:${isSkillsMatch ? '#059669' : '#dc2626'};display:flex;align-items:center;gap:3px;">
            <span>${isSkillsMatch ? '✓' : '⚠'}</span> <span>Skills</span>
          </div>
          <div style="color:${isLocMatch ? '#059669' : '#64748b'};display:flex;align-items:center;gap:3px;grid-column:1 / -1;">
            <span>${isLocMatch ? '✓' : '—'}</span> <span>Location</span>
          </div>
        </div>

        <!-- Shortlist Tier Callout -->
        <div style="margin-bottom:6px;font-size:11px;font-weight:700;">
          <span style="color:#64748b;font-size:10px;text-transform:uppercase;">SHORTLIST: </span>
          <span>${shortlistLabel}</span>
        </div>

        <!-- Exact Mismatch Callout -->
        ${isExpMismatch ? `
          <div style="
            color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;
            border-radius:6px;padding:5px 8px;font-size:10.5px;line-height:1.4;margin-bottom:6px;
          ">
            <strong>Reason:</strong> Experience mismatch: Required ${this.escapeHtml(expReq)}, Your profile: ${this.escapeHtml(analyzed.experienceMatch?.profileText || 'Fresher')}
          </div>
        ` : ''}

        ${isEduMismatch && eduReq !== 'Not specified' ? `
          <div style="
            color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;
            border-radius:6px;padding:5px 8px;font-size:10.5px;line-height:1.4;margin-bottom:6px;
          ">
            <strong>Reason:</strong> Education mismatch: Required ${this.escapeHtml(eduReq)}
          </div>
        ` : ''}

        <!-- Actions -->
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px;">
          <button class="talvyn-save-card-btn" data-url="${this.escapeHtml(job.jobUrl)}" style="
            flex:1;padding:5px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;
            border:none;background:${isSaved ? '#10b981' : '#4f46e5'};color:#ffffff;
            transition:background 0.15s;
          ">${isSaved ? '✓ Saved' : 'Save'}</button>
          
          <a href="${job.jobUrl}" target="_blank" style="
            padding:5px 10px;border-radius:6px;font-size:11px;font-weight:500;text-decoration:none;
            border:1px solid #cbd5e1;background:#ffffff;color:#475569;text-align:center;
          ">Open ↗</a>
        </div>
      </div>
    `
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────

  private attachEventListeners(panel: HTMLElement): void {
    // Minimize button
    panel.querySelector('#talvyn-minimize-btn')?.addEventListener('click', () => {
      this.isMinimized = true
      if (this.summary && this.callbacks) this.render(this.summary, this.callbacks)
    })

    // Expand button (from minimized state)
    panel.querySelector('#talvyn-expand-btn')?.addEventListener('click', () => {
      this.isMinimized = false
      if (this.summary && this.callbacks) this.render(this.summary, this.callbacks)
    })

    // Close button
    panel.querySelector('#talvyn-close-btn')?.addEventListener('click', () => {
      this.remove()
      this.callbacks?.onDismiss()
    })

    // Analyze this page button
    panel.querySelector('#talvyn-reanalyze-page-btn')?.addEventListener('click', () => {
      if (this.callbacks?.onRefresh) {
        this.callbacks.onRefresh()
      }
    })

    // Filter tab clicks
    const tabBtns = panel.querySelectorAll('.talvyn-tab-btn')
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement
        const filter = target.getAttribute('data-filter') as FilterCategory
        if (filter) {
          this.currentFilter = filter
          if (this.summary && this.callbacks) this.render(this.summary, this.callbacks)
        }
      })
    })

    // Save all top matches button
    panel.querySelector('#talvyn-save-all-top-btn')?.addEventListener('click', async (e) => {
      const topBtn = e.currentTarget as HTMLButtonElement
      if (!this.summary || !this.callbacks) return

      const topJobs = this.summary.analyzedJobs.filter(
        (j) => (j.category === 'EXCELLENT' || j.category === 'HIGHLY_RELEVANT') && !j.isSaved
      )
      if (topJobs.length === 0) return

      topBtn.disabled = true
      topBtn.textContent = 'Saving Top Matches...'

      for (const analyzed of topJobs) {
        const cardBtn = panel.querySelector(`.talvyn-save-card-btn[data-url="${this.escapeHtml(analyzed.job.jobUrl)}"]`) as HTMLButtonElement | null
        if (cardBtn) {
          cardBtn.disabled = true
          cardBtn.textContent = 'Saving…'
        }
        try {
          await this.callbacks.onSaveJob(analyzed, cardBtn || document.createElement('button'))
          analyzed.isSaved = true
          if (cardBtn) {
            cardBtn.textContent = 'Saved ✓'
            cardBtn.style.background = '#10b981'
          }
        } catch {
          if (cardBtn) {
            cardBtn.disabled = false
            cardBtn.textContent = 'Save Job'
          }
        }
      }

      topBtn.textContent = '✓ Top Matches Saved'
      topBtn.style.background = '#059669'
    })

    // Individual Save job buttons
    const saveBtns = panel.querySelectorAll('.talvyn-save-card-btn')
    saveBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget as HTMLButtonElement
        const jobUrl = button.getAttribute('data-url')
        const analyzed = this.summary?.analyzedJobs.find((j) => j.job.jobUrl === jobUrl)

        if (analyzed && this.callbacks) {
          button.disabled = true
          button.textContent = 'Saving…'
          try {
            await this.callbacks.onSaveJob(analyzed, button)
            analyzed.isSaved = true
            button.textContent = 'Saved ✓'
            button.style.background = '#10b981'
          } catch {
            button.disabled = false
            button.textContent = 'Save'
          }
        }
      })
    })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private filterJobs(jobs: AnalyzedJob[]): AnalyzedJob[] {
    switch (this.currentFilter) {
      case 'STRONG':
        return jobs.filter((j) => j.category === 'EXCELLENT')
      case 'GOOD':
        return jobs.filter((j) => j.category === 'HIGHLY_RELEVANT')
      case 'MODERATE':
        return jobs.filter((j) => j.category === 'RELEVANT')
      case 'LOW':
        return jobs.filter((j) => j.category === 'LOW_RELEVANCE')
      case 'SAVED':
        return jobs.filter((j) => j.isSaved)
      default:
        return jobs
    }
  }

  private applyStyles(panel: HTMLElement, isMinimized: boolean): void {
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

    if (isMinimized) {
      Object.assign(panel.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        bottom: 'auto',
        right: 'auto',
        zIndex: '2147483647',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      })
    } else {
      Object.assign(panel.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        bottom: 'auto',
        right: 'auto',
        width: `${width}px`,
        maxHeight: `${height}px`,
        zIndex: '2147483647',
        background: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '13px',
        lineHeight: '1.4',
        border: '1px solid rgba(99,102,241,0.2)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      })
    }
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(36)
  }
}

export const discoveryPanelManager = new DiscoveryPanelManager()
