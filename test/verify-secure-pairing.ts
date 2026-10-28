import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { ExtensionPairing, ExtensionSession, User } from '@prisma/client'
import authRouter, { hashRefreshToken, hashesMatch } from '../server/routes/auth'
import { authenticate } from '../server/middleware/auth'
import { proofChallenge, createRateLimiter } from '../server/middleware/security'
import { prisma } from '../server/lib/prisma'
import { config } from '../server/config'

// Exercise the real HTTP handlers/JWT verification against a test-only in-memory
// database adapter. No production mock mode or external database is involved.
async function main() {
  const extensionId = 'a'.repeat(32)
  config.extensionIds.push(extensionId)
  const user: User = { id: 'pairing-user', email: 'pairing@example.test', passwordHash: await bcrypt.hash('verified-password', 4), googleId: null, authProvider: 'EMAIL', avatarUrl: null, authVersion: 0, createdAt: new Date(), updatedAt: new Date() }
  const pairings = new Map<string, ExtensionPairing>()
  const sessions = new Map<string, ExtensionSession>()
  function matches(row: object, where: Record<string, unknown>): boolean {
    const data = row as Record<string, unknown>
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true
      if (key === 'OR' && Array.isArray(value)) return value.some((item) => matches(row, item as Record<string, unknown>))
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        const condition = value as { gt?: Date; in?: unknown[] }
        if (condition.gt) return data[key] instanceof Date && (data[key] as Date) > condition.gt
        if (condition.in) return condition.in.includes(data[key])
      }
      return data[key] === value
    })
  }
  function updateRows<T extends object>(rows: Map<string, T>, where: Record<string, unknown>, data: Partial<T>) {
    let count = 0
    for (const [id, row] of rows) if (matches(row, where)) { rows.set(id, { ...row, ...data }); count++ }
    return { count }
  }
  prisma.user.findUnique = (async ({ where }: { where: { id?: string; email?: string } }) => where.id === user.id || where.email === user.email ? { ...user, profile: null } : null) as typeof prisma.user.findUnique
  prisma.user.update = (async () => { user.authVersion++; return { ...user } }) as typeof prisma.user.update
  prisma.extensionPairing.create = (async ({ data }: { data: Pick<ExtensionPairing, 'id' | 'extensionId' | 'challenge' | 'expiresAt'> }) => {
    const record: ExtensionPairing = { ...data, userId: null, approvedAuthVersion: null, approvedAt: null, consumedAt: null, createdAt: new Date() }
    pairings.set(record.id, record); return record
  }) as typeof prisma.extensionPairing.create
  prisma.extensionPairing.findUnique = (async ({ where }: { where: { id: string } }) => {
    const record = pairings.get(where.id)
    return record ? { ...record, user: record.userId === user.id ? { ...user, profile: null } : null } : null
  }) as typeof prisma.extensionPairing.findUnique
  prisma.extensionPairing.updateMany = (async ({ where, data }: { where: Record<string, unknown>; data: Partial<ExtensionPairing> }) => updateRows(pairings, where, data)) as typeof prisma.extensionPairing.updateMany
  prisma.extensionSession.create = (async ({ data }: { data: Pick<ExtensionSession, 'id' | 'userId' | 'authVersion' | 'refreshTokenHash' | 'expiresAt'> }) => {
    const record: ExtensionSession = { ...data, revokedAt: null, lastUsedAt: null, createdAt: new Date(), updatedAt: new Date() }
    sessions.set(record.id, record); return record
  }) as typeof prisma.extensionSession.create
  prisma.extensionSession.findUnique = (async ({ where }: { where: { id: string } }) => {
    const record = sessions.get(where.id)
    return record ? { ...record, user: { ...user, profile: null } } : null
  }) as typeof prisma.extensionSession.findUnique
  prisma.extensionSession.updateMany = (async ({ where, data }: { where: Record<string, unknown>; data: Partial<ExtensionSession> }) => updateRows(sessions, where, data)) as typeof prisma.extensionSession.updateMany
  prisma.$transaction = (async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) as typeof prisma.$transaction
  const app = express()
  app.use(express.json({ limit: '16kb' }))
  app.use('/api/auth', authRouter)
  app.get('/api/protected', authenticate, (_req, res) => res.json({ success: true }))
  app.post('/api/protected', authenticate, (_req, res) => res.json({ success: true }))
  const limited = createRateLimiter(2, 60000)
  app.get('/limit', limited, (_req, res) => res.json({ success: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  const websiteOrigin = 'https://talvyn.vercel.app'
  const workerOrigin = `chrome-extension://${extensionId}`
  let cookie = ''
  async function request(route: string, body?: object, options: { origin?: string; bearer?: string; cookie?: boolean; method?: string } = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.origin) headers.Origin = options.origin
    if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`
    if (options.cookie && cookie) headers.Cookie = cookie
    return fetch(`${base}${route}`, { method: options.method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined })
  }
  async function login() {
    const response = await request('/api/auth/login', { email: user.email, password: 'verified-password' }, { origin: websiteOrigin })
    assert.equal(response.status, 200)
    const data = await response.json() as Record<string, unknown>
    assert.equal('token' in data, false, 'login JSON never exposes a credential')
    const setCookie = response.headers.get('set-cookie') || ''
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Lax/i)
    cookie = setCookie.split(';')[0]
  }
  async function connect() {
    const verifier = 'v'.repeat(64)
    const start = await request('/api/auth/extension-pairing/start', { extensionId, challenge: proofChallenge(verifier) }, { origin: workerOrigin })
    assert.equal(start.status, 201)
    const data = await start.json() as { requestId: string }
    const pending = await request('/api/auth/extension-pairing/exchange', { requestId: data.requestId, verifier }, { origin: workerOrigin })
    assert.equal(pending.status, 202)
    const badProof = await request('/api/auth/extension-pairing/exchange', { requestId: data.requestId, verifier: 'x'.repeat(64) }, { origin: workerOrigin })
    assert.equal(badProof.status, 401)
    const deniedConsent = await request(`/api/auth/extension-pairing/${data.requestId}/approve`, { keepConnected: false }, { cookie: true, origin: websiteOrigin })
    assert.equal(deniedConsent.status, 400)
    const info = await request(`/api/auth/extension-pairing/${data.requestId}`, undefined, { cookie: true })
    const metadata = await info.json() as Record<string, unknown>
    assert.equal('challenge' in metadata, false); assert.equal('accessToken' in metadata, false)
    assert.equal((await request(`/api/auth/extension-pairing/${data.requestId}/approve`, { keepConnected: true, expectedUserId: user.id }, { cookie: true, origin: 'https://attacker.example' })).status, 403)
    assert.equal((await request(`/api/auth/extension-pairing/${data.requestId}/approve`, { keepConnected: true, expectedUserId: 'another-account' }, { cookie: true, origin: websiteOrigin })).status, 409)
    assert.equal((await request(`/api/auth/extension-pairing/${data.requestId}/approve`, { keepConnected: true, expectedUserId: user.id }, { cookie: true, origin: websiteOrigin })).status, 200)
    assert.equal((await request('/api/auth/extension-pairing/exchange', { requestId: data.requestId, verifier }, { origin: websiteOrigin })).status, 403)
    const exchange = await request('/api/auth/extension-pairing/exchange', { requestId: data.requestId, verifier }, { origin: workerOrigin })
    assert.equal(exchange.status, 201)
    const credentials = await exchange.json() as { sessionId: string; accessToken: string; refreshToken: string }
    assert.equal((await request('/api/auth/extension-pairing/exchange', { requestId: data.requestId, verifier }, { origin: workerOrigin })).status, 401, 'approval is single-use')
    assert.equal(sessions.get(credentials.sessionId)?.refreshTokenHash, hashRefreshToken(credentials.refreshToken))
    assert.equal((await request('/api/protected', undefined, { bearer: credentials.accessToken })).status, 200)
    return credentials
  }
  try {
    assert.equal((await request('/api/auth/login', { email: user.email, password: 'verified-password' }, { origin: 'https://attacker.example' })).status, 403)
    const forgedGoogle = await request('/api/auth/google', { credential: 'test-google-token:{"sub":"forged","email":"pairing@example.test","email_verified":true}' }, { origin: websiteOrigin })
    assert.equal(forgedGoogle.status, 400, 'the real API rejects forged fixture credentials')
    assert.equal(forgedGoogle.headers.get('set-cookie'), null)
    await login()
    assert.equal((await request('/api/protected', undefined, { cookie: true })).status, 200)
    assert.equal((await request('/api/protected', {}, { cookie: true, origin: 'https://attacker.example' })).status, 403)
    const cookieToken = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))
    assert.equal((await request('/api/protected', undefined, { bearer: cookieToken })).status, 401, 'website cookie is not an extension bearer token')
    assert.equal((await request('/api/auth/extension-sessions', {}, { cookie: true, origin: websiteOrigin })).status, 410)
    assert.equal((await request('/api/auth/extension-pairing/start', { extensionId: 'b'.repeat(32), challenge: proofChallenge('x'.repeat(64)) })).status, 400)
    const first = await connect()
    assert.equal((await request('/api/auth/logout', {}, { cookie: true, origin: websiteOrigin })).status, 200)
    assert.equal(sessions.get(first.sessionId)?.revokedAt, null, 'website logout preserves independent extension session')
    assert.equal((await request('/api/protected', undefined, { bearer: first.accessToken })).status, 200)
    const refresh = await request('/api/auth/extension-sessions/refresh', { refreshToken: first.refreshToken }, { origin: workerOrigin })
    assert.equal(refresh.status, 200)
    const rotated = await refresh.json() as { accessToken: string; refreshToken: string }
    assert.notEqual(rotated.refreshToken, first.refreshToken)
    assert.equal((await request('/api/auth/extension-sessions/refresh', { refreshToken: first.refreshToken }, { origin: workerOrigin })).status, 401, 'replay is rejected')
    assert.ok(sessions.get(first.sessionId)?.revokedAt, 'replay revokes the session')
    assert.equal((await request('/api/auth/extension-sessions/refresh', { refreshToken: rotated.refreshToken }, { origin: workerOrigin })).status, 401)
    await login()
    const second = await connect()
    assert.equal((await request('/api/auth/signout-all', {}, { cookie: true, origin: websiteOrigin })).status, 200)
    assert.equal((await request('/api/protected', undefined, { bearer: second.accessToken })).status, 401)
    // Even a concurrent session created after revocation cannot refresh across
    // the auth-version boundary.
    const secondRow = sessions.get(second.sessionId)!
    sessions.set(second.sessionId, { ...secondRow, revokedAt: null })
    assert.equal((await request('/api/auth/extension-sessions/refresh', { refreshToken: second.refreshToken }, { origin: workerOrigin })).status, 401)
    await login()
    const third = await connect()
    assert.equal((await request('/api/auth/extension-sessions/revoke', { sessionId: randomUUID() }, { bearer: third.accessToken })).status, 400)
    assert.equal((await request('/api/auth/extension-sessions/revoke', {}, { bearer: third.accessToken })).status, 200)
    assert.equal((await request('/api/protected', undefined, { bearer: third.accessToken })).status, 401)
    const expired = jwt.sign({ userId: user.id, authVersion: user.authVersion, tokenUse: 'extension_access', sessionId: third.sessionId }, config.jwtSecret, { expiresIn: -1 })
    assert.equal((await request('/api/protected', undefined, { bearer: expired })).status, 401)
    assert.equal(hashesMatch('', ''), false, 'empty proof hashes are rejected')
    assert.equal((await request('/limit')).status, 200)
    assert.equal((await request('/limit')).status, 200)
    const throttled = await request('/limit')
    assert.equal(throttled.status, 429); assert.ok(throttled.headers.get('retry-after'))
    console.log('✓ Real HTTP cookie, CSRF, pairing proof, consent, replay, rotation, revocation, auth-version and rate-limit regressions passed (test database adapter).')
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await prisma.$disconnect()
  }
}
main().catch((error: unknown) => {
  console.error('Secure pairing regression failed. No credentials were printed.')
  if (error instanceof Error) console.error(error.stack?.split('\n').filter((line) => /^\s+at /.test(line)).join('\n'))
  if (error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) console.error(`Transport diagnostic: ${String(error.cause.code)}`)
  process.exitCode = 1
})
