import { Router, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { storageService } from '../services/storageService'

const router = Router()
router.use(authenticate)

// Multer in-memory storage for avatar upload
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true)
    } else {
      cb(new Error('Invalid image format. Allowed formats: PNG, JPG, JPEG, WEBP.'))
    }
  },
})

const profileSchema = z.object({
  legalFullName: z.string().optional().nullable(),
  givenName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  familyName: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  preferredName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  preferredRoles: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().int().min(0).optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  githubUrl: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  otherLinks: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  institution: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  cgpa: z.string().optional().nullable(),
  graduationYear: z.number().int().optional().nullable(),
  workAuthorization: z.string().optional().nullable(),
  expectedSalary: z.string().optional().nullable(),
  noticePeriod: z.string().optional().nullable(),
  preferredLocations: z.array(z.string()).optional(),
  preferredJobTypes: z.array(z.string()).optional(),
  workStyle: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'ANY']).optional(),
  onboardingCompleted: z.boolean().optional(),
})

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [profile, user] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId: req.userId },
      }),
      prisma.user.findUnique({
        where: { id: req.userId },
        select: { avatarUrl: true, email: true },
      }),
    ])

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const deserialized = deserializeProfile(profile)
    res.json({
      ...deserialized,
      avatarUrl: user?.avatarUrl || null,
      email: deserialized.email || user?.email || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PUT /api/profile
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    const data = parsed.data
    const serialized: Record<string, unknown> = { ...data }

    // Serialize JSON arrays to strings for SQLite
    if (data.preferredRoles !== undefined) serialized.preferredRoles = JSON.stringify(data.preferredRoles)
    if (data.skills !== undefined) serialized.skills = JSON.stringify(data.skills)
    if (data.otherLinks !== undefined) serialized.otherLinks = JSON.stringify(data.otherLinks)
    if (data.preferredLocations !== undefined) serialized.preferredLocations = JSON.stringify(data.preferredLocations)
    if (data.preferredJobTypes !== undefined) serialized.preferredJobTypes = JSON.stringify(data.preferredJobTypes)
    if (data.languages !== undefined) serialized.languages = JSON.stringify(data.languages)

    const [profile, user] = await Promise.all([
      prisma.userProfile.upsert({
        where: { userId: req.userId },
        update: serialized,
        create: { userId: req.userId!, ...serialized },
      }),
      prisma.user.findUnique({
        where: { id: req.userId },
        select: { avatarUrl: true, email: true },
      }),
    ])

    const deserialized = deserializeProfile(profile)
    res.json({
      ...deserialized,
      avatarUrl: user?.avatarUrl || null,
      email: deserialized.email || user?.email || null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// POST /api/profile/avatar — Upload & update profile image
router.post('/avatar', (req: AuthRequest, res: Response) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Avatar upload failed' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' })
      return
    }

    try {
      const stored = await storageService.uploadFile(req.file, 'avatars')

      // Update user avatarUrl
      const updatedUser = await prisma.user.update({
        where: { id: req.userId },
        data: { avatarUrl: stored.fileUrl },
        select: { id: true, email: true, avatarUrl: true },
      })

      res.json({
        success: true,
        avatarUrl: updatedUser.avatarUrl,
        message: 'Profile image updated successfully',
      })
    } catch (uploadErr) {
      console.error('[Talvyn] Avatar upload error:', uploadErr)
      res.status(500).json({ error: 'Failed to save avatar image' })
    }
  })
})

// DELETE /api/profile/avatar — Remove profile image
router.delete('/avatar', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (user?.avatarUrl && user.avatarUrl.startsWith('/uploads/avatars/')) {
      const filename = user.avatarUrl.replace('/uploads/avatars/', '')
      await storageService.deleteFile(`avatars/${filename}`)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl: null },
      select: { id: true, email: true, avatarUrl: true },
    })

    res.json({
      success: true,
      avatarUrl: null,
      message: 'Profile image removed successfully',
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete avatar image' })
  }
})

function safeParseArray(val: unknown): string[] {
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

function deserializeProfile(profile: any) {
  return {
    ...profile,
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    preferredRoles: safeParseArray(profile.preferredRoles),
    skills: safeParseArray(profile.skills),
    otherLinks: safeParseArray(profile.otherLinks),
    preferredLocations: safeParseArray(profile.preferredLocations),
    preferredJobTypes: safeParseArray(profile.preferredJobTypes),
    languages: safeParseArray(profile.languages),
  }
}

export default router
