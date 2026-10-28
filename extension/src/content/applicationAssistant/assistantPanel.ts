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
import { getTalvynElement } from '../panel'
import type { ReviewedAutofillResult } from '../autofill/reviewedAutofill'

const PANEL_CONTAINER_ID = 'talvyn-application-assistant-root'

export class AssistantPanelManager {
  private container: HTMLElement | null = null
  private isCollapsed = false
  private currentSessionId: string | null = null
  private fillingSessionId: string | null = null
  private lastResult: ReviewedAutofillResult | null = null

  /**
   * Mounts or updates the Application Assistant status within the single main panel.
   */
  render(
    session: ApplicationAssistantSession,
    recommendedResume: ResumeRecommendation | null,
    allResumes: Resume[],
    callbacks: {
      onAutofill: () => Promise<ReviewedAutofillResult>
      onRescan: () => Promise<void>
      onSelectResume: (resumeId: string) => void
      onDismiss: () => void
    }
  ): void {
    if (this.currentSessionId !== session.id) {
      this.lastResult = null
      this.fillingSessionId = null
      this.currentSessionId = session.id
    }
    const previewOpen = this.container?.querySelector('details')?.open || false

    // Ensure any separate assistant popup is removed for a single-panel experience
    this.remove(true)

    const mainPanel = getTalvynElement('talvyn-panel')
    const body = mainPanel?.querySelector('#talvyn-panel-body')
    if (!body) return
    const escape = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
    const section = document.createElement('section')
    section.id = PANEL_CONTAINER_ID
    section.setAttribute('data-talvyn', 'true')
    section.style.cssText = 'margin-bottom:12px;padding:10px;border:1px solid #c7d2fe;border-radius:9px;font-size:11px;line-height:1.45;'
    const eligible = session.fields.filter((field) => field.suggestedValue && field.riskLevel === 'SAFE_AUTOFILL' && !field.isFilled)
    section.setAttribute('data-ready-count', String(eligible.length))
    section.innerHTML = `
      <div style="font-weight:800;color:#6366f1;">APPLICATION ASSISTANT</div>
      <div>${session.progress.filledFields}/${session.progress.totalFields} fields filled · ${session.missingRequiredCount} required fields remain.</div>
      <div style="margin-top:4px;">Review saved profile values before filling. Existing answers are preserved. Sensitive eligibility and personal questions need your own answer.</div>
      <details ${previewOpen ? 'open' : ''} style="margin-top:6px;"><summary style="cursor:pointer;">Review field mappings (${eligible.length} ready)</summary>
        <ul style="margin:5px 0;padding-left:15px;max-height:220px;overflow:auto;">${session.fields.map((field) => `<li><strong>${escape(field.label)}</strong>: ${field.isFilled ? 'Already filled' : field.riskLevel === 'USER_ACTION_REQUIRED' ? 'Manual review required' : field.riskLevel !== 'SAFE_AUTOFILL' ? 'Write your own answer on the form' : field.suggestedValue ? `${escape(field.suggestedValue)} · saved profile · ${field.confidence}% mapping confidence` : 'No saved value; answer on the form'}${field.isRequired ? ' · Required' : ''}</li>`).join('')}</ul>
      </details>
      ${allResumes.length ? `<label style="display:block;margin-top:6px;">Resume to review <select id="talvyn-assistant-resume" style="width:100%;padding:4px;margin-top:3px;">${allResumes.map((resume) => `<option value="${escape(resume.id)}" ${session.selectedResumeId === resume.id ? 'selected' : ''}>${escape(resume.name)}</option>`).join('')}</select></label><div style="margin-top:3px;">Upload the selected resume yourself when the form requests a file.</div>` : '<div style="margin-top:6px;">No resume is available. Add one on your Talvyn profile and upload it on the application form.</div>'}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;">
        <button type="button" id="talvyn-assistant-autofill" ${eligible.length && this.fillingSessionId !== session.id ? '' : 'disabled'} style="padding:6px 9px;border:1px solid #c7d2fe;border-radius:6px;background:#4f46e5;color:white;cursor:pointer;">${this.fillingSessionId === session.id ? 'Checking reviewed fields…' : 'Fill reviewed profile fields'}</button>
        <button type="button" id="talvyn-assistant-rescan" ${this.fillingSessionId === session.id ? 'disabled' : ''} style="padding:6px 9px;border:1px solid #c7d2fe;border-radius:6px;background:transparent;color:inherit;cursor:pointer;">Review form again</button>
      </div>
      <div id="talvyn-assistant-fill-result" role="status" aria-live="polite" style="margin-top:5px;"></div>
      <div style="margin-top:4px;">Talvyn never submits this form. Review all populated fields and submit through the site's own controls.</div>
    `
    body.insertBefore(section, body.firstChild)
    this.container = section
    this.renderResult()
    section.querySelector('#talvyn-assistant-autofill')?.addEventListener('click', async () => {
      if (this.fillingSessionId) return
      this.fillingSessionId = session.id
      this.setButtonsBusy(true)
      try {
        const result = await callbacks.onAutofill()
        if (this.currentSessionId !== session.id) return
        this.lastResult = result
        this.renderResult()
      } catch {
        if (this.currentSessionId === session.id) {
          const status = this.container?.querySelector('#talvyn-assistant-fill-result')
          if (status) status.textContent = 'The reviewed fill could not be completed. Review the form and try again.'
        }
      } finally {
        if (this.fillingSessionId === session.id) this.fillingSessionId = null
        if (this.currentSessionId === session.id) this.setButtonsBusy(false)
      }
    })
    section.querySelector('#talvyn-assistant-rescan')?.addEventListener('click', async () => {
      if (this.fillingSessionId) return
      this.fillingSessionId = session.id
      this.setButtonsBusy(true)
      this.lastResult = null
      try {
        await callbacks.onRescan()
        if (this.currentSessionId !== session.id) return
        const preview = this.container?.querySelector('details')
        if (preview) preview.open = true
      } catch {
        if (this.currentSessionId === session.id) {
          const status = this.container?.querySelector('#talvyn-assistant-fill-result')
          if (status) status.textContent = 'The form could not be reviewed. Check the extension connection and analyze the form again.'
        }
      } finally {
        if (this.fillingSessionId === session.id) this.fillingSessionId = null
        if (this.currentSessionId === session.id) this.setButtonsBusy(false)
      }
    })
    section.querySelector('#talvyn-assistant-resume')?.addEventListener('change', (event) => callbacks.onSelectResume((event.target as HTMLSelectElement).value))
  }

