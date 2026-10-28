/** Real HTTP handlers and Prisma/PostgreSQL. No database or auth mocks. */
import { requireTestDatabase } from './helpers/testDatabase'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Job, Resume, UserProfile } from '@prisma/client'
import { hashRefreshToken } from '../server/routes/auth'
import { createApp } from '../server/app'
import { storageService } from '../server/services/storageService'
import { proofChallenge } from '../server/middleware/security'
import { config } from '../server/config'
import { prisma } from '../server/lib/prisma'

interface Account { id: string; email: string; cookie: string }
interface Credentials { sessionId: string; accessToken: string; refreshToken: string }
interface Pairing { requestId: string; verifier: string }
let phase = 'database prerequisites'

async function main(): Promise<void> {
  requireTestDatabase()
  await prisma.$queryRaw`SELECT 1`
  const extensionId = 'a'.repeat(32) // Test-only identity, never publication configuration.
  config.extensionIds.push(extensionId)
  const workerOrigin = `chrome-extension://${extensionId}`
  const websiteOrigin = 'https://talvyn.vercel.app'
  const users: string[] = []
  const testFiles: string[] = []
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  const request = async <T = Record<string, unknown>>(route: string, options: {
    body?: object; account?: Account; bearer?: string; method?: string; origin?: string
  } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.account) headers.Cookie = options.account.cookie
    if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`
    headers.Origin = options.origin || (options.bearer ? workerOrigin : websiteOrigin)
    const response = await fetch(base + route, {
      method: options.method || (options.body ? 'POST' : 'GET'), headers,
      body: options.body ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(15_000),
    })
    const body = response.status === 204 ? undefined : await response.json() as T
    return { status: response.status, body: body as T, cookie: response.headers.get('set-cookie') || '' }
  }
  const register = async (): Promise<Account> => {
    const email = `integration-${randomUUID()}@example.test`
    const result = await request<{ user: { id: string; email: string } }>('/api/auth/register', { body: { email, password: 'Local-test-password-123!', givenName: 'Verified' } })
    assert.equal(result.status, 201)
    assert.ok(!('token' in result.body) && !('accessToken' in result.body))
    assert.match(result.cookie, /HttpOnly/i)
    users.push(result.body.user.id)
    return { ...result.body.user, cookie: result.cookie.split(';')[0] }
  }
  const start = async (): Promise<Pairing> => {
    const verifier = randomBytes(32).toString('base64url')
    const result = await request<{ requestId: string }>('/api/auth/extension-pairing/start', { body: { extensionId, challenge: proofChallenge(verifier) }, origin: workerOrigin })
    assert.equal(result.status, 201)
    return { requestId: result.body.requestId, verifier }
  }
  const approve = async (pairing: Pairing, account: Account) => {
    const result = await request(`/api/auth/extension-pairing/${pairing.requestId}/approve`, { account, body: { keepConnected: true, expectedUserId: account.id } })
    assert.equal(result.status, 200)
  }
  const exchange = (pairing: Pairing) => request<Credentials>('/api/auth/extension-pairing/exchange', { body: pairing, origin: workerOrigin })
  const connect = async (account: Account): Promise<Credentials> => {
    const pairing = await start()
    await approve(pairing, account)
    const result = await exchange(pairing)
    assert.equal(result.status, 201)
    return result.body
  }
  try {
    phase = 'registration, cookie and CSRF'
    const first = await register()
    const second = await register()
    assert.equal((await request('/api/auth/me', { account: first })).status, 200)
    assert.equal((await request('/api/profile', { account: first, method: 'PUT', body: { givenName: 'Blocked' }, origin: 'https://attacker.example' })).status, 403)
    assert.equal((await request('/api/auth/google', { body: { credential: 'test-google-token:{"sub":"forged"}' } })).status, 400)
    console.log('PASS: persisted registration, private cookie and CSRF/forged-credential rejection.')

    phase = 'profile, saved jobs and cross-account authorization'
    const profile = await request<Omit<UserProfile, 'skills'> & { skills: string[] }>('/api/profile', { account: first, method: 'PUT', body: {
      skills: ['TypeScript', 'PostgreSQL'], phone: '+1-555-0100', linkedinUrl: 'https://linkedin.com/in/test-candidate', experienceYears: null,
    } })
    assert.equal(profile.status, 200)
    assert.deepEqual(profile.body.skills, ['TypeScript', 'PostgreSQL'])
    const storedProfile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: first.id } })
    assert.equal(storedProfile.phone, '+1-555-0100')
    assert.equal(storedProfile.experienceYears, null)
    const jobUrl = `https://jobs.example.test/${randomUUID()}`
    const saved = await request<Job>('/api/jobs', { account: first, body: { title: 'Backend Engineer', company: 'Test Company', jobUrl, status: 'SAVED' } })
    assert.equal(saved.status, 201)
    const jobId = saved.body.id
    assert.equal((await request('/api/jobs', { account: first, body: { title: 'Duplicate', company: 'Test Company', jobUrl } })).status, 409)
    assert.equal((await request<{ exists: boolean }>(`/api/jobs/check-url?url=${encodeURIComponent(jobUrl)}`, { account: first })).body.exists, true)
    assert.equal((await request<{ exists: boolean }>(`/api/jobs/check-url?url=${encodeURIComponent(jobUrl)}`, { account: second })).body.exists, false)
    assert.equal((await request(`/api/jobs/${jobId}`, { account: second })).status, 404)
    assert.equal((await request(`/api/jobs/${jobId}/status`, { account: second, method: 'PATCH', body: { status: 'APPLIED' } })).status, 403)
    assert.equal((await request(`/api/jobs/${jobId}/notes`, { account: second, body: { content: 'Unauthorized' } })).status, 404)
    assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status, 'SAVED')
    console.log('PASS: canonical profile persistence, job save/duplicates and actual cross-account API denial.')

    phase = 'tracker and timeline persistence'
    assert.equal((await request(`/api/jobs/${jobId}/application/start`, { account: first, body: {} })).status, 200)
    assert.equal((await request(`/api/jobs/${jobId}/application/start`, { account: first, body: {} })).status, 200)
    assert.equal(await prisma.note.count({ where: { jobId, content: { contains: '[Timeline: APPLICATION_STARTED]' } } }), 1)
    assert.equal((await request(`/api/jobs/${jobId}/status`, { account: first, method: 'PATCH', body: { status: 'APPLIED' } })).status, 200)
    assert.ok((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).dateApplied)
    assert.equal((await request(`/api/jobs/${jobId}/status`, { account: first, method: 'PATCH', body: { status: 'SAVED' } })).status, 200)
    const reverted = await prisma.job.findUniqueOrThrow({ where: { id: jobId } })
    assert.equal(reverted.status, 'SAVED')
    assert.equal(reverted.dateApplied, null)
    assert.equal(await prisma.note.count({ where: { jobId, content: { contains: '[Timeline: APPLICATION_STARTED]' } } }), 1)
    console.log('PASS: application-start idempotence, tracker transitions and retained timeline history.')

    phase = 'resume ownership and default promotion'
    const resumeOne = await request<Resume>('/api/resumes', { account: first, body: { name: 'Primary resume', isDefault: true } })
    const resumeTwo = await request<Resume>('/api/resumes', { account: first, body: { name: 'Second resume' } })
    assert.equal(resumeOne.status, 201)
    assert.equal(resumeTwo.status, 201)
    assert.equal((await request(`/api/resumes/${resumeOne.body.id}`, { account: second, method: 'DELETE' })).status, 404)
    assert.equal((await request(`/api/resumes/${resumeOne.body.id}`, { account: first, method: 'DELETE' })).status, 200)
    assert.equal((await prisma.resume.findUniqueOrThrow({ where: { id: resumeTwo.body.id } })).isDefault, true)
    assert.deepEqual((await request<Resume[]>('/api/resumes', { account: second })).body, [])
    const bytes = Buffer.from('Synthetic private resume bytes')
    const stored = await storageService.uploadFile({ originalname: 'private.pdf', buffer: bytes, size: bytes.length, mimetype: 'application/pdf' } as Express.Multer.File, 'resumes')
    testFiles.push(path.resolve('uploads', stored.storagePath))
    const privateResume = await prisma.resume.create({ data: { userId: first.id, name: 'Private file test', storagePath: stored.storagePath, fileName: stored.fileName, mimeType: stored.mimeType } })
    const fileRoute = `/api/resumes/${privateResume.id}/file`
    assert.equal((await fetch(base + fileRoute)).status, 401)
    assert.equal((await fetch(base + fileRoute, { headers: { Cookie: second.cookie } })).status, 404)
    const ownerFile = await fetch(base + fileRoute, { headers: { Cookie: first.cookie } })
    assert.equal(ownerFile.status, 200)
    assert.match(ownerFile.headers.get('cache-control') || '', /private.*no-store/)
    assert.deepEqual(Buffer.from(await ownerFile.arrayBuffer()), bytes)
    assert.equal((await fetch(`${base}/uploads/${stored.storagePath}`)).status, 404)
    assert.equal((await request(`/api/resumes/${privateResume.id}`, { account: first, method: 'DELETE' })).status, 200)
    console.log('PASS: full-server resume file authentication/ownership/private cache, blocked static access and default promotion.')

    phase = 'pairing proof, consent and database concurrency'
    const pairing = await start()
    assert.equal((await exchange(pairing)).status, 202)
    assert.equal((await request(`/api/auth/extension-pairing/${pairing.requestId}/approve`, { account: first, body: { keepConnected: false, expectedUserId: first.id } })).status, 400)
    assert.equal((await request(`/api/auth/extension-pairing/${pairing.requestId}/approve`, { account: first, body: { keepConnected: true, expectedUserId: second.id } })).status, 409)
    await approve(pairing, first)
    assert.equal((await request('/api/auth/extension-pairing/exchange', { body: pairing, origin: websiteOrigin })).status, 403)
    const exchanged = await Promise.all([exchange(pairing), exchange(pairing)])
    assert.equal(exchanged.filter((result) => result.status === 201).length, 1)
    assert.ok(exchanged.every((result) => [201, 401, 409].includes(result.status)))
    const credentials = exchanged.find((result) => result.status === 201)!.body
    assert.equal(await prisma.extensionSession.count({ where: { userId: first.id } }), 1)
    assert.equal((await prisma.extensionSession.findUniqueOrThrow({ where: { id: credentials.sessionId } })).refreshTokenHash === hashRefreshToken(credentials.refreshToken), true)
    assert.ok((await prisma.extensionPairing.findUniqueOrThrow({ where: { id: pairing.requestId } })).consumedAt)
    console.log('PASS: proof/consent controls and concurrent exchange create exactly one persisted session.')

    phase = 'website logout independence and refresh replay'
    const logout = await request('/api/auth/logout', { account: first, body: {} })
    assert.equal(logout.status, 200)
    assert.match(logout.cookie, /Expires=/i)
    assert.equal((await request('/api/auth/me', { bearer: credentials.accessToken })).status, 200)
    assert.equal((await prisma.extensionSession.findUniqueOrThrow({ where: { id: credentials.sessionId } })).revokedAt, null)
    const refreshed = await request<Credentials>('/api/auth/extension-sessions/refresh', { body: { refreshToken: credentials.refreshToken }, origin: workerOrigin })
    assert.equal(refreshed.status, 200)
    assert.ok(refreshed.body.refreshToken !== credentials.refreshToken)
    assert.equal((await request('/api/auth/extension-sessions/refresh', { body: { refreshToken: credentials.refreshToken }, origin: workerOrigin })).status, 401)
    assert.ok((await prisma.extensionSession.findUniqueOrThrow({ where: { id: credentials.sessionId } })).revokedAt)
    assert.equal((await request('/api/auth/me', { bearer: refreshed.body.accessToken })).status, 401)
    console.log('PASS: website logout preserves extension access; persisted rotation/replay revokes it correctly.')

    phase = 'concurrent refresh and global sign-out'
    const concurrent = await connect(second)
    const races = await Promise.all([0, 1].map(() => request<Credentials>('/api/auth/extension-sessions/refresh', { body: { refreshToken: concurrent.refreshToken }, origin: workerOrigin })))
    assert.ok(races.every((result) => [200, 401].includes(result.status)))
    assert.ok(races.some((result) => result.status === 401))
    assert.ok((await prisma.extensionSession.findUniqueOrThrow({ where: { id: concurrent.sessionId } })).revokedAt)
    for (const result of races.filter((item) => item.status === 200)) assert.equal((await request('/api/auth/me', { bearer: result.body.accessToken })).status, 401)
    const active = await connect(second)
    const pending = await start()
    await approve(pending, second)
    assert.equal((await request('/api/auth/signout-all', { account: second, body: {} })).status, 200)
    assert.equal((await request('/api/auth/me', { account: second })).status, 401)
    assert.equal((await request('/api/auth/me', { bearer: active.accessToken })).status, 401)
    assert.equal((await exchange(pending)).status, 401)
    // Emulate a refresh row written after revocation: its old authVersion must
    // still prevent resurrection across global sign-out.
    await prisma.extensionSession.update({ where: { id: active.sessionId }, data: { revokedAt: null } })
    assert.equal((await request('/api/auth/extension-sessions/refresh', { body: { refreshToken: active.refreshToken }, origin: workerOrigin })).status, 401)
    console.log('PASS: concurrent refresh replay and global sign-out cannot resurrect an older session.')

    phase = 'revocation, expiry and cascade constraints'
    const signedInAgain = await request('/api/auth/login', { body: { email: first.email, password: 'Local-test-password-123!' } })
    assert.equal(signedInAgain.status, 200)
    first.cookie = signedInAgain.cookie.split(';')[0]
    const disconnected = await connect(first)
    assert.equal((await request('/api/auth/extension-sessions/revoke', { bearer: disconnected.accessToken, body: {} })).status, 200)
    assert.equal((await request('/api/auth/me', { bearer: disconnected.accessToken })).status, 401)
    const expired = await start()
    await prisma.extensionPairing.update({ where: { id: expired.requestId }, data: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await exchange(expired)).status, 401)
    await prisma.extensionPairing.delete({ where: { id: expired.requestId } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    assert.equal(await prisma.extensionSession.count({ where: { userId: { in: users } } }), 0)
    assert.equal(await prisma.job.count({ where: { userId: { in: users } } }), 0)
    assert.equal(await prisma.resume.count({ where: { userId: { in: users } } }), 0)
    console.log('PASS: explicit disconnect, pairing expiry and real foreign-key cascade cleanup.')
    console.log('PASS: all 8 real PostgreSQL/HTTP integration groups completed without mocks.')
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    for (const file of testFiles) await fs.unlink(file).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
    try { await prisma.user.deleteMany({ where: { id: { in: users } } }) }
    finally { await prisma.$disconnect() }
  }
}

main().catch((error: unknown) => {
  console.error(`PostgreSQL integration failed during: ${phase}. Credentials were not printed.`)
  if (error instanceof Error) {
    const sanitized = error.message.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@')
    console.error(`Reason: ${sanitized}`)
    console.error(error.stack?.split('\n').filter((line) => /^\s+at /.test(line)).join('\n'))
  }
  process.exitCode = 1
})
