import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

type JobStatus = 'SAVED' | 'INTERESTED' | 'IN_PROGRESS' | 'APPLIED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'
type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' | 'TEMPORARY' | 'GRADUATE_PROGRAM' | 'FELLOWSHIP' | 'COMPETITION' | 'TALENT_OPPORTUNITY' | 'OTHER'

const router = Router()
router.use(authenticate)

const JOB_STATUSES = ['SAVED','INTERESTED','IN_PROGRESS','APPLIED','ASSESSMENT','INTERVIEW','OFFER','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'] as const
const JOB_TYPES = ['JOB','FULL_TIME','PART_TIME','CONTRACT','FREELANCE','INTERNSHIP','TEMPORARY','GRADUATE_PROGRAM','FELLOWSHIP','COMPETITION','TALENT_OPPORTUNITY','OTHER'] as const

const jobSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company name is required').default('Unknown Company'),
  jobUrl: z.string().optional().nullable(),
  sourceWebsite: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  jobType: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(JOB_STATUSES).optional().nullable(),
  dateSaved: z.string().optional().nullable(),
  dateApplied: z.string().optional().nullable(),
})

const statusSchema = z.object({
  status: z.enum(JOB_STATUSES),
})

// GET /api/jobs/check-url?url=<encoded_url>  — duplicate detection for the extension
router.get('/check-url', async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query as { url?: string }
    if (!url) {
      res.status(400).json({ error: 'url query parameter is required' })
      return
    }
    const job = await prisma.job.findFirst({
      where: { userId: req.userId, jobUrl: url },
      select: { id: true, title: true, company: true, status: true },
    })
    res.json({ exists: !!job, job: job || null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to check URL' })
  }
})

// GET /api/jobs
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query as Record<string, string>

    const where: Record<string, unknown> = { userId: req.userId }
    if (status && status !== 'ALL') where.status = status as JobStatus
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { location: { contains: search } },
      ]
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: {
          notes: { orderBy: { createdAt: 'desc' }, take: 3 },
          _count: { select: { notes: true } },
        },
      }),
      prisma.job.count({ where }),
    ])

    res.json({ jobs, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
})

// POST /api/jobs
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = jobSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const firstError =
        Object.entries(fieldErrors)
          .map(([field, errs]) => `${field}: ${(errs || []).join(', ')}`)
          .join('; ') || 'Invalid job data'
      res.status(422).json({ success: false, error: firstError, details: parsed.error.flatten() })
      return
    }

    // Check duplicate by URL if jobUrl is provided
    if (parsed.data.jobUrl) {
      const existing = await prisma.job.findFirst({
        where: { userId: req.userId, jobUrl: parsed.data.jobUrl },
      })
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'This job is already saved',
          job: existing,
          id: existing.id,
        })
        return
      }
    }

    const job = await prisma.job.create({
      data: {
        title: parsed.data.title,
        company: parsed.data.company || 'Unknown Company',
        jobUrl: parsed.data.jobUrl || null,
        sourceWebsite: parsed.data.sourceWebsite || null,
        location: parsed.data.location || null,
        jobType: parsed.data.jobType || 'FULL_TIME',
        salary: parsed.data.salary || null,
        description: parsed.data.description || null,
        status: (parsed.data.status as JobStatus) || 'SAVED',
        dateApplied: parsed.data.dateApplied ? new Date(parsed.data.dateApplied) : null,
        userId: req.userId!,
      },
    })
    res.status(201).json({ success: true, ...job, job, id: job.id })
  } catch (err) {
    console.error('[Talvyn] Failed to create job:', err)
    res.status(500).json({ success: false, error: "Talvyn couldn't save this job. Try again." })
  }
})

// GET /api/jobs/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const job = await prisma.job.findFirst({
      where: { id, userId: req.userId },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        _count: { select: { notes: true } },
      },
    })
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' })
  }
})

// PUT /api/jobs/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.job.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const parsed = jobSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        ...parsed.data,
        jobUrl: parsed.data.jobUrl || null,
        dateApplied: parsed.data.dateApplied ? new Date(parsed.data.dateApplied) : parsed.data.dateApplied === null ? null : undefined,
      },
    })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job' })
  }
})

// PATCH /api/jobs/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.job.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const updateData: Record<string, unknown> = { status: parsed.data.status }
    if (parsed.data.status === 'APPLIED' && !existing.dateApplied) {
      updateData.dateApplied = new Date()
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
    })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' })
  }
})

