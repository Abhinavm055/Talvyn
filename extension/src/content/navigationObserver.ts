/**
 * Talvyn SPA Navigation & DOM Hardening (Phase 2F)
 *
 * Provides:
 * 1. History API Patching (pushState / replaceState) + popstate / hashchange listeners.
 * 2. Stable page fingerprinting to avoid redundant re-scans on unchanged DOMs.
 * 3. Debounced dynamic modal & form injection detection without continuous polling.
 * 4. Error isolation to ensure host pages are never crashed.
 */

import { logger } from '../utils/logger'

export type NavigationCallback = (url: string) => void

export class NavigationObserver {
  private lastUrl = ''
  private lastFingerprint = ''
  private isInitialized = false
  private callbacks: NavigationCallback[] = []
  private mutationObserver: MutationObserver | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Initializes SPA navigation hooks.
   */
  init(onNavigate: NavigationCallback): void {
    if (this.isInitialized) return
    this.isInitialized = true
    this.callbacks.push(onNavigate)

    if (typeof window === 'undefined') return

    this.lastUrl = window.location.href

    // 1. Intercept History API
    this.patchHistoryAPI()

    // 2. Listen to standard browser navigation events
    window.addEventListener('popstate', () => this.handleUrlChange('popstate'))
    window.addEventListener('hashchange', () => this.handleUrlChange('hashchange'))

    // 3. Setup Debounced Mutation Observer for dynamic SPA modals & infinite scroll
    this.setupMutationObserver()
  }

  /**
   * Generates a stable lightweight fingerprint for the current page state.
   */
  getFingerprint(url: string = window.location.href, doc: Document = document): string {
    const inputCount = doc.querySelectorAll('input:not([type="hidden"]), textarea').length
    const jobCardCount = doc.querySelectorAll('[data-job-id], [class*="job-card" i], [class*="jobCard" i]').length
    const title = (doc.title || '').trim().slice(0, 60)
    return `${url}::inputs=${inputCount}::cards=${jobCardCount}::title=${title}`
  }

  /**
   * Checks if current page state has actually changed.
   */
  hasStateChanged(url: string = window.location.href, doc: Document = document): boolean {
    const currentFingerprint = this.getFingerprint(url, doc)
    if (currentFingerprint === this.lastFingerprint) {
      return false
    }
    this.lastFingerprint = currentFingerprint
    return true
  }

  private patchHistoryAPI(): void {
    try {
      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState
      const self = this

      history.pushState = function (...args) {
        const result = originalPushState.apply(this, args)
        self.handleUrlChange('pushState')
        return result
      }

      history.replaceState = function (...args) {
        const result = originalReplaceState.apply(this, args)
        self.handleUrlChange('replaceState')
        return result
      }
    } catch (err) {
      logger.warn('Failed to patch History API:', err)
    }
  }

  private handleUrlChange(source: string): void {
    if (typeof window === 'undefined') return
    const currentUrl = window.location.href
    if (currentUrl !== this.lastUrl) {
      logger.debug(`SPA Navigation detected via ${source}:`, currentUrl)
      this.lastUrl = currentUrl
      this.triggerCallbacks(currentUrl)
    }
  }

  private setupMutationObserver(): void {
    if (typeof document === 'undefined' || !document.body) return

    this.mutationObserver = new MutationObserver(() => {
      if (typeof window === 'undefined') return

      // If URL changed in the meantime
      if (window.location.href !== this.lastUrl) {
        this.handleUrlChange('mutation')
        return
      }

      // Debounce DOM re-evaluation
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        if (this.hasStateChanged(window.location.href, document)) {
          logger.debug('DOM state mutation detected with changed fingerprint.')
          this.triggerCallbacks(window.location.href)
        }
      }, 1000)
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  private triggerCallbacks(url: string): void {
    for (const cb of this.callbacks) {
      try {
        cb(url)
      } catch (err) {
        logger.error('Error in navigation callback:', err)
      }
    }
  }

  cleanup(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    this.callbacks = []
    this.isInitialized = false
  }
}

export const navigationObserver = new NavigationObserver()
