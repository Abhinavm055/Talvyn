/**
 * Centralized Extension Context & Lifecycle Management
 *
 * Prevents runtime errors and log spam when an extension is reloaded, updated,
 * or its background context becomes invalidated while content scripts are active.
 */

export type RuntimeState = 'INITIALIZING' | 'READY' | 'SHUTTING_DOWN' | 'STOPPED'

let currentRuntimeState: RuntimeState = 'INITIALIZING'
let hasLoggedInvalidation = false
const shutdownCallbacks: Array<() => void> = []

/**
 * Checks whether the Chrome extension execution context is currently valid and alive.
 */
export function isExtensionContextValid(): boolean {
  if (currentRuntimeState === 'STOPPED' || currentRuntimeState === 'SHUTTING_DOWN') {
    return false
  }

  try {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime !== 'undefined' &&
      Boolean(chrome.runtime?.id)
    )
  } catch {
    return false
  }
}

/**
 * Detects if an error or exception is caused by an invalidated extension context.
 */
export function isExtensionContextInvalidated(error: unknown): boolean {
  if (!error) return false
  const errStr =
    error instanceof Error
      ? error.message || error.stack || ''
      : typeof error === 'string'
      ? error
      : String(error)

  const lower = errStr.toLowerCase()
  return (
    lower.includes('extension context invalidated') ||
    lower.includes('context invalidated') ||
    lower.includes('invoking a callback that failed with message: extension context invalidated') ||
    lower.includes('cannot access a chrome api') ||
    lower.includes('message port closed before a response was received')
  )
}

/**
 * Registers a cleanup listener to be executed upon extension shutdown.
 */
export function onExtensionShutdown(callback: () => void): () => void {
  shutdownCallbacks.push(callback)
  return () => {
    const idx = shutdownCallbacks.indexOf(callback)
    if (idx >= 0) shutdownCallbacks.splice(idx, 1)
  }
}

/**
 * Idempotently shuts down all content script operations, observers, and listeners.
 */
export function shutdownExtensionRuntime(): void {
  if (currentRuntimeState === 'STOPPED' || currentRuntimeState === 'SHUTTING_DOWN') {
    return
  }

  currentRuntimeState = 'SHUTTING_DOWN'

  if (!hasLoggedInvalidation) {
    hasLoggedInvalidation = true
    console.log('[Talvyn] Extension context invalidated; stopping content script.')
  }

  while (shutdownCallbacks.length > 0) {
    try {
      const cb = shutdownCallbacks.pop()
      cb?.()
    } catch {
      /* ignore cleanup errors */
    }
  }

  currentRuntimeState = 'STOPPED'
}

/**
 * Sets runtime state to READY after successful initialization.
 */
export function setRuntimeReady(): void {
  if (currentRuntimeState === 'INITIALIZING') {
    currentRuntimeState = 'READY'
  }
}

/**
 * Returns whether runtime is currently active.
 * If invalid, automatically triggers shutdown.
 */
export function isRuntimeActive(): boolean {
  if (currentRuntimeState === 'STOPPED' || currentRuntimeState === 'SHUTTING_DOWN') {
    return false
  }
  if (!isExtensionContextValid()) {
    shutdownExtensionRuntime()
    return false
  }
  return true
}

/**
 * Resets state for testing purposes only.
 */
export function __resetRuntimeStateForTesting(): void {
  currentRuntimeState = 'INITIALIZING'
  hasLoggedInvalidation = false
  shutdownCallbacks.length = 0
}