// POST /api/jobs/track-applied — Phase 2D: auto-tracks or updates job when application submission succeeds
router.post('/track-applied', async (req: AuthRequest, res: Response) => {
  try {
    const { title, company, jobUrl, sourceWebsite, location, jobType, salary, description, confidence, detectionMethod } = req.body

    if (!title || !company) {
      res.status(400).json({ error: 'title and company are required' })
      return
    }

    // 1. Check if job exists by jobUrl
    let existing = null
    if (jobUrl) {
      existing = await prisma.job.findFirst({
        where: { userId: req.userId, jobUrl },
      })
    }

    // 2. Check if job exists by title + company
    if (!existing) {
      existing = await prisma.job.findFirst({
        where: {
          userId: req.userId,
          title: { equals: title.trim() },
          company: { equals: company.trim() },
        },
      })
    }

    const now = new Date()

    if (existing) {
      const previousStatus = existing.status
      const updated = await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: 'APPLIED',
          dateApplied: existing.dateApplied || now,
          location: existing.location || location,
          salary: existing.salary || salary,
          jobUrl: existing.jobUrl || jobUrl || null,
        },
      })

      // Add audit note for history tracking
      await prisma.note.create({
        data: {
          jobId: updated.id,
          userId: req.userId!,
          content: `[Talvyn Tracking] Application submitted automatically detected (${confidence || 95}% confidence via ${detectionMethod || 'Page confirmation'}).`,
        },
      })

      res.json({
        job: updated,
        isNew: false,
        previousStatus,
        message: 'Existing job updated to Applied',
      })
      return
    }

    // 3. Create new job record as APPLIED
    const created = await prisma.job.create({
      data: {
        userId: req.userId!,
        title: title.trim(),
        company: company.trim(),
        jobUrl: jobUrl || null,
        sourceWebsite: sourceWebsite || (jobUrl ? new URL(jobUrl).hostname : 'Direct Application'),
        location: location || null,
        jobType: jobType || null,
        salary: salary || null,
        description: description || null,
        status: 'APPLIED',
        dateApplied: now,
      },
    })

    // Add note
    await prisma.note.create({
      data: {
        jobId: created.id,
        userId: req.userId!,
        content: `[Talvyn Tracking] Application submitted automatically detected (${confidence || 95}% confidence via ${detectionMethod || 'Page confirmation'}).`,
      },
    })

    res.status(201).json({
      job: created,
      isNew: true,
      previousStatus: null,
      message: 'New application tracked as Applied',
    })
  } catch (err) {
    console.error('[Talvyn] Failed to track applied job:', err)
    res.status(500).json({ error: 'Failed to track applied job' })
  }
})

// POST /api/jobs/:id/undo-applied — Phase 2D: undoes automatic status update
router.post('/:id/undo-applied', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { previousStatus, isNew } = req.body

    const existing = await prisma.job.findFirst({
      where: { id, userId: req.userId },
    })

    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    if (isNew) {
      // If the job was created solely by auto-tracking, delete it or set to SAVED
      await prisma.job.delete({ where: { id } })
      res.json({ success: true, deleted: true, message: 'Tracked job removed' })
      return
    }

    // Revert status to previous status
    const targetStatus = previousStatus && JOB_STATUSES.includes(previousStatus) ? previousStatus : 'SAVED'
    const reverted = await prisma.job.update({
      where: { id },
      data: {
        status: targetStatus,
        dateApplied: targetStatus === 'APPLIED' ? existing.dateApplied : null,
      },
    })

    await prisma.note.create({
      data: {
        jobId: reverted.id,
        userId: req.userId!,
        content: `[Talvyn Tracking] Status reverted to ${targetStatus} via Undo action.`,
      },
    })

    res.json({ success: true, job: reverted, message: `Status reverted to ${targetStatus}` })
  } catch (err) {
    console.error('[Talvyn] Failed to undo applied status:', err)
    res.status(500).json({ error: 'Failed to undo status' })
  }
})

