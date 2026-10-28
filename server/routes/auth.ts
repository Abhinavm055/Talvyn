import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { authenticate, AuthRequest, requireWebsiteSession } from '../middleware/auth'
import { googleAuthService } from '../services/googleAuthService'
import { clearWebSession, setWebSession } from '../services/webSession'
import { createRateLimiter, isTrustedExtensionId, proofChallenge, requireExtensionTransport, requireWebsiteOrigin } from '../middleware/security'

const router = Router()
router.use(createRateLimiter(240, 5 * 60 * 1000))
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
const signInLimiter = createRateLimiter(20, 15 * 60 * 1000)

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  givenName: z.string().min(1, 'First name is required').optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential/token is required'),
})

export const EXTENSION_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const EXTENSION_ACCESS_TOKEN_TTL = '15m'
export const EXTENSION_REFRESH_TOKEN_TTL = '30d'
const extensionRefreshSchema = z.object({ refreshToken: z.string().min(32).max(4096) })

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashesMatch(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false
  const left = Buffer.from(expected, 'hex')
  const right = Buffer.from(actual, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function signExtensionAccessToken(userId: string, sessionId: string, authVersion: number): string {
  return jwt.sign(
    { userId, sessionId, authVersion, tokenUse: 'extension_access' },
    config.jwtSecret,
    { expiresIn: EXTENSION_ACCESS_TOKEN_TTL }
  )
}

export function signExtensionRefreshToken(sessionId: string): string {
  return jwt.sign(
    { sessionId, tokenUse: 'extension_refresh', nonce: randomUUID() },
    config.jwtRefreshSecret,
    { expiresIn: EXTENSION_REFRESH_TOKEN_TTL }
  )
}

function extensionSessionResponse(user: any, sessionId: string, refreshToken: string) {
  return {
    sessionId,
    accessToken: signExtensionAccessToken(user.id, sessionId, user.authVersion),
    refreshToken,
    expiresIn: 15 * 60,
    user: {
      id: user.id,
      email: user.email,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
      profile: formatUserProfile(user.profile),
    },
  }
}

export function formatUserProfile(profile: any) {
  if (!profile) return null

  const parseArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed || trimmed === '[]' || trimmed === '{}') return []
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed
      } catch {
        if (trimmed.includes(',')) {
          return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
        }
        return [trimmed]
      }
    }
    return []
  }

  return {
    ...profile,
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    preferredRoles: parseArray(profile.preferredRoles),
    skills: parseArray(profile.skills),
    otherLinks: parseArray(profile.otherLinks),
    preferredLocations: parseArray(profile.preferredLocations),
    preferredJobTypes: parseArray(profile.preferredJobTypes),
    languages: parseArray(profile.languages),
  }
}

