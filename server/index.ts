import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import profileRouter from './routes/profile'
import jobsRouter from './routes/jobs'
import notesRouter from './routes/notes'
import resumesRouter from './routes/resumes'

const app = express()

// Middleware
const ALLOWED_ORIGINS = [
  config.clientUrl,
  // Chrome extensions use their own origin scheme; allow all extension origins in dev
  // In production, restrict to your specific extension ID: chrome-extension://<ID>
  /^chrome-extension:\/\//,
]
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin) return callback(null, true)
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    )
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed)
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static uploads serving (e.g. avatars)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Talvyn API' })
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api', notesRouter)
app.use('/api/resumes', resumesRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use(errorHandler)

// Start server
app.listen(config.port, () => {
  console.log(`\n🚀 Talvyn API running on http://localhost:${config.port}`)
  console.log(`   Environment: ${config.nodeEnv}`)
  console.log(`   Client URL: ${config.clientUrl}\n`)
})

export default app
