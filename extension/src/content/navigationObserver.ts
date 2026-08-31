/**
 * Talvyn SPA Navigation & DOM Hardening (Phase 2F)
 *
 * Provides:
 * 1. History API Patching (pushState / replaceState) + popstate / hashchange listeners.
 * 2. Stable page fingerprinting to avoid redundant re-scans on unchanged DOMs.
 * 3. Debounced dynamic modal & form injection detection without continuous polling.
 * 4. Safe runtime-lifecycle checks to stop immediately on extension context invalidation.
 */

import { logger } from '../utils/logger'
import { isRuntimeActive, onExtensionShutdown } from '../utils/extensionContext'

export type NavigationCallback = (url: string) => void

export class NavigationObserver {
  private lastUrl = ''
  private lastFingerprint = ''
  private isInitialized = false
  private callbacks: NavigationCallback[] = []
  private mutationObserver: MutationObserver | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private popstateListener: (() => void) | null = null
  private hashchangeListener: (() => void) | null = null
  private originalPushState: typeof history.pushState | null = null
  private originalReplaceState: typeof history.replaceState | null = null
  private unregisterShutdown: (() => void) | null = null

  /**
   * Initializes SPA navigation hooks.
   */
  init(onNavigate: NavigationCallback): void {
    if (!isRuntimeActive()) return
    if (this.isInitialized) return
    this.isInitialized = true
    this.callbacks.push(onNavigate)

    // Register with centralized extension shutdown manager
    this.unregisterShutdown = onExtensionShutdown(() => this.cleanup())

    if (typeof window === 'undefined') return

    this.lastUrl = window.location.href

    // 1. Intercept History API
    this.patchHistoryAPI()

    // 2. Listen to standard browser navigation events
    this.popstateListener = () => this.handleUrlChange('popstate')
    this.hashchangeListener = () => this.handleUrlChange('hashchange')

    window.addEventListener('popstate', this.popstateListener)
    window.addEventListener('hashchange', this.hashchangeListener)

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
      this.originalPushState = history.pushState
      this.originalReplaceState = history.replaceState
      const originalPush = this.originalPushState
      const originalReplace = this.originalReplaceState
      const self = this

      history.pushState = function (...args) {
        const result = originalPush.apply(this, args)
        self.handleUrlChange('pushState')
        return result
      }

      history.replaceState = function (...args) {
        const result = originalReplace.apply(this, args)
        self.handleUrlChange('replaceState')
        return result
      }
    } catch (err) {
      logger.warn('Failed to patch History API:', err)
    }
  }

  private handleUrlChange(source: string): void {
    if (!isRuntimeActive()) {
      this.cleanup()
      return
    }
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
      if (!isRuntimeActive()) {
        this.cleanup()
        return
      }
      if (typeof window === 'undefined') return

      // If URL changed in the meantime
      if (window.location.href !== this.lastUrl) {
        this.handleUrlChange('mutation')
        return
      }

      // Debounce DOM re-evaluation
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        if (!isRuntimeActive()) {
          this.cleanup()
          return
        }
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
    if (!isRuntimeActive()) {
      this.cleanup()
      return
    }
    for (const cb of this.callbacks) {
      try {
        cb(url)
      } catch (err) {
        logger.error('Error in navigation callback:', err)
      }
    }
  }

  cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }

    if (typeof window !== 'undefined') {
      if (this.popstateListener) {
        window.removeEventListener('popstate', this.popstateListener)
        this.popstateListener = null
      }
      if (this.hashchangeListener) {
        window.removeEventListener('hashchange', this.hashchangeListener)
        this.hashchangeListener = null
      }

      // Restore original History API functions if they were patched
      if (this.originalPushState && history.pushState) {
        history.pushState = this.originalPushState
        this.originalPushState = null
      }
      if (this.originalReplaceState && history.replaceState) {
        history.replaceState = this.originalReplaceState
        this.originalReplaceState = null
      }
    }

    if (this.unregisterShutdown) {
      this.unregisterShutdown()
      this.unregisterShutdown = null
    }

    this.callbacks = []
    this.isInitialized = false
  }
}

export const navigationObserver = new NavigationObserver()
