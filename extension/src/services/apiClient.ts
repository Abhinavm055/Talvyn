import { CONFIG } from '../utils/config'
import { getToken } from '../utils/storage'

/**
 * Base HTTP client for the Talvyn API.
 * Automatically attaches the Bearer token from extension storage.
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
 * Checks if the current execution context is a content script running on a web page.
 * Content scripts run on third-party page origins (e.g. in.indeed.com) and must route
 * API requests through the background service worker to avoid browser CORS blocks.
 */
function isContentScript(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    window.location?.protocol !== 'chrome-extension:' &&
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
    try {
      chrome.runtime.sendMessage(
        {
          type: 'TALVYN_API_REQUEST',
          path,
          method: options.method || 'GET',
          body: options.body,
          headers: options.headers as Record<string, string>,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            return reject(
              new Error(
                chrome.runtime.lastError.message ||
                  "Couldn't communicate with Talvyn background worker"
              )
            )
          }

          if (!response) {
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
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // If running in a content script on a webpage, route via background worker to bypass CORS
  if (isContentScript()) {
    return requestViaBackground<T>(path, options)
  }

  // If running in background worker or popup (extension origin), direct fetch is safe
  const token = await getToken()
  const url = `${CONFIG.API_BASE}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    let body: Record<string, unknown> = {}
    try {
      body = await response.json()
    } catch {
      /* non-JSON error body */
    }

    if (response.status === 401 || response.status === 403) {
      try {
        const { clearAuth } = await import('../utils/storage')
        await clearAuth()
      } catch {
        /* storage clear */
      }
    }

    const defaultMsg =
      response.status === 401 || response.status === 403
        ? 'Your Talvyn session has expired. Reconnect your account.'
        : "Couldn't save this job. Please try again."

    throw new ApiError(
      response.status,
      body,
      (body['error'] as string) || defaultMsg
    )
  }

  // 204 No Content
  if (response.status === 204) return undefined as unknown as T

  return response.json() as Promise<T>
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

