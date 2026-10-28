import { ApplicationSession } from './types'

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

async function requestSession(action: 'get' | 'set' | 'clear', session?: ApplicationSession): Promise<{ success: boolean; session: ApplicationSession | null }> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return { success: false, session: null }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ success: false, session: null }), 3000)
    chrome.runtime.sendMessage({ type: 'TALVYN_APPLICATION_SESSION', action, session }, (response: { success?: boolean; session?: ApplicationSession }) => {
      clearTimeout(timeout)
      if (chrome.runtime.lastError || !response?.success) resolve({ success: false, session: null })
      else resolve({ success: true, session: response.session || null })
    })
  })
}

export class ApplicationSessionManager {
  private inMemorySession: ApplicationSession | null = null

  /**
   * Retrieves the active application session if not expired.
   */
  async getActiveSession(): Promise<ApplicationSession | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await requestSession('get')
        const stored = response.session
        if (response.success && !stored) {
          this.inMemorySession = null
          return null
        }
        if (stored) {
          const age = Date.now() - new Date(stored.lastActivityAt).getTime()
          if (age < SESSION_TTL_MS) {
            this.inMemorySession = stored
            return stored
          } else {
            await this.clearSession()
            return null
          }
        }
      }
    } catch {
      /* fallback to inMemory */
    }

    if (this.inMemorySession) {
      const age = Date.now() - new Date(this.inMemorySession.lastActivityAt).getTime()
      if (age < SESSION_TTL_MS) {
        return this.inMemorySession
      }
      this.inMemorySession = null
    }

    return null
  }

  /**
   * Saves or updates current application session.
   */
  async createOrUpdateSession(data: Partial<ApplicationSession>): Promise<ApplicationSession> {
    const previous = await this.getActiveSession()
    const differentJob = Boolean(previous && (
      data.jobTitle && previous.jobTitle && data.jobTitle.trim().toLowerCase() !== previous.jobTitle.trim().toLowerCase() ||
      data.company && previous.company && data.company.trim().toLowerCase() !== previous.company.trim().toLowerCase()
    ))
    const existing = differentJob ? null : previous
    const now = new Date().toISOString()

    const session: ApplicationSession = {
      id: existing?.id || `app-session-${Date.now()}`,
      pageUrl: data.pageUrl || existing?.pageUrl || window.location.href,
      jobUrl: data.jobUrl || existing?.jobUrl || null,
      jobTitle: data.jobTitle || existing?.jobTitle || null,
      company: data.company || existing?.company || null,
      location: data.location || existing?.location || null,
      startedAt: existing?.startedAt || now,
      lastActivityAt: now,
      submitted: data.submitted !== undefined ? data.submitted : existing?.submitted || false,
    }

    this.inMemorySession = session

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await requestSession('set', session)
      }
    } catch {
      /* ignore storage errors */
    }

    return session
  }

  /**
   * Flags the session as user-submitted when the user clicks the submit button on the application form.
   */
  async recordSubmission(): Promise<void> {
    await this.createOrUpdateSession({ submitted: true })
  }

  /**
   * Clears the current application session.
   */
  async clearSession(): Promise<void> {
    this.inMemorySession = null
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await requestSession('clear')
      }
    } catch {
      /* ignore */
    }
  }
}

export const applicationSessionManager = new ApplicationSessionManager()
