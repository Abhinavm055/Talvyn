import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
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
  router.get('/extension/download', (_req, res) => {
    const localPackage = path.resolve(process.cwd(), 'extension/dist-package/talvyn-extension.zip')
    if (fs.existsSync(localPackage)) {
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', 'attachment; filename="talvyn-extension.zip"')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.sendFile(localPackage)
    }
    res.status(404).json({ error: 'Local extension package not found. Run npm run package:extension first.' })
  })
  return router
}

export default createReleaseRouter()
