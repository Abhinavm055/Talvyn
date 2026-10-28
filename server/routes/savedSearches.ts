import { Router, type Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { authenticate, requireWebsiteSession, type AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { createSavedSearchSchema, updateSavedSearchSchema, savedSearchDto, savedSearchNameKey, storedJobSearchFilters } from '../services/jobSearchFilters'

const router = Router()
router.use(authenticate, requireWebsiteSession)
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next() })

function respondFailure(error: unknown, res: Response): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'A saved search with this name already exists.' }); return }
    if (error.code === 'P2025') { res.status(404).json({ error: 'Saved search not found.' }); return }
  }
  if (error instanceof ZodError) {
    res.status(503).json({ error: 'A saved search uses unsupported stored criteria. Please contact your deployment operator.' })
    return
  }
  // This handler adds no private-data logging; Prisma/operator logs need review.
  res.status(500).json({ error: 'Could not complete the saved search request. Please try again.' })
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const searches = await prisma.savedSearch.findMany({ where: { userId: req.userId! }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] })
    res.json({ searches: searches.map(savedSearchDto) })
  } catch (error) { respondFailure(error, res) }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createSavedSearchSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid saved search.', details: parsed.error.flatten() }); return }
  try {
    const search = await prisma.savedSearch.create({ data: {
      userId: req.userId!, name: parsed.data.name, nameKey: savedSearchNameKey(parsed.data.name), filters: storedJobSearchFilters(parsed.data.filters),
    } })
    res.status(201).json(savedSearchDto(search))
  } catch (error) { respondFailure(error, res) }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = updateSavedSearchSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid saved search update.', details: parsed.error.flatten() }); return }
  try {
    const search = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.savedSearch.update({
        where: { id: req.params.id as string, userId: req.userId! },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name, nameKey: savedSearchNameKey(parsed.data.name) } : {}),
          ...(parsed.data.filters !== undefined ? { filters: storedJobSearchFilters(parsed.data.filters) } : {}),
        },
      })
      // Serialization validation belongs inside the transaction, so an unknown
      // stored version cannot cause a hidden partial rename/update.
      return savedSearchDto(updated)
    })
    res.json(search)
  } catch (error) { respondFailure(error, res) }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.savedSearch.delete({ where: { id: req.params.id as string, userId: req.userId! } })
    res.status(204).end()
  } catch (error) { respondFailure(error, res) }
})

export default router
