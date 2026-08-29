import { Job, ExtractedJob, SuccessDetectionResult } from './types'
import { CONFIG } from '../../utils/config'

const NOTIFICATION_ID = 'talvyn-success-notification'

export interface SuccessNotificationCallbacks {
  onViewJob: (job: Job) => void
  onUndo: (job: Job, previousStatus: string | null, isNew: boolean) => Promise<void>
  onConfirmLikely: (extracted: ExtractedJob, result: SuccessDetectionResult) => Promise<void>
  onDismiss: () => void
}

export class SuccessNotificationManager {
  private activeElement: HTMLElement | null = null

  /**
   * Shows the Confirmed Success banner with "View Job" and "Undo" buttons.
   */
  showConfirmed(
    job: Job,
    previousStatus: string | null,
    isNew: boolean,
    callbacks: SuccessNotificationCallbacks
  ): void {
    this.remove()

    const container = document.createElement('div')
    container.id = NOTIFICATION_ID
    container.setAttribute('data-talvyn', 'true')

    container.innerHTML = `
      <div style="
        position:fixed;bottom:24px;right:24px;z-index:2147483647;
        width:380px;background:#ffffff;border-radius:14px;
        box-shadow:0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
        border:1px solid #10b981;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        padding:16px;box-sizing:border-box;animation:talvyn-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <style>
          @keyframes talvyn-slide-in {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="
              width:28px;height:28px;border-radius:50%;background:#ecfdf5;
              color:#059669;display:flex;align-items:center;justify-content:center;
              font-size:15px;font-weight:bold;
            ">✓</div>
            <div style="font-weight:700;font-size:14px;color:#065f46;">
              Application Tracked
            </div>
          </div>
          <span style="
            font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;
            background:#e0e7ff;color:#3730a3;
          ">Applied</span>
        </div>

        <div style="margin-left:36px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:14px;color:#0f172a;line-height:1.3;">
            ${this.escapeHtml(job.title)}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">
            ${this.escapeHtml(job.company)} ${job.location ? `· ${this.escapeHtml(job.location)}` : ''}
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid #f1f5f9;">
          <button id="talvyn-undo-applied-btn" style="
            background:transparent;border:none;color:#dc2626;font-size:12px;
            font-weight:600;cursor:pointer;padding:4px 8px;border-radius:6px;
          ">Undo</button>

          <div style="display:flex;align-items:center;gap:6px;">
            <button id="talvyn-dismiss-success-btn" style="
              background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;
              font-weight:600;padding:6px 12px;border-radius:6px;cursor:pointer;
            ">Dismiss</button>
            <a id="talvyn-view-job-link" href="${CONFIG.DASHBOARD_URL}/jobs/${job.id}" target="_blank" style="
              background:#4f46e5;color:white;text-decoration:none;font-size:12px;
              font-weight:600;padding:6px 14px;border-radius:6px;display:inline-block;
            ">View Job →</a>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(container)
    this.activeElement = container

    // Attach listeners
    container.querySelector('#talvyn-undo-applied-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Undoing…'
      await callbacks.onUndo(job, previousStatus, isNew)
      this.showRevertedNotice(job, previousStatus, isNew)
    })

    container.querySelector('#talvyn-dismiss-success-btn')?.addEventListener('click', () => {
      this.remove()
      callbacks.onDismiss()
    })
  }

  /**
   * Shows the Likely Success prompt for user confirmation (70-89% confidence).
   */
  showLikelyPrompt(
    extracted: ExtractedJob,
    result: SuccessDetectionResult,
    callbacks: SuccessNotificationCallbacks
  ): void {
    this.remove()

    const container = document.createElement('div')
    container.id = NOTIFICATION_ID
    container.setAttribute('data-talvyn', 'true')

    container.innerHTML = `
      <div style="
        position:fixed;bottom:24px;right:24px;z-index:2147483647;
        width:380px;background:#ffffff;border-radius:14px;
        box-shadow:0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
        border:1px solid #f59e0b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        padding:16px;box-sizing:border-box;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="
              width:28px;height:28px;border-radius:50%;background:#fef3c7;
              color:#d97706;display:flex;align-items:center;justify-content:center;
              font-size:14px;font-weight:bold;
            ">🔍</div>
            <div style="font-weight:700;font-size:14px;color:#92400e;">
              Application Submitted?
            </div>
          </div>
          <span style="
            font-size:10px;font-weight:700;padding:2px 6px;border-radius:12px;
            background:#fef3c7;color:#b45309;
          ">${result.confidence}% Confidence</span>
        </div>

        <div style="margin-left:36px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13px;color:#0f172a;line-height:1.3;">
            ${this.escapeHtml(extracted.title)}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">
            ${this.escapeHtml(extracted.company)}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
            Signal: ${this.escapeHtml(result.detectionMethod)}
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:8px;border-top:1px solid #f1f5f9;">
          <button id="talvyn-dismiss-likely-btn" style="
            background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;
            font-weight:600;padding:6px 12px;border-radius:6px;cursor:pointer;
          ">No, Dismiss</button>
          <button id="talvyn-confirm-likely-btn" style="
            background:#4f46e5;color:white;border:none;font-size:12px;
            font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;
          ">Mark as Applied ✓</button>
        </div>
      </div>
    `

    document.body.appendChild(container)
    this.activeElement = container

    container.querySelector('#talvyn-confirm-likely-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Tracking…'
      await callbacks.onConfirmLikely(extracted, result)
    })

    container.querySelector('#talvyn-dismiss-likely-btn')?.addEventListener('click', () => {
      this.remove()
      callbacks.onDismiss()
    })
  }

  showRevertedNotice(job: Job, previousStatus: string | null, isNew: boolean): void {
    if (!this.activeElement) return
    this.activeElement.innerHTML = `
      <div style="
        position:fixed;bottom:24px;right:24px;z-index:2147483647;
        width:340px;background:#1e293b;color:white;border-radius:12px;
        padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.25);
        font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;display:flex;align-items:center;justify-content:space-between;
      ">
        <span>${isNew ? 'Tracked application removed.' : `Status reverted to ${previousStatus || 'SAVED'}.`}</span>
        <button id="talvyn-close-revert-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">×</button>
      </div>
    `
    this.activeElement.querySelector('#talvyn-close-revert-btn')?.addEventListener('click', () => {
      this.remove()
    })
    setTimeout(() => this.remove(), 4000)
  }

  remove(): void {
    document.getElementById(NOTIFICATION_ID)?.remove()
    this.activeElement = null
  }
}

export const successNotificationManager = new SuccessNotificationManager()