// POST /api/jobs/:id/application/start — Phase 2F: Application Started Tracking
router.post('/:id/application/start', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.job.findFirst({
      where: { id, userId: req.userId },
      include: { notes: true },
    })

    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    // Only transition status if currently SAVED or INTERESTED
    let updatedJob = existing
    if (existing.status === 'SAVED' || existing.status === 'INTERESTED') {
      updatedJob = await prisma.job.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: { notes: true },
      })
    }

    // Prevent duplicate APPLICATION_STARTED timeline notes
    const hasStartedNote = existing.notes.some((n) =>
      n.content.includes('[Timeline: APPLICATION_STARTED]')
    )

    if (!hasStartedNote) {
      await prisma.note.create({
        data: {
          jobId: id,
          userId: req.userId!,
          content: `[Timeline: APPLICATION_STARTED] Application started via Talvyn Assistant`,
        },
      })
    }

    res.json({
      success: true,
      job: updatedJob,
      message: 'Application marked as IN_PROGRESS',
    })
  } catch (err) {
    console.error('[Talvyn] Failed to start application tracking:', err)
    res.status(500).json({ error: 'Failed to start application tracking' })
  }
})

// POST /api/jobs/:id/application/progress — Phase 2F: Progress Update
router.post('/:id/application/progress', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { percentage, filledFields, totalFields } = req.body

    const existing = await prisma.job.findFirst({
      where: { id, userId: req.userId },
    })

    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    res.json({
      success: true,
      progress: { percentage, filledFields, totalFields },
      message: 'Progress recorded',
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to record progress' })
  }
})

// DELETE /api/jobs/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.job.findFirst({ where: { id, userId: req.userId } })
    if (!existing) {
      res.status(404).json({ error: 'Job not found' })
      return
    }
    await prisma.job.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job' })
  }
})

// GET /api/jobs/:id/timeline — Phase 2E: Get structured application timeline events
router.get('/:id/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const job = await prisma.job.findFirst({
      where: { id, userId: req.userId },
      include: { notes: { orderBy: { createdAt: 'asc' } } },
    })

    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const events = buildJobTimeline(job)
    res.json({ timeline: events })
  } catch (err) {
    console.error('[Talvyn] Failed to fetch timeline:', err)
    res.status(500).json({ error: 'Failed to fetch timeline' })
  }
})

// POST /api/jobs/:id/timeline — Phase 2E: Add milestone event to application timeline
router.post('/:id/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { stage, note, source } = req.body

    const job = await prisma.job.findFirst({
      where: { id, userId: req.userId },
    })

    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    // Create a timeline milestone note
    const milestoneNote = await prisma.note.create({
      data: {
        jobId: job.id,
        userId: req.userId!,
        content: `[Timeline: ${stage}] ${note || ''} ${source ? `(via ${source})` : ''}`.trim(),
      },
    })

    // Optionally transition job status if milestone maps to status
    const statusMap: Record<string, JobStatus> = {
      SAVED: 'SAVED',
      APPLICATION_STARTED: 'IN_PROGRESS',
      APPLIED: 'APPLIED',
      ASSESSMENT: 'ASSESSMENT',
      INTERVIEW: 'INTERVIEW',
      OFFER: 'OFFER',
      ACCEPTED: 'ACCEPTED',
      REJECTED: 'REJECTED',
      WITHDRAWN: 'WITHDRAWN',
    }

    if (stage && statusMap[stage]) {
      const newStatus = statusMap[stage]
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: newStatus,
          dateApplied: newStatus === 'APPLIED' && !job.dateApplied ? new Date() : undefined,
        },
      })
    }

    const updatedJob = await prisma.job.findFirst({
      where: { id, userId: req.userId },
      include: { notes: { orderBy: { createdAt: 'asc' } } },
    })

    res.status(201).json({
      success: true,
      timeline: buildJobTimeline(updatedJob!),
      milestone: milestoneNote,
    })
  } catch (err) {
    console.error('[Talvyn] Failed to add timeline event:', err)
    res.status(500).json({ error: 'Failed to add timeline event' })
  }
})

