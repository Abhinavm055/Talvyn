import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { authenticate, AuthRequest } from '../middleware/auth'
import { googleAuthService } from '../services/googleAuthService'

const router = Router()

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

function signToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions)
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
router.post('/register', async (req: Request, res: Response) => {
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

    const token = signToken(user.id)
    res.status(201).json({
      token,
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
router.post('/login', async (req: Request, res: Response) => {
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

    const token = signToken(user.id)
    res.json({
      token,
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
router.post('/google', async (req: Request, res: Response) => {
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

    // 3. Issue existing Talvyn JWT
    const token = signToken(user.id)

    res.json({
      token,
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
      include: { profile: true },
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

// GET /api/auth/config
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleConfigured: googleAuthService.isConfigured(),
  })
})

export default router

