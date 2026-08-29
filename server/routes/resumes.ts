import { Router, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { storageService } from '../services/storageService'

const router = Router()
router.use(authenticate)

// Multer in-memory storage for resume files
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.pdf', '.doc', '.docx']
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ]

    const originalExt = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
    if (allowedExtensions.includes(originalExt) || allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true)
    } else {
      cb(new Error('Invalid resume format. Only PDF, DOC, and DOCX files are allowed.'))
    }
  },
})

const resumeMetaSchema = z.object({
  name: z.string().min(1, 'Resume name is required'),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  fileUrl: z.string().optional().nullable(),
})

// GET /api/resumes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(resumes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resumes' })
  }
})

// POST /api/resumes/upload — Multipart upload with file
router.post('/upload', (req: AuthRequest, res: Response) => {
  resumeUpload.single('file')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'File upload failed' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'No resume file uploaded' })
      return
    }

    try {
      const name = (req.body.name || req.file.originalname.replace(/\.[^/.]+$/, '')).trim()
      const description = req.body.description ? req.body.description.trim() : null
      const isDefault = req.body.isDefault === 'true' || req.body.isDefault === true

      // If isDefault, unset previous default
      if (isDefault) {
        await prisma.resume.updateMany({
          where: { userId: req.userId },
          data: { isDefault: false },
        })
      }

      // Check if user has zero existing resumes; if so, make first default
      const existingCount = await prisma.resume.count({ where: { userId: req.userId } })
      const shouldBeDefault = isDefault || existingCount === 0

      const stored = await storageService.uploadFile(req.file, 'resumes')

      const resume = await prisma.resume.create({
        data: {
          userId: req.userId!,
          name,
          description,
          isDefault: shouldBeDefault,
          fileUrl: `/api/resumes/${stored.storagePath}`,
          fileName: stored.fileName,
          fileSize: stored.fileSize,
          mimeType: stored.mimeType,
          storagePath: stored.storagePath,
        },
      })

      res.status(201).json(resume)
    } catch (uploadErr) {
      console.error('[Talvyn] Resume upload error:', uploadErr)
      res.status(500).json({ error: 'Failed to process resume file upload' })
    }
  })
})

// POST /api/resumes — Metadata-only creation (backwards compatibility)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = resumeMetaSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    if (parsed.data.isDefault) {
      await prisma.resume.updateMany({
        where: { userId: req.userId },
        data: { isDefault: false },
      })
    }

    const existingCount = await prisma.resume.count({ where: { userId: req.userId } })
    const isDefault = parsed.data.isDefault || existingCount === 0

    const resume = await prisma.resume.create({
      data: {
        userId: req.userId!,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isDefault,
        fileUrl: parsed.data.fileUrl || null,
      },
    })
    res.status(201).json(resume)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create resume' })
  }
})

// GET /api/resumes/:id/file — Secure file download / stream
router.get('/:id/file', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const resume = await prisma.resume.findFirst({
      where: { id, userId: req.userId },
    })

    if (!resume) {
      res.status(404).json({ error: 'Resume not found' })
      return
    }

    if (!resume.storagePath) {
      res.status(404).json({ error: 'No physical file stored for this resume' })
      return
    }

    const fileData = await storageService.getFile(resume.storagePath)
    if (!fileData) {
      res.status(404).json({ error: 'Stored resume file not found on disk' })
      return
    }

    res.setHeader('Content-Type', fileData.mimeType)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(resume.fileName || fileData.fileName)}"`
    )
    fileData.stream.pipe(res)
  } catch (err) {
    console.error('[Talvyn] Failed to retrieve resume file:', err)
    res.status(500).json({ error: 'Failed to retrieve resume file' })
  }
})

// PUT /api/resumes/:id — Update metadata
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.resume.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Resume not found' })
      return
    }

    const parsed = resumeMetaSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    if (parsed.data.isDefault) {
      await prisma.resume.updateMany({
        where: { userId: req.userId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.resume.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
      },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update resume' })
  }
})

// PUT /api/resumes/:id/replace — Replace resume file
router.put('/:id/replace', (req: AuthRequest, res: Response) => {
  resumeUpload.single('file')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'File upload failed' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'No resume file provided for replacement' })
      return
    }

    try {
      const id = req.params.id as string
      const existing = await prisma.resume.findFirst({ where: { id, userId: req.userId } })
      if (!existing) {
        res.status(404).json({ error: 'Resume not found' })
        return
      }

      // Delete old file if present
      if (existing.storagePath) {
        await storageService.deleteFile(existing.storagePath)
      }

      const stored = await storageService.uploadFile(req.file, 'resumes')

      const updated = await prisma.resume.update({
        where: { id },
        data: {
          fileUrl: `/api/resumes/${stored.storagePath}`,
          fileName: stored.fileName,
          fileSize: stored.fileSize,
          mimeType: stored.mimeType,
          storagePath: stored.storagePath,
        },
      })

      res.json(updated)
    } catch (replaceErr) {
      console.error('[Talvyn] Failed to replace resume file:', replaceErr)
      res.status(500).json({ error: 'Failed to replace resume file' })
    }
  })
})

// DELETE /api/resumes/:id — Delete metadata + physical file
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.resume.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Resume not found' })
      return
    }

    // Delete stored file if exists
    if (existing.storagePath) {
      await storageService.deleteFile(existing.storagePath)
    }

    await prisma.resume.delete({ where: { id } })

    // If deleted resume was default, promote next resume to default
    if (existing.isDefault) {
      const nextResume = await prisma.resume.findFirst({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
      })
      if (nextResume) {
        await prisma.resume.update({
          where: { id: nextResume.id },
          data: { isDefault: true },
        })
      }
    }

    res.json({ success: true, message: 'Resume deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete resume' })
  }
})

export default router