// POST /api/auth/register
router.post('/register', requireWebsiteOrigin, signInLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    const { email, password, givenName } = parsed.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Email already in use' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        authProvider: 'EMAIL',
        profile: {
          create: {
            email,
            givenName: givenName || null,
            preferredRoles: '[]',
            skills: '[]',
            otherLinks: '[]',
            preferredLocations: '[]',
            preferredJobTypes: '[]',
          },
        },
      },
      include: { profile: true },
    })

    setWebSession(res, user.id, user.authVersion)
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        profile: formatUserProfile(user.profile),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', requireWebsiteOrigin, signInLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid credentials format' })
      return
    }

    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    })

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    // Google user without local password
    if (!user.passwordHash) {
      res.status(400).json({
        error: 'This account was created with Google Sign-In. Please click "Continue with Google" to sign in.',
        authProvider: user.authProvider,
      })
      return
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    setWebSession(res, user.id, user.authVersion)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        profile: formatUserProfile(user.profile),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/google
router.post('/google', requireWebsiteOrigin, signInLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = googleAuthSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Google credential/token is required' })
      return
    }

    const { credential } = parsed.data

    // 1. Verify Google identity token cryptographically
    const verifiedGoogleUser = await googleAuthService.verifyGoogleToken(credential)

    // 2. Find or create Talvyn user with safe account linking
    const { user, isNewUser } = await googleAuthService.authenticateGoogleUser(verifiedGoogleUser)

    // 3. Set the website session without returning credentials to JavaScript.
    setWebSession(res, user.id, user.authVersion)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        profile: formatUserProfile(user.profile),
      },
      isNewUser,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google authentication failed'
    console.error('[Talvyn Auth] Google login error:', message)
    res.status(400).json({ error: message })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        authProvider: true,
        avatarUrl: true,
        authVersion: true,
        profile: true,
      },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({
      id: user.id,
      email: user.email,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
      profile: formatUserProfile(user.profile),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

router.post('/logout', requireWebsiteOrigin, (_req, res) => {
  clearWebSession(res)
  res.json({ success: true })
})

// The old website-mediated credential response is intentionally retired.
router.post('/extension-sessions', authenticate, (_req, res) => {
  res.status(410).json({ error: 'Use the extension approval flow to connect securely.' })
})

export const PAIRING_TTL_MS = 5 * 60 * 1000
const pairingStartSchema = z.object({ extensionId: z.string().regex(/^[a-p]{32}$/), challenge: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
const pairingExchangeSchema = z.object({ requestId: z.string().uuid(), verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/) }).strict()
const pairingApprovalSchema = z.object({ keepConnected: z.literal(true), expectedUserId: z.string().min(1).max(128) }).strict()

export function isPairingAvailable(pairing: { expiresAt: Date; consumedAt: Date | null }, now = new Date()): boolean {
  return !pairing.consumedAt && pairing.expiresAt > now
}

router.post('/extension-pairing/start', requireExtensionTransport, async (req: Request, res: Response) => {
  const parsed = pairingStartSchema.safeParse(req.body)
  if (!parsed.success || !isTrustedExtensionId(parsed.data.extensionId)) {
    res.status(400).json({ error: 'Configure the published or development extension ID before connecting.' })
    return
  }
  if (req.headers.origin && req.headers.origin !== `chrome-extension://${parsed.data.extensionId}`) {
    res.status(403).json({ error: 'Extension origin does not match this request.' })
    return
  }
  try {
    const requestId = randomUUID()
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS)
    await prisma.extensionPairing.create({ data: { id: requestId, ...parsed.data, expiresAt } })
    res.status(201).json({ requestId, expiresAt: expiresAt.toISOString() })
  } catch {
    res.status(503).json({ error: 'Connection approval is temporarily unavailable. Please retry.' })
  }
})

router.get('/extension-pairing/:requestId', authenticate, requireWebsiteSession, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.requestId)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid connection request.' }); return }
  try {
    const pairing = await prisma.extensionPairing.findUnique({ where: { id: parsed.data } })
    if (!pairing || !isPairingAvailable(pairing) || (pairing.userId && pairing.userId !== req.userId) || !isTrustedExtensionId(pairing.extensionId)) {
      res.status(404).json({ error: 'Connection request expired or unavailable. Start again from the extension.' })
      return
    }
    res.json({ requestId: pairing.id, extensionId: pairing.extensionId, expiresAt: pairing.expiresAt.toISOString(), approved: Boolean(pairing.approvedAt) })
  } catch { res.status(503).json({ error: 'Connection approval is temporarily unavailable.' }) }
})

router.post('/extension-pairing/:requestId/approve', requireWebsiteOrigin, authenticate, requireWebsiteSession, async (req: AuthRequest, res: Response) => {
  const requestId = z.string().uuid().safeParse(req.params.requestId)
  const approval = pairingApprovalSchema.safeParse(req.body)
  if (!requestId.success || !approval.success || !req.userId) {
    res.status(400).json({ error: 'Explicit independent-session consent and a valid request are required.' })
    return
  }
  if (approval.data.expectedUserId !== req.userId) {
    res.status(409).json({ error: 'The signed-in account changed. Review the account and try again.' })
    return
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { authVersion: true } })
    if (!user) { res.status(401).json({ error: 'Sign in again to approve the connection.' }); return }
    const approved = await prisma.extensionPairing.updateMany({
      where: { id: requestId.data, extensionId: { in: config.extensionIds }, expiresAt: { gt: new Date() }, consumedAt: null, OR: [{ userId: null }, { userId: req.userId }] },
      data: { userId: req.userId, approvedAt: new Date(), approvedAuthVersion: user.authVersion },
    })
    if (approved.count !== 1) { res.status(409).json({ error: 'Connection request expired or changed. Start again.' }); return }
    res.json({ success: true, requestId: requestId.data })
  } catch { res.status(503).json({ error: 'Could not approve this connection. Please retry.' }) }
})

router.post('/extension-pairing/exchange', requireExtensionTransport, async (req: Request, res: Response) => {
  const parsed = pairingExchangeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid connection proof.' }); return }
  try {
    const pairing = await prisma.extensionPairing.findUnique({
      where: { id: parsed.data.requestId },
      include: { user: { select: { id: true, email: true, authProvider: true, avatarUrl: true, authVersion: true, profile: true } } },
    })
    if (!pairing || !isPairingAvailable(pairing) || !isTrustedExtensionId(pairing.extensionId) || !hashesMatch(pairing.challenge, proofChallenge(parsed.data.verifier))) {
      res.status(401).json({ error: 'Connection proof expired or invalid. Start again.' })
      return
    }
    if (req.headers.origin && req.headers.origin !== `chrome-extension://${pairing.extensionId}`) {
      res.status(403).json({ error: 'Extension origin does not match this request.' })
      return
    }
    if (!pairing.approvedAt || !pairing.user) { res.status(202).json({ pending: true }); return }
    if (pairing.user.authVersion !== pairing.approvedAuthVersion) {
      res.status(401).json({ error: 'Account sessions changed. Start a new connection.' })
      return
    }
    const sessionId = randomUUID()
    const refreshToken = signExtensionRefreshToken(sessionId)
    const issued = await prisma.$transaction(async (tx) => {
      const consumed = await tx.extensionPairing.updateMany({
        where: { id: pairing.id, consumedAt: null, expiresAt: { gt: new Date() }, approvedAuthVersion: pairing.user!.authVersion },
        data: { consumedAt: new Date() },
      })
      if (consumed.count !== 1) return false
      const currentUser = await tx.user.findUnique({ where: { id: pairing.user!.id }, select: { authVersion: true } })
      if (!currentUser || currentUser.authVersion !== pairing.approvedAuthVersion) return false
      await tx.extensionSession.create({ data: { id: sessionId, userId: pairing.user!.id, authVersion: pairing.user!.authVersion, refreshTokenHash: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + EXTENSION_REFRESH_TOKEN_TTL_MS) } })
      return true
    })
    if (!issued) { res.status(409).json({ error: 'This approval was already used or revoked. Start again.' }); return }
    res.status(201).json(extensionSessionResponse(pairing.user, sessionId, refreshToken))
  } catch { res.status(503).json({ error: 'Could not complete the connection. Please retry.' }) }
})

