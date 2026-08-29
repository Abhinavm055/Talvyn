/**
 * Talvyn Application Assistant Coordinator (Phase 2F)
 *
 * Coordinates live application detection, field analysis, resume recommendations,
 * form progress tracking, and floating assistant panel display.
 */

import {
  ApplicationAssistantSession,
  ApplicationProgress,
  ResumeRecommendation,
} from './types'
import { formAnalyzer } from './formAnalyzer'
import { resumeRecommender } from './resumeRecommender'
import { assistantPanelManager } from './assistantPanel'
import { autofillCoordinator } from '../autofill/autofillCoordinator'
import { autofillAdapterRegistry } from '../autofill/adapters/registry'
import { fieldDetector } from '../autofill/fieldDetector'
import { fieldMatcher } from '../autofill/fieldMatcher'
import { autofillEngine } from '../autofill/autofillEngine'
import { applicationSessionManager } from '../applicationDetection/applicationSession'
import { resumesService } from '../../services/resumesService'
import { jobsService } from '../../services/jobsService'
import { UserProfile, Resume, DetectedFormField, ExtractedJob } from '../../types'

export class AssistantCoordinator {
  private activeSession: ApplicationAssistantSession | null = null
  private observer: MutationObserver | null = null
  private inputListenerAttached = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private currentResumes: Resume[] = []
  private selectedResume: Resume | null = null

  /**
   * Checks whether the current page is an active application form.
   */
  isApplicationForm(url: string, doc: Document): boolean {
    const adapter = autofillAdapterRegistry.getAdapter(url, doc)
    return adapter.isApplicationForm(url, doc)
  }

  /**
   * Activates the Application Assistant on the detected page.
   */
  async activate(
    url: string,
    doc: Document,
    profile: UserProfile,
    job?: ExtractedJob | null
  ): Promise<boolean> {
    try {
      // 1. Fetch user resumes
      try {
        this.currentResumes = await resumesService.list()
      } catch {
        this.currentResumes = []
      }

      // 2. Find form roots & detect fields
      const adapter = autofillAdapterRegistry.getAdapter(url, doc)
      const formRoots = adapter.findFormRoots(doc)
      const rawFields = formRoots.flatMap((root) => fieldDetector.detectFields(root))
      const uniqueFields = Array.from(new Map(rawFields.map((f) => [f.element, f])).values())

      if (uniqueFields.length === 0) {
        return false
      }

      // 3. Form field classification & risk analysis
      const analyzedFields = formAnalyzer.analyzeFields(uniqueFields, profile)
      const progress = formAnalyzer.calculateProgress(analyzedFields)

      // 4. Recommend resume
      const jobTitle = job?.title || this.inferJobTitle(doc)
      const company = job?.company || this.inferCompany(doc)
      const bestResumeRec = resumeRecommender.getBestResume(
        this.currentResumes,
        jobTitle,
        job?.description || undefined,
        profile.skills
      )
      this.selectedResume = bestResumeRec?.resume || null

      const highRisk = analyzedFields.filter((f) => f.riskLevel === 'USER_ACTION_REQUIRED')

      // 5. Initialize or update session
      const sessionId = `asst-session-${Date.now()}`
      this.activeSession = {
        id: sessionId,
        jobTitle: jobTitle || 'Application',
        company: company || 'Company',
        jobUrl: url,
        state: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        progress,
        selectedResumeId: this.selectedResume?.id || null,
        fields: analyzedFields,
        highRiskQuestions: highRisk,
        missingRequiredCount: progress.requiredFields - progress.requiredFilledFields,
      }

      // 6. Record session in storage & trigger backend status update
      await applicationSessionManager.createOrUpdateSession({
        pageUrl: url,
        jobTitle,
        company,
      })

      // 7. Render Floating Control Panel
      this.renderPanel(doc, profile)

      // 8. Attach live progress change listeners
      this.attachListeners(doc, profile)

      return true
    } catch (err) {
      console.warn('[Talvyn Assistant] Activation error:', err)
      return false
    }
  }

  /**
   * Renders the assistant control panel.
   */
  private renderPanel(doc: Document, profile: UserProfile): void {
    if (!this.activeSession) return

    const bestResumeRec = this.selectedResume
      ? {
          resume: this.selectedResume,
          score: 90,
          matchReasons: ['Selected active resume'],
          isDefault: !!this.selectedResume.isDefault,
        }
      : null

    assistantPanelManager.render(
      this.activeSession,
      bestResumeRec,
      this.currentResumes,
      {
        onAutofill: () => this.handleAutofill(doc, profile),
        onSelectResume: (resumeId) => {
          this.selectedResume = this.currentResumes.find((r) => r.id === resumeId) || null
        },
        onDismiss: () => {
          this.dismiss()
        },
      }
    )
  }

  /**
   * Handles user trigger to autofill remaining fields.
   */
  private async handleAutofill(doc: Document, profile: UserProfile): Promise<void> {
    const adapter = autofillAdapterRegistry.getAdapter(window.location.href, doc)
    const formRoots = adapter.findFormRoots(doc)
    const rawFields = formRoots.flatMap((root) => fieldDetector.detectFields(root))
    const uniqueFields = Array.from(new Map(rawFields.map((f) => [f.element, f])).values())

    const matched = uniqueFields.map((f) => fieldMatcher.matchField(f, profile))
    await autofillEngine.autofillForm(matched, { preserveUserValues: true })

    // Refresh progress after filling
    this.refreshProgress(doc, profile)
  }

  /**
   * Re-evaluates form field progress without remounting the entire DOM widget.
   */
  private refreshProgress(doc: Document, profile: UserProfile): void {
    if (!this.activeSession) return

    const adapter = autofillAdapterRegistry.getAdapter(window.location.href, doc)
    const formRoots = adapter.findFormRoots(doc)
    const rawFields = formRoots.flatMap((root) => fieldDetector.detectFields(root))
    const uniqueFields = Array.from(new Map(rawFields.map((f) => [f.element, f])).values())

    const analyzed = formAnalyzer.analyzeFields(uniqueFields, profile)
    const progress = formAnalyzer.calculateProgress(analyzed)

    this.activeSession.progress = progress
    this.activeSession.fields = analyzed
    this.activeSession.lastActivityAt = new Date().toISOString()

    this.renderPanel(doc, profile)
  }

  /**
   * Attaches change and input listeners to track form completion live.
   */
  private attachListeners(doc: Document, profile: UserProfile): void {
    if (this.inputListenerAttached) return
    this.inputListenerAttached = true

    const debouncedRefresh = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.refreshProgress(doc, profile)
      }, 300)
    }

    doc.addEventListener('input', debouncedRefresh, { passive: true })
    doc.addEventListener('change', debouncedRefresh, { passive: true })

    // Observe dynamic form steps / field additions
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          debouncedRefresh()
          break
        }
      }
    })

    this.observer.observe(doc.body, { childList: true, subtree: true })
  }

  /**
   * Dismisses and unmounts the assistant.
   */
  dismiss(): void {
    assistantPanelManager.remove()
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.activeSession = null
  }

  private inferJobTitle(doc: Document): string {
    const h1 = doc.querySelector('h1')?.textContent?.trim()
    if (h1 && h1.length < 80) return h1
    const title = doc.title || ''
    const clean = title.split(/[-–|•]/)[0]?.trim()
    return clean || 'Position'
  }

  private inferCompany(doc: Document): string {
    const host = window.location.hostname
    const parts = host.split('.')
    if (parts.length >= 2) {
      const name = parts[parts.length - 2]
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    return 'Company'
  }
}

export const assistantCoordinator = new AssistantCoordinator()
