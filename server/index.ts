import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import { prisma } from './lib/prisma'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import profileRouter from './routes/profile'
import jobsRouter from './routes/jobs'
import notesRouter from './routes/notes'
import resumesRouter from './routes/resumes'

const app = express()

// Trust reverse proxy (e.g. Render / Cloudflare / Vercel forwarding)
app.set('trust proxy', 1)

// Helper: Normalize origin by stripping trailing slash
function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

// Parse configured origins from environment variables (comma-separated support)
const configuredOrigins: string[] = ['https://talvyn.vercel.app']

if (config.clientUrl) {
  config.clientUrl.split(',').forEach((url) => {
    const trimmed = normalizeOrigin(url)
    if (trimmed && !configuredOrigins.includes(trimmed)) configuredOrigins.push(trimmed)
  })
}

if (config.googleAllowedOrigin) {
  config.googleAllowedOrigin.split(',').forEach((url) => {
    const trimmed = normalizeOrigin(url)
    if (trimmed && !configuredOrigins.includes(trimmed)) {
      configuredOrigins.push(trimmed)
    }
  })
}

// Local development fallback origins
const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:3001']

// Setup CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, Postman)
      if (!origin) return callback(null, true)

      const normalizedIncoming = normalizeOrigin(origin)

      // 1. Check configured production origins
      const isConfigured = configuredOrigins.some((allowed) => allowed === normalizedIncoming)
      if (isConfigured) return callback(null, true)

      // 2. Check development origins if in non-production
      if (config.nodeEnv !== 'production' && devOrigins.includes(normalizedIncoming)) {
        return callback(null, true)
      }

      // 3. Allow Chromium, Chrome, Brave, Edge, and Firefox extension origin schemes
      if (
        /^chrome-extension:\/\//.test(origin) ||
        /^moz-extension:\/\//.test(origin) ||
        /^ms-browser-extension:\/\//.test(origin) ||
        /^extension:\/\//.test(origin)
      ) {
        return callback(null, true)
      }

      // 4. If matched clientUrl directly
      if (config.clientUrl && normalizeOrigin(config.clientUrl) === normalizedIncoming) {
        return callback(null, true)
      }

      callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static uploads serving (e.g. avatars)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

// Health check endpoint for Render / monitoring
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Talvyn API',
    environment: config.nodeEnv,
  })
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
const server = app.listen(config.port, () => {
  console.log(`\n🚀 Talvyn API running on port ${config.port}`)
  console.log(`   Environment: ${config.nodeEnv}`)
  console.log(`   Allowed Origins: ${configuredOrigins.join(', ') || config.clientUrl}\n`)
})

// Graceful shutdown handling for Render / Container lifecycle
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n[Talvyn API] Received ${signal}. Closing HTTP server and disconnecting Prisma...`)
  server.close(async () => {
    try {
      await prisma.$disconnect()
      console.log('[Talvyn API] Prisma disconnected cleanly. Process exit.')
      process.exit(0)
    } catch (err) {
      console.error('[Talvyn API] Error during Prisma disconnect:', err)
      process.exit(1)
    }
  })
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'))
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'))

export default app
