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
import { getTalvynElement, updatePanelState } from '../panel'

const PANEL_CONTAINER_ID = 'talvyn-application-assistant-root'

export class AssistantPanelManager {
  private container: HTMLElement | null = null
  private isCollapsed = false
  private onAutofillCallback?: () => void
  private onSelectResumeCallback?: (resumeId: string) => void
  private onDismissCallback?: () => void

  /**
   * Mounts or updates the Application Assistant status within the single main panel.
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

    // Ensure any separate assistant popup is removed for a single-panel experience
    this.remove()

    // Keep autofill and assistant feedback inside the single main floating panel
    const mainPanel = getTalvynElement('talvyn-panel')
    if (mainPanel) {
      updatePanelState({
        type: 'in_progress',
        message: `Application form detected: ${session.progress.filledFields}/${session.progress.totalFields} fields filled.`,
        autofillStats: {
          filledFields: [`${session.progress.filledFields} fields completed`],
          reviewFields: session.highRiskQuestions.map((q) => q.label || 'Question review required'),
        },
      })
    }
  }

  /**
   * Removes the Assistant Panel from the DOM.
   */
  remove(): void {
    const existing = document.getElementById(PANEL_CONTAINER_ID)
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing)
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
  }
}

export const assistantPanelManager = new AssistantPanelManager()
