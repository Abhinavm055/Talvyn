/**
 * Talvyn Extension Authentication Synchronization Utility
 *
 * Ensures that web dashboard logout / session invalidation reliably clears
 * authentication in the Talvyn Browser Extension background service worker.
 */

export async function notifyExtensionDisconnect(): Promise<void> {
  const extId =
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-talvyn-extension-id')) ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('talvyn_connected_extension_id')) ||
    ''

  // 1. Direct external message to extension background worker if extensionId is available
  if (extId && typeof window !== 'undefined' && (window as any).chrome?.runtime?.sendMessage) {
    try {
      await new Promise<void>((resolve) => {
        let finished = false
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true
            resolve()
          }
        }, 300)

        try {
          (window as any).chrome.runtime.sendMessage(
            extId,
            { type: 'TALVYN_DISCONNECT_EXTENSION' },
            () => {
              if (!finished) {
                finished = true
                clearTimeout(timer)
                resolve()
              }
            }
          )
        } catch {
          if (!finished) {
            finished = true
            clearTimeout(timer)
            resolve()
          }
        }
      })
    } catch {
      /* ignore */
    }
  }

  // 2. DOM CustomEvent to extension content script
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('talvyn:auth-logout'))
    }
  } catch {
    /* ignore */
  }

  // 3. PostMessage broadcast to extension content script
  try {
    if (typeof window !== 'undefined') {
      window.postMessage({ type: 'TALVYN_DISCONNECT_EXTENSION' }, '*')
    }
  } catch {
    /* ignore */
  }

  // 4. Clear locally cached extension id
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('talvyn_connected_extension_id')
    }
  } catch {
    /* ignore */
  }
}
