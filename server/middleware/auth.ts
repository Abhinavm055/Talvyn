import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'
import { readWebSession } from '../services/webSession'
import { trustedWebsiteOrigins } from './security'

export interface AuthRequest extends Request {
  userId?: string
  extensionSessionId?: string
  authSource?: 'website' | 'extension'
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = bearer || readWebSession(req)
  if (!token) {
    res.status(401).json({ error: 'Sign in to continue' })
    return
  }
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!req.headers.origin || !trustedWebsiteOrigins().has(req.headers.origin))) {
    res.status(403).json({ error: 'Untrusted website origin' })
    return
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    if (typeof payload === 'string' || typeof payload.userId !== 'string' ||
        (bearer ? payload.tokenUse !== 'extension_access' : payload.tokenUse !== 'web_session')) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, authVersion: true },
    })
    if (!user || (payload.authVersion ?? 0) !== user.authVersion) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    if (payload.tokenUse === 'extension_access') {
      if (typeof payload.sessionId !== 'string') {
        res.status(401).json({ error: 'Invalid extension session' })
        return
      }
      const session = await prisma.extensionSession.findUnique({
        where: { id: payload.sessionId },
        select: { userId: true, revokedAt: true, expiresAt: true },
      })
      if (
        !session ||
        session.userId !== user.id ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        res.status(401).json({ error: 'Extension session revoked or expired' })
        return
      }
      req.extensionSessionId = payload.sessionId
    }

    req.userId = payload.userId
    req.authSource = bearer ? 'extension' : 'website'
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireWebsiteSession(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.authSource !== 'website') {
    res.status(403).json({ error: 'Approve this action in your signed-in Talvyn website.' })
    return
  }
  next()
}
