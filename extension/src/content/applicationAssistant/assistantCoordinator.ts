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
import { profileService } from '../../services/profileService'
import { getUser } from '../../utils/storage'
import {
  captureReviewedAutofill, executeReviewedAutofill, blockedReviewedAutofill, reviewedProfileMatches,
  ReviewedAutofillPlan, ReviewedAutofillResult,
} from '../autofill/reviewedAutofill'
import { jobsService } from '../../services/jobsService'
import { UserProfile, Resume, DetectedFormField, ExtractedJob } from '../../types'

export class AssistantCoordinator {
  private activeSession: ApplicationAssistantSession | null = null
  private observer: MutationObserver | null = null
  private inputListenerAttached = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private currentResumes: Resume[] = []
  private selectedResume: Resume | null = null
  private listenerDocument: Document | null = null
  private inputListener: (() => void) | null = null
  private currentPlan: ReviewedAutofillPlan | null = null
  private activationRevision = 0
  private profileUserId: string | null = null

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
    const revision = ++this.activationRevision
    this.currentPlan = null
    try {
      // 1. Fetch user resumes
      let resumes: Resume[] = []
      try {
        resumes = await resumesService.list()
      } catch { /* Resume recommendations are optional. */ }
      if (revision !== this.activationRevision) return false
      this.currentResumes = resumes

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
      const sameSession = this.activeSession?.jobUrl === url && this.profileUserId === profile.userId
      const sessionId = sameSession ? this.activeSession!.id : `asst-session-${Date.now()}-${revision}`
      this.profileUserId = profile.userId
      this.activeSession = {
        id: sessionId,
        jobTitle: jobTitle || 'Application',
        company: company || 'Company',
        jobUrl: url,
        state: 'IN_PROGRESS',
        startedAt: sameSession ? this.activeSession!.startedAt : new Date().toISOString(),
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
      if (revision !== this.activationRevision) return false

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
    autofillEngine.trackFields(this.activeSession.fields.map(({ field }) => field.element))
    const plan = captureReviewedAutofill(
      this.activeSession.fields.map(({ field }) => fieldMatcher.matchField(field, profile)),
      profile, this.activeSession.jobUrl,
    )
    this.currentPlan = plan

    const bestResumeRec = this.selectedResume
      ? {
          resume: this.selectedResume,
          score: 0,
          matchReasons: ['Selected active resume'],
          isDefault: !!this.selectedResume.isDefault,
        }
      : null

    assistantPanelManager.render(
      this.activeSession,
      bestResumeRec,
      this.currentResumes,
      {
        onAutofill: () => this.handleAutofill(doc, profile, plan),
        onRescan: () => this.rescan(doc, profile),
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
  private matchedFields(doc: Document, profile: UserProfile) {
    const adapter = autofillAdapterRegistry.getAdapter(window.location.href, doc)
    const formRoots = adapter.findFormRoots(doc)
    const rawFields = formRoots.flatMap((root) => fieldDetector.detectFields(root))
    const uniqueFields = Array.from(new Map(rawFields.map((f) => [f.element, f])).values())

    return uniqueFields.map((field) => fieldMatcher.matchField(field, profile))
  }

  /** The worker remains the authority for the connected account and cached profile. */
  private async connectedProfile(expected: UserProfile): Promise<UserProfile | null> {
    try {
      const user = await getUser()
      if (!user || user.id !== expected.userId) return null
      const profile = user.profile || await profileService.get()
      return profile?.userId === user.id ? profile : null
    } catch { return null }
  }

  private async handleAutofill(
    doc: Document, profile: UserProfile, plan: ReviewedAutofillPlan,
  ): Promise<ReviewedAutofillResult> {
    const isCurrent = () => this.currentPlan === plan && this.activeSession?.jobUrl === plan.pageUrl &&
      window.location.href === plan.pageUrl
    if (!isCurrent()) return blockedReviewedAutofill(plan, 'This preview is out of date. Review the form again before filling.')
    const currentProfile = await this.connectedProfile(profile)
    // A refreshed preview, account change or dismissal during the worker request invalidates this callback.
    if (!isCurrent()) return blockedReviewedAutofill(plan, 'This preview is out of date. Review the form again before filling.')
    if (!currentProfile) return blockedReviewedAutofill(plan, 'The connected account could not be verified. Reconnect and analyze this form again.')
    if (!reviewedProfileMatches(plan, currentProfile)) {
      return blockedReviewedAutofill(plan, 'Your profile has changed. Review the form again before filling.')
    }
    const result = executeReviewedAutofill(plan, {
      engine: autofillEngine, readFields: () => this.matchedFields(doc, currentProfile),
      profile: currentProfile, pageUrl: window.location.href, isCurrent,
    })

    // Refresh progress after filling
    if (isCurrent()) this.refreshProgress(doc, currentProfile)
    return result
  }

  private async rescan(doc: Document, profile: UserProfile): Promise<void> {
    const session = this.activeSession
    this.currentPlan = null
    const currentProfile = await this.connectedProfile(profile)
    if (this.activeSession !== session || !session) return
    if (!currentProfile) throw new Error('The connected account could not be verified. Reconnect and analyze this form again.')
    this.refreshProgress(doc, currentProfile)
    this.attachListeners(doc, currentProfile)
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
    this.activeSession.highRiskQuestions = analyzed.filter((field) => field.riskLevel === 'USER_ACTION_REQUIRED')
    this.activeSession.missingRequiredCount = progress.requiredFields - progress.requiredFilledFields
    this.activeSession.lastActivityAt = new Date().toISOString()

    this.renderPanel(doc, profile)
  }

  /**
   * Attaches change and input listeners to track form completion live.
   */
  private attachListeners(doc: Document, profile: UserProfile): void {
    this.detachListeners()
    this.inputListenerAttached = true

    const isTalvynNode = (node: Node | null): boolean => {
      const element = node?.nodeType === 1 ? node as Element : node?.parentElement
      return !!element?.closest('[data-talvyn], [data-talvyn-host], #talvyn-host, #talvyn-panel')
    }
    const debouncedRefresh = (event?: Event) => {
      if (event && isTalvynNode(event.target as Node)) return
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.refreshProgress(doc, profile)
      }, 300)
    }

    doc.addEventListener('input', debouncedRefresh, { passive: true })
    doc.addEventListener('change', debouncedRefresh, { passive: true })
    this.listenerDocument = doc
    this.inputListener = debouncedRefresh

    // Observe dynamic form steps / field additions
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (isTalvynNode(m.target)) continue
        const changed = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)]
        if (m.type !== 'childList' || changed.some((node) => !isTalvynNode(node))) {
          debouncedRefresh()
          break
        }
      }
    })

    this.observer.observe(doc.body, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['id', 'name', 'type', 'autocomplete', 'aria-label', 'aria-labelledby',
        'placeholder', 'required', 'aria-required', 'disabled', 'readonly', 'hidden',
        'style', 'class', 'value', 'checked', 'form'],
    })
  }

  /**
   * Dismisses and unmounts the assistant.
   */
  dismiss(): void {
    this.activationRevision++
    assistantPanelManager.remove()
    this.detachListeners()
    this.activeSession = null
    this.currentPlan = null
    this.profileUserId = null
  }

  private detachListeners(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.listenerDocument && this.inputListener) {
      this.listenerDocument.removeEventListener('input', this.inputListener)
      this.listenerDocument.removeEventListener('change', this.inputListener)
    }
    this.listenerDocument = null
    this.inputListener = null
    this.inputListenerAttached = false
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = null
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
