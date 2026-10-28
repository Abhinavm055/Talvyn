import { Router } from 'express'
import { configuredReleaseRepository, ExtensionReleaseService } from '../services/extensionReleaseService'

export function createReleaseRouter(service?: Pick<ExtensionReleaseService, 'get'>) {
  const router = Router()
  const repository = configuredReleaseRepository()
  const reader = service || (repository ? new ExtensionReleaseService(repository) : null)
  router.get('/extension', async (_req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (!reader) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error: 'Release repository is not configured.' }); return }
    try {
      const metadata = await reader.get()
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
      res.json(metadata)
    } catch {
      res.setHeader('Cache-Control', 'no-store')
      res.status(503).json({ error: 'Release metadata is unavailable or invalid. Please retry later.' })
    }
  })
  return router
}

export default createReleaseRouter()
