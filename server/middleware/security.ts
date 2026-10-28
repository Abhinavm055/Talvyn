import { createHash } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { config } from '../config'

export function trustedWebsiteOrigins(): Set<string> {
  const configured = [config.clientUrl, config.googleAllowedOrigin, 'https://talvyn.vercel.app']
    .flatMap((value) => value.split(','))
  if (config.nodeEnv !== 'production') configured.push('http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173')
  const origins = new Set<string>()
  for (const value of configured) {
    try {
      const url = new URL(value.trim())
      if (config.nodeEnv === 'production' && url.protocol !== 'https:') continue
      origins.add(url.origin)
    } catch { /* Ignore empty or invalid optional configuration. */ }
  }
  return origins
}

export function isTrustedExtensionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-p]{32}$/.test(value) && config.extensionIds.includes(value)
}

export function isTrustedExtensionOrigin(origin: string): boolean {
  const match = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin)
  return Boolean(match && isTrustedExtensionId(match[1]))
}

export function requireWebsiteOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.origin || !trustedWebsiteOrigins().has(req.headers.origin)) {
    res.status(403).json({ error: 'This action must be requested from the configured Talvyn website.' })
    return
  }
  next()
}

// Credential responses belong only to extension fetches. Website scripts use
// an approval endpoint that never returns an access or refresh token.
export function requireExtensionTransport(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin
  if (origin && !isTrustedExtensionOrigin(origin)) {
    res.status(403).json({ error: 'This endpoint is available only to the configured extension.' })
    return
  }
  next()
}

export function proofChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('hex')
}

export function createRateLimiter(limit: number, windowMs: number) {
  const requests = new Map<string, { count: number; resetAt: number }>()
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    if (requests.size >= 10000) {
      for (const [address, entry] of requests) if (entry.resetAt <= now) requests.delete(address)
      if (requests.size >= 10000 && !requests.has(key)) {
        res.status(429).json({ error: 'Too many authentication requests. Please try again shortly.' })
        return
      }
    }
    let entry = requests.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      requests.set(key, entry)
    }
    entry.count += 1
    if (entry.count > limit) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetAt - now) / 1000)))
      res.status(429).json({ error: 'Too many authentication requests. Please try again shortly.' })
      return
    }
    next()
  }
}
