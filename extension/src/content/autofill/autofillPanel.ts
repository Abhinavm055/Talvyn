import { FormAnalysisSummary, MatchedFormField, Resume } from '../../types'
import { CONFIG } from '../../utils/config'

const AUTOFILL_PANEL_ID = 'talvyn-autofill-panel'

export interface AutofillPanelCallbacks {
  onAutofillHighConfidence: () => Promise<void>
  onAutofillAllEligible: () => Promise<void>
  onAutofillSingleField: (field: MatchedFormField) => Promise<void>
  onRescan: () => Promise<void>
  onDismiss: () => void
  onSelectResume?: (resume: Resume) => void
}

export class AutofillPanelManager {
  private isMinimized = false
  private summary: FormAnalysisSummary | null = null
  private callbacks: AutofillPanelCallbacks | null = null
  private selectedResumeId: string | null = null

  render(summary: FormAnalysisSummary, callbacks: AutofillPanelCallbacks): void {
    this.summary = summary
    this.callbacks = callbacks
    if (!this.selectedResumeId && summary.defaultResume) {
      this.selectedResumeId = summary.defaultResume.id
    }
    this.remove()

    const panel = document.createElement('div')
    panel.id = AUTOFILL_PANEL_ID
    panel.setAttribute('data-talvyn', 'true')

    panel.innerHTML = this.isMinimized
      ? this.buildMinimizedHTML(summary)
      : this.buildExpandedHTML(summary)

    this.applyStyles(panel, this.isMinimized)
    document.body.appendChild(panel)

    this.attachEventListeners(panel)
  }

  updateSummary(summary: FormAnalysisSummary): void {
    this.summary = summary
    const panel = document.getElementById(AUTOFILL_PANEL_ID)
    if (!panel || !this.callbacks) return

    panel.innerHTML = this.isMinimized
      ? this.buildMinimizedHTML(summary)
      : this.buildExpandedHTML(summary)

    this.applyStyles(panel, this.isMinimized)
    this.attachEventListeners(panel)
  }

  remove(): void {
    document.getElementById(AUTOFILL_PANEL_ID)?.remove()
  }

  // ─── HTML Builders ─────────────────────────────────────────────────────────

  private buildMinimizedHTML(summary: FormAnalysisSummary): string {
    const readyCount = summary.highConfidenceCount + summary.mediumConfidenceCount
    return `
      <div id="talvyn-autofill-expand-btn" style="
        display:flex;align-items:center;gap:8px;padding:10px 15px;
        background:#4f46e5;color:white;border-radius:24px;cursor:pointer;
        box-shadow:0 6px 24px rgba(79,70,229,0.45);font-weight:600;font-size:13px;
        transition:transform 0.15s, background 0.15s;user-select:none;
      ">
        <span style="font-size:15px;">⚡</span>
        <span>Talvyn Autofill (${readyCount} fields ready)</span>
      </div>
    `
  }

  private buildExpandedHTML(summary: FormAnalysisSummary): string {
    const readyCount = summary.highConfidenceCount
    const allEligibleCount = summary.highConfidenceCount + summary.mediumConfidenceCount

    return `
      <div style="display:flex;flex-direction:column;max-height:580px;">
        <!-- Header -->
        <div style="
          padding:14px 16px;background:#4f46e5;border-top-left-radius:14px;
          border-top-right-radius:14px;color:white;display:flex;align-items:center;
          justify-content:space-between;flex-shrink:0;
        ">
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="
              width:26px;height:26px;background:rgba(255,255,255,0.2);border-radius:8px;
              display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;
            ">⚡</div>
            <div>
              <div style="font-weight:700;font-size:14px;letter-spacing:-0.2px;">Talvyn Autofill</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.85);">${summary.totalFields} form fields detected</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="talvyn-autofill-minimize-btn" title="Minimize panel" style="
              background:rgba(255,255,255,0.15);border:none;color:white;width:24px;height:24px;
              border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;
            ">−</button>
            <button id="talvyn-autofill-close-btn" title="Close panel" style="
              background:rgba(255,255,255,0.15);border:none;color:white;width:24px;height:24px;
              border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;
            ">×</button>
          </div>
        </div>

        <!-- Metrics Bar -->
        <div style="
          padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
          display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:4px;
        ">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <span style="
              font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;
              background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;
            ">
              ✓ ${summary.highConfidenceCount} High Confidence
            </span>
            <span style="
              font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;
              background:#fffbeb;color:#92400e;border:1px solid #fde68a;
            ">
              🔍 ${summary.mediumConfidenceCount} Review
            </span>
            ${summary.customQuestionsCount > 0 ? `
              <span style="
                font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;
                background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;
              ">
                ✍ ${summary.customQuestionsCount} Custom
              </span>
            ` : ''}
          </div>
          <button id="talvyn-rescan-btn" title="Re-scan DOM fields" style="
            background:transparent;border:none;color:#6366f1;font-size:11px;font-weight:600;
            cursor:pointer;padding:2px 4px;
          ">Re-scan ↺</button>
        </div>

        <!-- Resume Selection Banner (if file upload detected) -->
        ${summary.resumeUploadDetected ? this.renderResumeBanner(summary) : ''}

        <!-- Scrollable Matched Fields List -->
        <div id="talvyn-autofill-fields-container" style="
          padding:12px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;
          background:#f8fafc;
        ">
          ${summary.matchedFields.length === 0 ? `
            <div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:12px;">
              No form fields detected. Click Re-scan or open an application modal.
            </div>
          ` : summary.matchedFields.map((f) => this.renderFieldCard(f)).join('')}
        </div>

        <!-- Primary Action Buttons -->
        <div style="
          padding:12px 14px;background:#ffffff;border-top:1px solid #e2e8f0;
          display:flex;flex-direction:column;gap:8px;flex-shrink:0;
        ">
          <div style="display:flex;gap:8px;">
            <button id="talvyn-autofill-high-btn" style="
              flex:1;padding:9px 12px;background:#4f46e5;color:white;border:none;
              border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
              transition:background 0.15s;
            ">
              ⚡ Autofill High Confidence (${readyCount})
            </button>
            ${summary.mediumConfidenceCount > 0 ? `
              <button id="talvyn-autofill-all-btn" style="
                padding:9px 12px;background:#f0f4ff;color:#4338ca;border:1px solid #c7d2fe;
                border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
              ">
                Fill All (${allEligibleCount})
              </button>
            ` : ''}
          </div>

          <!-- Safety Notice -->
          <div style="font-size:10px;color:#64748b;line-height:1.3;text-align:center;">
            🔒 Talvyn never auto-submits. Review all entries before clicking Submit manually.
          </div>
        </div>
      </div>
    `
  }

