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

export class AutofillCoordinator {
  private isPanelActive = false
  private currentSummary: FormAnalysisSummary | null = null

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
    let availableResumes: Resume[] = []
    try {
      availableResumes = await resumesService.list()
    } catch {
      /* fallback */
    }

    const summary = await this.scanAndAnalyzeForm(url, doc, profile, availableResumes)

    if (summary.totalFields === 0) {
      this.dismiss()
      return false
    }

    this.isPanelActive = true
    autofillPanelManager.render(summary, {
      onAutofillHighConfidence: async () => {
        const highFields = summary.matchedFields.filter((f) => f.confidenceLevel === 'HIGH')
        autofillEngine.autofillFields(highFields, false)
        autofillPanelManager.updateSummary(summary)
      },
      onAutofillAllEligible: async () => {
        const eligible = summary.matchedFields.filter((f) => f.canAutofill)
        autofillEngine.autofillFields(eligible, false)
        autofillPanelManager.updateSummary(summary)
      },
      onAutofillSingleField: async (field: MatchedFormField) => {
        autofillEngine.autofillFields([field], true)
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

  dismiss(): void {
    autofillPanelManager.remove()
    this.isPanelActive = false
  }

  isActive(): boolean {
    return this.isPanelActive
  }
}

export const autofillCoordinator = new AutofillCoordinator()
