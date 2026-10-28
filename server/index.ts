import 'dotenv/config'
import { config } from './config'
import { prisma } from './lib/prisma'
import { createApp } from './app'
import { trustedWebsiteOrigins } from './middleware/security'

const app = createApp()
const configuredOrigins = [...trustedWebsiteOrigins()]

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
