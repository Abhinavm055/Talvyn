/** Import before server modules in any test that can reach Prisma. */
import { config as loadEnvironment } from 'dotenv'

loadEnvironment()
const dedicatedDatabase = process.env.TALVYN_TEST_DATABASE_URL?.trim()
process.env.DATABASE_URL = dedicatedDatabase || 'postgresql://talvyn_test:unused@127.0.0.1:1/talvyn_test?connect_timeout=1'
process.env.NODE_ENV = 'test'

export function requireTestDatabase(): void {
  if (!dedicatedDatabase) throw new Error('No dedicated test database configured. Set TALVYN_TEST_DATABASE_URL or run "npm run test:postgres" to use a disposable test database.')
}

/** An explicitly configured test database must fail loudly rather than fall back. */
export function allowDatabaseFixtureFallback(error: unknown): void {
  if (dedicatedDatabase) throw error
}
