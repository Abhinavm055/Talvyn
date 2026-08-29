import { ApplicationSession } from './types'

const SESSION_STORAGE_KEY = 'talvyn_active_application_session'
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

export class ApplicationSessionManager {
  private inMemorySession: ApplicationSession | null = null

  /**
   * Retrieves the active application session if not expired.
   */
  async getActiveSession(): Promise<ApplicationSession | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(SESSION_STORAGE_KEY)
        const stored = result[SESSION_STORAGE_KEY] as ApplicationSession | undefined
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
    const existing = await this.getActiveSession()
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
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session })
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
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(SESSION_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
  }
}

export const applicationSessionManager = new ApplicationSessionManager()
