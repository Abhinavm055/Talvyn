import {
  SuccessDetectionResult,
  ExtractedJob,
  Job,
} from './types'
import { successAdapterRegistry } from './adapters/registry'
import { applicationSessionManager } from './applicationSession'
import { jobResolver } from './jobResolver'
import { successNotificationManager } from './successNotification'
import { jobsService } from '../../services/jobsService'
import { getToken } from '../../utils/storage'

export class ApplicationSuccessDetector {
  private hasProcessedCurrentPage = false
  private observer: MutationObserver | null = null

  /**
   * Initializes submission listeners on forms to record user-initiated submit events.
   */
  observeFormSubmission(): void {
    const forms = Array.from(document.querySelectorAll('form'))
    forms.forEach((form) => {
      form.addEventListener('submit', () => {
        applicationSessionManager.recordSubmission().catch(console.error)
      })
    })

    const submitButtons = Array.from(
      document.querySelectorAll('button[type="submit"], input[type="submit"], button[class*="submit" i], button[data-test*="submit" i]')
    )
    submitButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        applicationSessionManager.recordSubmission().catch(console.error)
      })
    })
  }

  /**
   * Evaluates if the current page or state indicates application success.
   */
  async checkApplicationSuccess(url: string = window.location.href, doc: Document = document): Promise<SuccessDetectionResult | null> {
    if (this.hasProcessedCurrentPage) return null

    const session = await applicationSessionManager.getActiveSession()
    const adapter = successAdapterRegistry.getAdapter(url, doc)
    const result = adapter.detectSuccess(url, doc, session)

    if (!result || !result.isSuccess) {
      return result || null
    }

    const token = await getToken()
    if (!token) {
      console.log('[Talvyn] Success detected, but user not logged in. Skipping auto-tracking.')
      return result
    }

    const resolvedJob = jobResolver.resolveAppliedJob(doc, session)

    // Handle CONFIRMED (90-100%)
    if (result.confidenceLevel === 'CONFIRMED') {
      this.hasProcessedCurrentPage = true
      await this.processConfirmedSuccess(resolvedJob, result)
      await applicationSessionManager.clearSession()
      return result
    }

    // Handle LIKELY (70-89%)
    if (result.confidenceLevel === 'LIKELY') {
      this.hasProcessedCurrentPage = true
      successNotificationManager.showLikelyPrompt(resolvedJob, result, {
        onViewJob: () => {},
        onUndo: async () => {},
        onConfirmLikely: async (extracted, res) => {
          await this.processConfirmedSuccess(extracted, res)
          await applicationSessionManager.clearSession()
        },
        onDismiss: () => {
          successNotificationManager.remove()
        },
      })
      return result
    }

    return result
  }

  private async processConfirmedSuccess(job: ExtractedJob, result: SuccessDetectionResult): Promise<void> {
    try {
      console.log(`[Talvyn] Auto-tracking applied job: ${job.title} at ${job.company}`)

      const response = await jobsService.trackApplied({
        title: job.title,
        company: job.company,
        jobUrl: job.jobUrl,
        sourceWebsite: job.sourceWebsite,
        location: job.location,
        salary: job.salary,
        description: job.description,
        confidence: result.confidence,
        detectionMethod: result.detectionMethod,
      })

      successNotificationManager.showConfirmed(
        response.job,
        response.previousStatus,
        response.isNew,
        {
          onViewJob: () => {},
          onUndo: async (trackedJob: Job, prevStatus: string | null, isNewRecord: boolean) => {
            await jobsService.undoApplied(trackedJob.id, {
              previousStatus: prevStatus as any,
              isNew: isNewRecord,
            })
            console.log(`[Talvyn] Reverted applied status for ${trackedJob.title}`)
          },
          onConfirmLikely: async () => {},
          onDismiss: () => {
            successNotificationManager.remove()
          },
        }
      )
    } catch (err) {
      console.error('[Talvyn] Failed to auto-track applied job:', err)
    }
  }

  /**
   * Resets page processed state on navigation.
   */
  resetPageState(): void {
    this.hasProcessedCurrentPage = false
    this.observeFormSubmission()
  }
}

export const applicationSuccessDetector = new ApplicationSuccessDetector()