// POST /api/auth/extension-sessions/refresh
// Rotates the refresh token on every use. A previously rotated token revokes
// the session, preventing refresh-token replay from keeping an attacker signed in.
router.post('/extension-sessions/refresh', requireExtensionTransport, async (req: Request, res: Response) => {
  const parsed = extensionRefreshSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'A valid extension refresh token is required' })
    return
  }

  let claims: jwt.JwtPayload
  try {
    const verified = jwt.verify(parsed.data.refreshToken, config.jwtRefreshSecret)
    if (typeof verified === 'string' || verified.tokenUse !== 'extension_refresh' || typeof verified.sessionId !== 'string') {
      res.status(401).json({ error: 'Extension session is invalid. Reconnect the extension.' })
      return
    }
    claims = verified
  } catch {
    res.status(401).json({ error: 'Extension session expired. Reconnect the extension.' })
    return
  }

  try {
    const session = await prisma.extensionSession.findUnique({
      where: { id: claims.sessionId as string },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            authProvider: true,
            avatarUrl: true,
            authVersion: true,
            profile: true,
          },
        },
      },
    })
    const now = new Date()
    if (!session || session.revokedAt || session.expiresAt <= now || session.authVersion !== session.user.authVersion) {
      res.status(401).json({ error: 'Extension session expired. Reconnect the extension.' })
      return
    }

    const oldHash = hashRefreshToken(parsed.data.refreshToken)
    if (!hashesMatch(session.refreshTokenHash, oldHash)) {
      await prisma.extensionSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      })
      res.status(401).json({ error: 'A reused refresh token was detected. Reconnect the extension.' })
      return
    }

    const nextRefreshToken = signExtensionRefreshToken(session.id)
    const rotation = await prisma.extensionSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + EXTENSION_REFRESH_TOKEN_TTL_MS),
        lastUsedAt: now,
      },
    })

    if (rotation.count !== 1) {
      await prisma.extensionSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      })
      res.status(401).json({ error: 'Extension session changed during refresh. Reconnect the extension.' })
      return
    }

    res.json(extensionSessionResponse(session.user, session.id, nextRefreshToken))
  } catch (err) {
    console.error('[Talvyn Auth] Extension session refresh failed:', err)
    res.status(500).json({ error: 'Could not refresh the extension session' })
  }
})

// POST /api/auth/extension-sessions/revoke
// The extension can revoke its own session. The website may revoke a specific
// session it just created if extension messaging fails during the connection flow.
router.post('/extension-sessions/revoke', authenticate, async (req: AuthRequest, res: Response) => {
  const requestedSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined
  const sessionId = req.extensionSessionId || requestedSessionId
  if (!sessionId || (req.extensionSessionId && requestedSessionId && requestedSessionId !== req.extensionSessionId)) {
    res.status(400).json({ error: 'A valid extension session id is required' })
    return
  }

  try {
    await prisma.extensionSession.updateMany({
      where: { id: sessionId, userId: req.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[Talvyn Auth] Extension session revocation failed:', err)
    res.status(500).json({ error: 'Could not disconnect the extension' })
  }
})

// POST /api/auth/signout-all
// Invalidates web JWTs and every extension refresh session for the account.
router.post('/signout-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId },
        data: { authVersion: { increment: 1 } },
      })
      await tx.extensionSession.updateMany({
        where: { userId: req.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await tx.extensionPairing.updateMany({
        where: { userId: req.userId, consumedAt: null },
        data: { consumedAt: new Date() },
      })
    })
    clearWebSession(res)
    res.json({ success: true })
  } catch (err) {
    console.error('[Talvyn Auth] Global sign-out failed:', err)
    res.status(500).json({ error: 'Could not sign out of all devices' })
  }
})

// GET /api/auth/config
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleConfigured: googleAuthService.isConfigured(),
  })
})

export default router

