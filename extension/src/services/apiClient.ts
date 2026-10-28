import {
  isExtensionContextValid,
  isExtensionContextInvalidated,
  shutdownExtensionRuntime,
} from '../utils/extensionContext'

/**
 * Base HTTP client for the Talvyn API.
 * Credentials stay in the service worker. This client only sends data requests.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Route all extension UI requests through the service worker. Content scripts need
 * this to avoid page-origin CORS restrictions; the popup uses the same path so the
 * worker can refresh and validate extension credentials before API requests.
 */
function isExtensionUiContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.sendMessage)
  )
}

/**
 * Routes an API request through the background service worker message bridge.
 */
function requestViaBackground<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new ApiError(0, {}, 'Talvyn did not respond in time. Please retry.')), 45_000)
    if (!isExtensionContextValid()) {
      clearTimeout(timeout)
      shutdownExtensionRuntime()
      return reject(
        new ApiError(0, { error: 'Extension context invalidated' }, 'Extension context invalidated')
      )
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: 'TALVYN_API_REQUEST',
          path,
          method: options.method || 'GET',
          body: options.body,
        },
        (response) => {
          clearTimeout(timeout)
          const lastErr = chrome.runtime?.lastError
          if (lastErr) {
            if (isExtensionContextInvalidated(lastErr)) {
              shutdownExtensionRuntime()
              return reject(
                new ApiError(
                  0,
                  { error: 'Extension context invalidated' },
                  'Extension context invalidated'
                )
              )
            }
            return reject(
              new Error(
                lastErr.message ||
                  "Couldn't communicate with Talvyn background worker"
              )
            )
          }

          if (!response) {
            if (!isExtensionContextValid()) {
              shutdownExtensionRuntime()
              return reject(
                new ApiError(
                  0,
                  { error: 'Extension context invalidated' },
                  'Extension context invalidated'
                )
              )
            }
            return reject(
              new Error('No response received from Talvyn background worker')
            )
          }

          if (response.success) {
            resolve(response.data as T)
          } else {
            const status = response.status || 500
            const errMsg =
              response.error ||
              (status === 401 || status === 403
                ? 'Your Talvyn session has expired. Reconnect your account.'
                : "Couldn't save this job. Please try again.")
            reject(
              new ApiError(
                status,
                response.body || { error: errMsg },
                errMsg
              )
            )
          }
        }
      )
    } catch (err) {
      clearTimeout(timeout)
      if (isExtensionContextInvalidated(err)) {
        shutdownExtensionRuntime()
        return reject(
          new ApiError(
            0,
            { error: 'Extension context invalidated' },
            'Extension context invalidated'
          )
        )
      }
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!isExtensionUiContext()) throw new ApiError(0, {}, 'Talvyn API requests require the extension message bridge.')
  return requestViaBackground<T>(path, options)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

