import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import profileRouter from './routes/profile'
import jobsRouter from './routes/jobs'
import savedSearchesRouter from './routes/savedSearches'
import notesRouter from './routes/notes'
import resumesRouter from './routes/resumes'
import releasesRouter from './routes/releases'
import { trustedWebsiteOrigins, isTrustedExtensionOrigin } from './middleware/security'

/** Build the complete production middleware stack without opening a port. */
export function createApp(options: { uploadsRoot?: string } = {}) {
  const app = express()
  app.set('trust proxy', 1)
  const configuredOrigins = [...trustedWebsiteOrigins()]
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    next()
  })
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      callback(null, configuredOrigins.includes(origin) || isTrustedExtensionOrigin(origin))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  }))
  app.use('/api/auth', express.json({ limit: '16kb' }))
  app.use('/api/saved-searches', express.json({ limit: '16kb' }))
  const savedSearchBodyError: ErrorRequestHandler = (error, _req, res, next) => {
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Saved search request is too large.' }); return }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Saved search request must contain valid JSON.' }); return }
    next(error)
  }
  app.use('/api/saved-searches', savedSearchBodyError)
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))
  // Only avatars are public. Never mount the parent directory containing resumes.
  const uploadsRoot = options.uploadsRoot || path.resolve(process.cwd(), 'uploads')
  app.use('/uploads/avatars', express.static(path.join(uploadsRoot, 'avatars'), {
    index: false,
    redirect: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      res.setHeader('X-Content-Type-Options', 'nosniff')
    },
  }))
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Talvyn API', environment: config.nodeEnv })
  })
  app.use('/api/releases', releasesRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/jobs', jobsRouter)
  app.use('/api/saved-searches', savedSearchesRouter)
  app.use('/api/resumes', resumesRouter)
  app.use('/api', notesRouter)
  app.use((_req, res) => { res.status(404).json({ error: 'Route not found' }) })
  app.use(errorHandler)
  return app
}
