import type { AuthUser } from '../types'
import type { TalvynAuthSession } from '../utils/storage'

export const PAIRING_REQUEST_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export function isExactAllowedOrigin(value: unknown, allowed: readonly string[]): boolean {
  if (typeof value !== 'string' || value.length > 4096) return false
  try { return allowed.includes(new URL(value).origin) } catch { return false }
}

/** Same-API data routes only. Authentication credentials are never proxyable. */
export function isAllowedApiRequest(path: unknown, method: unknown): boolean {
  if (typeof path !== 'string' || path.length > 8192 || typeof method !== 'string') return false
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false
  if (/[\\\r\n#]/.test(path)) return false
  const pathname = path.split('?')[0]
  if (/%2f|%5c|%2e/i.test(pathname)) return false
  if (pathname === '/api/auth/me') return method === 'GET'
  if (pathname === '/api/profile') return ['GET', 'PUT', 'PATCH'].includes(method)
  if (pathname === '/api/resumes') return method === 'GET'
  if (pathname === '/api/jobs') return ['GET', 'POST'].includes(method)
  if (pathname === '/api/jobs/check-url') return method === 'GET'
  if (pathname === '/api/jobs/track-applied') return method === 'POST'
  return /^\/api\/jobs\/[A-Za-z0-9_-]{1,128}\/(status|undo-applied|timeline)$/.test(pathname) &&
    (pathname.endsWith('/timeline') ? ['GET', 'POST'].includes(method)
      : pathname.endsWith('/status') ? method === 'PATCH' : method === 'POST')
}

export function decodeTokenClaims(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  try {
    const pieces = token.split('.')
    if (pieces.length !== 3) return null
    return JSON.parse(atob(pieces[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

/** Claim checks supplement backend /me verification; they are not signature validation. */
export function validateSessionResponse(value: unknown, verifiedUser: AuthUser, now = Date.now()): TalvynAuthSession | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.sessionId !== 'string' || data.sessionId.length > 128 ||
    typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string' ||
    !verifiedUser || typeof verifiedUser.id !== 'string' || typeof verifiedUser.email !== 'string') return null
  const access = decodeTokenClaims(data.accessToken)
  const refresh = decodeTokenClaims(data.refreshToken)
  if (access?.tokenUse !== 'extension_access' || access.sessionId !== data.sessionId ||
    access.userId !== verifiedUser.id || refresh?.tokenUse !== 'extension_refresh' ||
    refresh.sessionId !== data.sessionId || typeof access.exp !== 'number' ||
    !Number.isFinite(access.exp) || access.exp * 1000 <= now) return null
  if (!data.user || typeof data.user !== 'object' || (data.user as Record<string, unknown>).id !== verifiedUser.id) return null
  return {
    token: data.accessToken, refreshToken: data.refreshToken, sessionId: data.sessionId,
    accessExpiresAt: access.exp * 1000, user: verifiedUser, connectedAt: new Date(now).toISOString(),
  }
}

export async function createPairingSecret(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { verifier, challenge }
}
