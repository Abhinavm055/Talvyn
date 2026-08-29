/**
 * Talvyn Floating Application Assistant Control Panel (Phase 2F)
 *
 * Provides live application guidance, progress tracking, resume recommendations,
 * question assistance, and safe autofill controls directly on application pages.
 */

import {
  ApplicationAssistantSession,
  ApplicationProgress,
  ResumeRecommendation,
} from './types'
import { Resume } from '../../types'

const PANEL_CONTAINER_ID = 'talvyn-application-assistant-root'

export class AssistantPanelManager {
  private container: HTMLElement | null = null
  private isCollapsed = false
  private onAutofillCallback?: () => void
  private onSelectResumeCallback?: (resumeId: string) => void
  private onDismissCallback?: () => void

  /**
   * Mounts or updates the Application Assistant panel on the page.
   */
  render(
    session: ApplicationAssistantSession,
    recommendedResume: ResumeRecommendation | null,
    allResumes: Resume[],
    callbacks: {
      onAutofill: () => void
      onSelectResume: (resumeId: string) => void
      onDismiss: () => void
    }
  ): void {
    this.onAutofillCallback = callbacks.onAutofill
    this.onSelectResumeCallback = callbacks.onSelectResume
    this.onDismissCallback = callbacks.onDismiss

    let root = document.getElementById(PANEL_CONTAINER_ID)
    if (!root) {
      root = document.createElement('div')
      root.id = PANEL_CONTAINER_ID
      root.style.position = 'fixed'
      root.style.bottom = '24px'
      root.style.right = '24px'
      root.style.zIndex = '2147483645'
      root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      document.body.appendChild(root)
    }
    this.container = root

    const { jobTitle, company, progress, highRiskQuestions } = session
    const attentionNeededCount = highRiskQuestions.length

    if (this.isCollapsed) {
      this.container.innerHTML = `
        <div style="
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        " id="talvyn-assistant-expand-btn">
          <div style="width: 24px; height: 24px; border-radius: 6px; background: #6366f1; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 13px;">T</div>
          <span style="font-size: 13px; font-weight: 600; color: #1e293b;">Talvyn Assistant</span>
          <span style="font-size: 12px; font-weight: 600; color: #6366f1; background: #eef2ff; padding: 2px 8px; border-radius: 9999px;">${progress.filledFields}/${progress.totalFields}</span>
        </div>
      `

      document.getElementById('talvyn-assistant-expand-btn')?.addEventListener('click', () => {
        this.isCollapsed = false
        this.render(session, recommendedResume, allResumes, callbacks)
      })
      return
    }

    // Expanded View
    this.container.innerHTML = `
      <div style="
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        width: 330px;
        overflow: hidden;
        animation: talvynSlideUp 0.2s ease-out;
      ">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">T</div>
            <div>
              <div style="font-size: 13px; font-weight: 700; line-height: 1.2;">Application Assistant</div>
              <div style="font-size: 11px; opacity: 0.85; line-height: 1.2;">${company || 'Active Application'}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="talvyn-assistant-collapse-btn" style="background: transparent; border: none; color: #ffffff; opacity: 0.8; cursor: pointer; padding: 4px; font-size: 14px;" title="Minimize">−</button>
            <button id="talvyn-assistant-close-btn" style="background: transparent; border: none; color: #ffffff; opacity: 0.8; cursor: pointer; padding: 4px; font-size: 14px;" title="Close">×</button>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 14px 16px; display: flex; flex-col; gap: 12px; max-height: 380px; overflow-y: auto;">
          <!-- Target Role -->
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px;">Applying For</div>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px;">${jobTitle || 'Current Position'}</div>
          </div>

          <!-- Live Form Progress Bar -->
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">Form Completion</span>
              <span style="font-size: 12px; font-weight: 700; color: #6366f1;">${progress.filledFields} / ${progress.totalFields} fields (${progress.percentage}%)</span>
            </div>
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
              <div style="width: ${progress.percentage}%; height: 100%; background: #6366f1; border-radius: 9999px; transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Recommended Resume Selection -->
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 4px;">Recommended Resume</div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
              <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                <span style="font-size: 14px;">📄</span>
                <span style="font-size: 12px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${recommendedResume ? recommendedResume.resume.name : 'Standard Profile CV'}
                </span>
              </div>
              ${allResumes.length > 1 ? `
                <select id="talvyn-assistant-resume-select" style="font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 4px; background: #ffffff; color: #334155; cursor: pointer;">
                  ${allResumes.map((r) => `<option value="${r.id}" ${r.id === recommendedResume?.resume.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                </select>
              ` : ''}
            </div>
          </div>

          <!-- Attention Needed Warnings -->
          ${attentionNeededCount > 0 ? `
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 8px 10px; display: flex; align-items: start; gap: 8px;">
              <span style="color: #d97706; font-size: 13px;">⚠️</span>
              <div>
                <div style="font-size: 12px; font-weight: 600; color: #92400e;">${attentionNeededCount} Field${attentionNeededCount > 1 ? 's' : ''} Need Attention</div>
                <div style="font-size: 11px; color: #b45309; line-height: 1.3;">Personal / Legal questions require manual verification.</div>
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <button id="talvyn-assistant-autofill-btn" style="
              width: 100%;
              background: #6366f1;
              color: #ffffff;
              border: none;
              border-radius: 8px;
              padding: 9px 12px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
              transition: background 0.15s;
            ">
              ⚡ Autofill Remaining Fields
            </button>
          </div>

          <!-- Safety Notice -->
          <div style="text-align: center; font-size: 10px; color: #94a3b8; margin-top: 2px;">
            🛡️ Talvyn assists you. You always review before final submit.
          </div>
        </div>
      </div>
    `

    // Attach listeners
    document.getElementById('talvyn-assistant-collapse-btn')?.addEventListener('click', () => {
      this.isCollapsed = true
      this.render(session, recommendedResume, allResumes, callbacks)
    })

    document.getElementById('talvyn-assistant-close-btn')?.addEventListener('click', () => {
      this.remove()
      this.onDismissCallback?.()
    })

    document.getElementById('talvyn-assistant-autofill-btn')?.addEventListener('click', () => {
      this.onAutofillCallback?.()
    })

    const resumeSelect = document.getElementById('talvyn-assistant-resume-select') as HTMLSelectElement | null
    resumeSelect?.addEventListener('change', (e) => {
      const selectedId = (e.target as HTMLSelectElement).value
      this.onSelectResumeCallback?.(selectedId)
    })
  }

  /**
   * Removes the Assistant Panel from the DOM.
   */
  remove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
  }
}

export const assistantPanelManager = new AssistantPanelManager()