  private renderResumeBanner(summary: FormAnalysisSummary): string {
    const resumes = summary.availableResumes || []
    const defaultResume = summary.defaultResume

    return `
      <div style="
        padding:10px 14px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;
        display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:8px;
      ">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;">
          <span style="font-size:14px;">📄</span>
          <div style="min-width:0;">
            <div style="font-size:11px;font-weight:700;color:#166534;">Resume Upload Detected</div>
            <div style="font-size:11px;color:#15803d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${defaultResume ? `Default: <strong>${this.escapeHtml(defaultResume.name)}</strong>` : 'No default resume set in Talvyn'}
            </div>
          </div>
        </div>
        ${resumes.length > 1 ? `
          <select id="talvyn-resume-select" style="
            font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid #86efac;
            background:white;color:#166534;font-weight:500;
          ">
            ${resumes.map((r) => `
              <option value="${r.id}" ${r.id === this.selectedResumeId ? 'selected' : ''}>
                ${this.escapeHtml(r.name)}${r.isDefault ? ' (Default)' : ''}
              </option>
            `).join('')}
          </select>
        ` : `
          <a href="${CONFIG.DASHBOARD_URL}/resumes" target="_blank" style="
            font-size:11px;color:#16a34a;font-weight:600;text-decoration:none;
          ">Resumes →</a>
        `}
      </div>
    `
  }