  private setButtonsBusy(busy: boolean): void {
    const button = this.container?.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')
    if (button) {
      button.disabled = busy || button.closest('section')?.getAttribute('data-ready-count') === '0'
      button.textContent = busy ? 'Checking reviewed fields…' : 'Fill reviewed profile fields'
    }
    const rescan = this.container?.querySelector<HTMLButtonElement>('#talvyn-assistant-rescan')
    if (rescan) rescan.disabled = busy
  }

  private renderResult(): void {
    const status = this.container?.querySelector('#talvyn-assistant-fill-result')
    if (!status || !this.lastResult) return
    const result = this.lastResult
    status.textContent = `${result.filledCount} filled · ${result.skippedCount} skipped · ${result.failedCount} failed.` +
      (result.staleCount ? ` ${result.staleCount} changed since review.` : '') +
      (result.unreviewedCount ? ` ${result.unreviewedCount} new fields were not filled.` : '') +
      (result.blockedReason ? ` ${result.blockedReason}` : '') +
      (result.staleCount || result.unreviewedCount ? ' Choose Review form again before another fill.' : ' Check every answer on the form before submitting.')
  }

  /**
   * Removes the Assistant Panel from the DOM.
   */
  remove(preserveReviewState = false): void {
    const existing = getTalvynElement(PANEL_CONTAINER_ID)
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing)
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
    if (!preserveReviewState) {
      this.currentSessionId = null
      this.fillingSessionId = null
      this.lastResult = null
    }
  }
}

export const assistantPanelManager = new AssistantPanelManager()
