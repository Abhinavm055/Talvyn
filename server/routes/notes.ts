import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router({ mergeParams: true })
router.use(authenticate)

const noteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
})

// GET /api/jobs/:jobId/notes
router.get('/jobs/:jobId/notes', async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string
    const job = await prisma.job.findFirst({ where: { id: jobId, userId: req.userId } })
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const notes = await prisma.note.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(notes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' })
  }
})

// POST /api/jobs/:jobId/notes
router.post('/jobs/:jobId/notes', async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string
    const job = await prisma.job.findFirst({ where: { id: jobId, userId: req.userId } })
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const parsed = noteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    const note = await prisma.note.create({
      data: {
        content: parsed.data.content,
        jobId,
        userId: req.userId!,
      },
    })
    res.status(201).json(note)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' })
  }
})

// PUT /api/notes/:id
router.put('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.note.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Note not found' })
      return
    }

    const parsed = noteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed' })
      return
    }

    const note = await prisma.note.update({
      where: { id },
      data: { content: parsed.data.content },
    })
    res.json(note)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' })
  }
})

// DELETE /api/notes/:id
router.delete('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.note.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Note not found' })
      return
    }
    await prisma.note.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' })
  }
})

export default router