  private renderFieldCard(matched: MatchedFormField): string {
    const { field, detectedType, confidence, confidenceLevel, valueToFill, reason, canAutofill, isCustomQuestion, isResumeUpload, isFilled } = matched

    const labelText = field.label || field.placeholder || field.name || field.domId || 'Untitled Field'
    const cleanValue = valueToFill !== null && valueToFill !== undefined ? String(valueToFill) : null

    // Badge styling
    let badgeBg = '#f1f5f9'
    let badgeColor = '#475569'
    let badgeText = `${confidence}% · Unknown`

    if (isResumeUpload) {
      badgeBg = '#dcfce7'
      badgeColor = '#15803d'
      badgeText = 'Resume File'
    } else if (isCustomQuestion) {
      badgeBg = '#eff6ff'
      badgeColor = '#1d4ed8'
      badgeText = 'Custom Question'
    } else if (confidenceLevel === 'HIGH') {
      badgeBg = '#ecfdf5'
      badgeColor = '#047857'
      badgeText = `${confidence}% · High`
    } else if (confidenceLevel === 'MEDIUM') {
      badgeBg = '#fffbeb'
      badgeColor = '#b45309'
      badgeText = `${confidence}% · Review`
    }

    return `
      <div style="
        background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;
        padding:10px 12px;box-shadow:0 1px 2px rgba(0,0,0,0.03);
      ">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">
          <div style="font-weight:600;font-size:12px;color:#1e293b;line-height:1.3;flex:1;">
            ${this.escapeHtml(labelText)}
            ${field.isRequired ? '<span style="color:#ef4444;font-weight:700;"> *</span>' : ''}
          </div>
          <span style="
            font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;
            background:${badgeBg};color:${badgeColor};flex-shrink:0;white-space:nowrap;
          ">${badgeText}</span>
        </div>

        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
          Mapped: <span style="font-weight:600;color:#4f46e5;">${detectedType}</span>
        </div>

        <!-- Value Preview -->
        ${cleanValue !== null ? `
          <div style="
            font-size:11px;background:#f8fafc;padding:5px 8px;border-radius:6px;
            border:1px solid #f1f5f9;color:#0f172a;font-family:monospace;margin-bottom:6px;
            word-break:break-all;
          ">
            Value: <strong>${this.escapeHtml(cleanValue)}</strong>
          </div>
        ` : isCustomQuestion ? `
          <div style="font-size:11px;color:#3b82f6;background:#eff6ff;padding:5px 8px;border-radius:6px;margin-bottom:6px;">
            ✍ Custom question — manual response recommended.
          </div>
        ` : isResumeUpload ? `
          <div style="font-size:11px;color:#059669;background:#ecfdf5;padding:5px 8px;border-radius:6px;margin-bottom:6px;">
            📄 Upload using your selected Talvyn resume above.
          </div>
        ` : `
          <div style="font-size:11px;color:#d97706;background:#fffbeb;padding:5px 8px;border-radius:6px;margin-bottom:6px;">
            ⚠️ Manual input required (empty in profile).
          </div>
        `}

        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:10px;color:#94a3b8;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">
            ${this.escapeHtml(reason)}
          </span>
          ${canAutofill ? `
            <button class="talvyn-fill-single-btn" data-field-id="${this.escapeHtml(field.id)}" style="
              padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;
              border:1px solid #c7d2fe;background:${isFilled ? '#10b981' : '#f0f4ff'};
              color:${isFilled ? '#ffffff' : '#4338ca'};
            ">${isFilled ? 'Filled ✓' : 'Fill'}</button>
          ` : ''}
        </div>
      </div>
    `
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────

  private attachEventListeners(panel: HTMLElement): void {
    // Minimize / Expand
    panel.querySelector('#talvyn-autofill-minimize-btn')?.addEventListener('click', () => {
      this.isMinimized = true
      if (this.summary && this.callbacks) this.render(this.summary, this.callbacks)
    })

    panel.querySelector('#talvyn-autofill-expand-btn')?.addEventListener('click', () => {
      this.isMinimized = false
      if (this.summary && this.callbacks) this.render(this.summary, this.callbacks)
    })

    // Close
    panel.querySelector('#talvyn-autofill-close-btn')?.addEventListener('click', () => {
      this.remove()
      this.callbacks?.onDismiss()
    })

    // Re-scan
    panel.querySelector('#talvyn-rescan-btn')?.addEventListener('click', () => {
      this.callbacks?.onRescan()
    })

    // Autofill High Confidence
    panel.querySelector('#talvyn-autofill-high-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Autofilling…'
      try {
        await this.callbacks?.onAutofillHighConfidence()
        btn.textContent = 'Autofilled ✓'
        btn.style.background = '#10b981'
      } catch {
        btn.disabled = false
        btn.textContent = 'Autofill High Confidence'
      }
    })

    // Autofill All Eligible
    panel.querySelector('#talvyn-autofill-all-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Autofilling…'
      try {
        await this.callbacks?.onAutofillAllEligible()
        btn.textContent = 'All Filled ✓'
        btn.style.background = '#10b981'
      } catch {
        btn.disabled = false
        btn.textContent = 'Fill All'
      }
    })

    // Single Field Fill Buttons
    const singleBtns = panel.querySelectorAll('.talvyn-fill-single-btn')
    singleBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget as HTMLButtonElement
        const fieldId = button.getAttribute('data-field-id')
        const matched = this.summary?.matchedFields.find((f) => f.field.id === fieldId)

        if (matched && this.callbacks) {
          button.disabled = true
          button.textContent = 'Filling…'
          try {
            await this.callbacks.onAutofillSingleField(matched)
            button.textContent = 'Filled ✓'
            button.style.background = '#10b981'
            button.style.color = '#ffffff'
          } catch {
            button.disabled = false
            button.textContent = 'Fill'
          }
        }
      })
    })

    // Resume selection dropdown
    const resumeSelect = panel.querySelector('#talvyn-resume-select') as HTMLSelectElement | null
    resumeSelect?.addEventListener('change', (e) => {
      const selectedId = (e.target as HTMLSelectElement).value
      this.selectedResumeId = selectedId
      const resume = this.summary?.availableResumes?.find((r) => r.id === selectedId)
      if (resume && this.callbacks?.onSelectResume) {
        this.callbacks.onSelectResume(resume)
      }
    })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private applyStyles(panel: HTMLElement, isMinimized: boolean): void {
    if (isMinimized) {
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      })
    } else {
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '390px',
        maxHeight: '600px',
        zIndex: '2147483647',
        background: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '13px',
        lineHeight: '1.4',
        border: '1px solid rgba(79,70,229,0.25)',
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
}

export const autofillPanelManager = new AutofillPanelManager()
