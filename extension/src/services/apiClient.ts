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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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

    if (response.status === 401) {
      try {
        const { clearAuth } = await import('../utils/storage')
        await clearAuth()
      } catch {
        /* storage clear */
      }
    }

    throw new ApiError(
      response.status,
      body,
      (body['error'] as string) || `HTTP ${response.status}`
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