function buildJobTimeline(job: any) {
  const notes = job.notes || []
  const status = job.status as JobStatus
  const savedDate = job.dateSaved ? new Date(job.dateSaved).toISOString() : new Date(job.createdAt).toISOString()
  const appliedDate = job.dateApplied ? new Date(job.dateApplied).toISOString() : null

  // Status rank for sequential completion
  const STATUS_RANKS: Record<string, number> = {
    SAVED: 1,
    INTERESTED: 1,
    IN_PROGRESS: 2,
    APPLIED: 3,
    ASSESSMENT: 4,
    INTERVIEW: 5,
    OFFER: 6,
    ACCEPTED: 7,
    REJECTED: 7,
    WITHDRAWN: 7,
  }

  const currentRank = STATUS_RANKS[status] || 1

  // Extract explicit timeline milestone notes
  const milestoneMap = new Map<string, { timestamp: string; note: string }>()
  for (const n of notes) {
    const match = n.content.match(/^\[Timeline:\s*([^\]]+)\]\s*(.*)$/i)
    if (match) {
      const st = match[1].toUpperCase().trim()
      milestoneMap.set(st, {
        timestamp: new Date(n.createdAt).toISOString(),
        note: match[2],
      })
    }
  }

  const events = [
    {
      id: `${job.id}-saved`,
      jobId: job.id,
      stage: 'SAVED',
      title: 'Opportunity Saved',
      timestamp: milestoneMap.get('SAVED')?.timestamp || savedDate,
      note: milestoneMap.get('SAVED')?.note || 'Saved to Talvyn dashboard',
      completed: true,
    },
    {
      id: `${job.id}-started`,
      jobId: job.id,
      stage: 'APPLICATION_STARTED',
      title: 'Application Started',
      timestamp: milestoneMap.get('APPLICATION_STARTED')?.timestamp || (currentRank >= 2 ? savedDate : ''),
      note: milestoneMap.get('APPLICATION_STARTED')?.note || (currentRank >= 2 ? 'Application in progress' : undefined),
      completed: currentRank >= 2 || milestoneMap.has('APPLICATION_STARTED'),
    },
    {
      id: `${job.id}-applied`,
      jobId: job.id,
      stage: 'APPLIED',
      title: 'Application Submitted',
      timestamp: appliedDate || milestoneMap.get('APPLIED')?.timestamp || '',
      note: milestoneMap.get('APPLIED')?.note || (appliedDate ? 'Successfully applied' : undefined),
      completed: currentRank >= 3 || !!appliedDate || milestoneMap.has('APPLIED'),
    },
    {
      id: `${job.id}-assessment`,
      jobId: job.id,
      stage: 'ASSESSMENT',
      title: 'Assessment / Coding Challenge',
      timestamp: milestoneMap.get('ASSESSMENT')?.timestamp || (currentRank >= 4 ? new Date(job.updatedAt).toISOString() : ''),
      note: milestoneMap.get('ASSESSMENT')?.note || undefined,
      completed: currentRank >= 4 || milestoneMap.has('ASSESSMENT'),
    },
    {
      id: `${job.id}-interview`,
      jobId: job.id,
      stage: 'INTERVIEW',
      title: 'Interview Stage',
      timestamp: milestoneMap.get('INTERVIEW')?.timestamp || (currentRank >= 5 ? new Date(job.updatedAt).toISOString() : ''),
      note: milestoneMap.get('INTERVIEW')?.note || undefined,
      completed: currentRank >= 5 || milestoneMap.has('INTERVIEW'),
    },
    {
      id: `${job.id}-offer`,
      jobId: job.id,
      stage: 'OFFER',
      title: 'Offer Received',
      timestamp: milestoneMap.get('OFFER')?.timestamp || (currentRank >= 6 ? new Date(job.updatedAt).toISOString() : ''),
      note: milestoneMap.get('OFFER')?.note || undefined,
      completed: currentRank >= 6 || milestoneMap.has('OFFER'),
    },
  ]

  // Add terminal state if rejected / withdrawn / accepted
  if (status === 'REJECTED' || milestoneMap.has('REJECTED')) {
    events.push({
      id: `${job.id}-rejected`,
      jobId: job.id,
      stage: 'REJECTED',
      title: 'Application Rejected',
      timestamp: milestoneMap.get('REJECTED')?.timestamp || new Date(job.updatedAt).toISOString(),
      note: milestoneMap.get('REJECTED')?.note || undefined,
      completed: true,
    })
  } else if (status === 'WITHDRAWN' || milestoneMap.has('WITHDRAWN')) {
    events.push({
      id: `${job.id}-withdrawn`,
      jobId: job.id,
      stage: 'WITHDRAWN',
      title: 'Application Withdrawn',
      timestamp: milestoneMap.get('WITHDRAWN')?.timestamp || new Date(job.updatedAt).toISOString(),
      note: milestoneMap.get('WITHDRAWN')?.note || undefined,
      completed: true,
    })
  }

  return events
}

export default router


