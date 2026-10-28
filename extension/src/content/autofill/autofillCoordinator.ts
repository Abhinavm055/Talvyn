import {
  UserProfile,
  FormAnalysisSummary,
  MatchedFormField,
  Resume,
} from '../../types'
import { autofillAdapterRegistry } from './adapters/registry'
import { fieldDetector } from './fieldDetector'
import { fieldMatcher } from './fieldMatcher'
import { autofillEngine } from './autofillEngine'
import { autofillPanelManager } from './autofillPanel'
import { resumesService } from '../../services/resumesService'
import { profileService } from '../../services/profileService'
import { getUser } from '../../utils/storage'
import {
  captureReviewedAutofill, executeReviewedAutofill, blockedReviewedAutofill, reviewedProfileMatches,
  ReviewedAutofillPlan, ReviewedAutofillResult,
} from './reviewedAutofill'

export class AutofillCoordinator {
  private isPanelActive = false
  private currentSummary: FormAnalysisSummary | null = null
  private currentPlan: ReviewedAutofillPlan | null = null
  private lastResult: ReviewedAutofillResult | null = null
  private activationRevision = 0

  /**
   * Checks if current page is an active job application form.
   */
  isApplicationFormPage(url: string, doc: Document): boolean {
    const adapter = autofillAdapterRegistry.getAdapter(url, doc)
    return adapter.isApplicationForm(url, doc)
  }

  /**
   * Analyzes the application form and maps detected fields to the user profile.
   */
  async scanAndAnalyzeForm(
    url: string,
    doc: Document,
    profile: UserProfile,
    resumes: Resume[] = []
  ): Promise<FormAnalysisSummary> {
    const adapter = autofillAdapterRegistry.getAdapter(url, doc)
    const formRoots = adapter.findFormRoots(doc)

    const rawFields = formRoots.flatMap((root) => fieldDetector.detectFields(root))

    // Deduplicate by DOM element reference
    const uniqueFields = Array.from(new Map(rawFields.map((f) => [f.element, f])).values())

    const matchedFields: MatchedFormField[] = uniqueFields.map((field) =>
      fieldMatcher.matchField(field, profile)
    )

    let highConfidenceCount = 0
    let mediumConfidenceCount = 0
    let lowConfidenceCount = 0
    let unknownCount = 0
    let customQuestionsCount = 0
    let resumeUploadDetected = false

    for (const m of matchedFields) {
      if (m.isResumeUpload) {
        resumeUploadDetected = true
      }
      if (m.isCustomQuestion) {
        customQuestionsCount++
      }
      if (m.confidenceLevel === 'HIGH') {
        highConfidenceCount++
      } else if (m.confidenceLevel === 'MEDIUM') {
        mediumConfidenceCount++
      } else if (m.confidenceLevel === 'LOW') {
        lowConfidenceCount++
      } else {
        unknownCount++
      }
    }

    const defaultResume = resumes.find((r) => r.isDefault) || (resumes.length > 0 ? resumes[0] : null)

    const summary: FormAnalysisSummary = {
      totalFields: matchedFields.length,
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      unknownCount,
      customQuestionsCount,
      resumeUploadDetected,
      matchedFields,
      availableResumes: resumes,
      defaultResume,
      pageUrl: url,
      detectedAt: new Date().toISOString(),
    }

    this.currentSummary = summary
    return summary
  }

  /**
   * Activates the Autofill Review Panel on the current page.
   */
  async activateAutofill(url: string, doc: Document, profile: UserProfile): Promise<boolean> {
    const revision = ++this.activationRevision
    this.currentPlan = null
    let availableResumes: Resume[] = []
    try {
      availableResumes = await resumesService.list()
    } catch {
      /* fallback */
    }
    if (revision !== this.activationRevision) return false

    const summary = await this.scanAndAnalyzeForm(url, doc, profile, availableResumes)
    if (revision !== this.activationRevision) return false

    if (summary.totalFields === 0) {
      this.dismiss()
      return false
    }

    this.isPanelActive = true
    autofillEngine.trackFields(summary.matchedFields.map(({ field }) => field.element))
    const plan = captureReviewedAutofill(summary.matchedFields, profile, url)
    this.currentPlan = plan
    this.lastResult = null
    autofillPanelManager.render(summary, {
      onAutofillHighConfidence: async () => {
        this.lastResult = await this.fillReviewed(doc, profile, plan, (field) => field.confidenceLevel === 'HIGH')
        autofillPanelManager.updateSummary(summary)
      },
      onAutofillAllEligible: async () => {
        this.lastResult = await this.fillReviewed(doc, profile, plan)
        autofillPanelManager.updateSummary(summary)
      },
      onAutofillSingleField: async (field: MatchedFormField) => {
        this.lastResult = await this.fillReviewed(doc, profile, plan, (reviewed) => reviewed.field.element === field.field.element)
        autofillPanelManager.updateSummary(summary)
      },
      onRescan: async () => {
        await this.activateAutofill(window.location.href, document, profile)
      },
      onDismiss: () => {
        this.dismiss()
      },
    })

    return true
  }

  private async fillReviewed(
    doc: Document, profile: UserProfile, plan: ReviewedAutofillPlan,
    select?: (matched: MatchedFormField) => boolean,
  ): Promise<ReviewedAutofillResult> {
    const isCurrent = () => this.currentPlan === plan && this.isPanelActive &&
      this.currentSummary?.pageUrl === plan.pageUrl && window.location.href === plan.pageUrl
    if (!isCurrent()) return blockedReviewedAutofill(plan, 'This preview is out of date. Review the form again before filling.')
    let currentProfile: UserProfile | null = null
    try {
      const user = await getUser()
      if (user?.id === profile.userId) {
        const fresh = user.profile || await profileService.get()
        if (fresh?.userId === user.id) currentProfile = fresh
      }
    } catch { /* A disconnected or unverifiable account cannot fill old profile values. */ }
    if (!isCurrent()) return blockedReviewedAutofill(plan, 'This preview is out of date. Review the form again before filling.')
    if (!currentProfile) return blockedReviewedAutofill(plan, 'The connected account could not be verified. Reconnect and analyze this form again.')
    if (!reviewedProfileMatches(plan, currentProfile)) {
      return blockedReviewedAutofill(plan, 'Your profile has changed. Review the form again before filling.')
    }
    const verifiedProfile = currentProfile
    return executeReviewedAutofill(plan, {
      engine: autofillEngine, profile: verifiedProfile, pageUrl: window.location.href, isCurrent, select,
      readFields: () => {
        const adapter = autofillAdapterRegistry.getAdapter(window.location.href, doc)
        const raw = adapter.findFormRoots(doc).flatMap((root) => fieldDetector.detectFields(root))
        return Array.from(new Map(raw.map((field) => [field.element, field])).values())
          .map((field) => fieldMatcher.matchField(field, verifiedProfile))
      },
    })
  }

  getLastResult(): ReviewedAutofillResult | null { return this.lastResult }

  dismiss(): void {
    this.activationRevision++
    autofillPanelManager.remove()
    this.isPanelActive = false
    this.currentPlan = null
  }

  isActive(): boolean {
    return this.isPanelActive
  }
}

export const autofillCoordinator = new AutofillCoordinator()
