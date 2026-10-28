import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

export const WEB_SESSION_COOKIE = 'talvyn_web_session'
const cookieOptions = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' as const, path: '/api' }

export function setWebSession(res: Response, userId: string, authVersion: number): void {
  const token = jwt.sign({ userId, authVersion, tokenUse: 'web_session' }, config.jwtSecret, { expiresIn: '7d' })
  res.cookie(WEB_SESSION_COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export function clearWebSession(res: Response): void {
  res.clearCookie(WEB_SESSION_COOKIE, cookieOptions)
}

export function readWebSession(req: Request): string | null {
  const cookies = req.headers.cookie || ''
  if (cookies.length > 16384) return null
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== WEB_SESSION_COOKIE) continue
    try {
      const token = decodeURIComponent(part.slice(separator + 1).trim())
      return token.length <= 4096 ? token : null
    } catch { return null }
  }
  return null
}
