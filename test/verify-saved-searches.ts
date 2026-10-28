/** Full app + real PostgreSQL. Requires the dedicated migrated test database. */
import { requireTestDatabase } from './helpers/testDatabase'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createApp } from '../server/app'
import { config } from '../server/config'
import { prisma } from '../server/lib/prisma'
import { DEFAULT_JOB_SEARCH_FILTERS, filtersToJobQuery, type JobSearchFilters, type SavedSearch } from '../server/contracts/jobSearch'

interface Account { id: string; cookie: string }
interface Jobs { jobs: { id: string; title: string; company: string; location: string; status: string; jobType: string; notes: unknown[]; _count: { notes: number } }[]; total: number; page: number; limit: number }
let phase = 'dedicated database prerequisites'

async function main(): Promise<void> {
  requireTestDatabase()
  await prisma.$queryRaw`SELECT 1`
  const users: string[] = []
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  const websiteOrigin = 'https://talvyn.vercel.app'
  const request = async <T = Record<string, unknown>>(route: string, options: {
    account?: Account; body?: unknown; method?: string; origin?: string | null; bearer?: string; raw?: string;
  } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.account) headers.Cookie = options.account.cookie
    if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`
    if (options.origin !== null) headers.Origin = options.origin || websiteOrigin
    const response = await fetch(base + route, { method: options.method || (options.body !== undefined || options.raw !== undefined ? 'POST' : 'GET'), headers,
      body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)), signal: AbortSignal.timeout(15_000) })
    return { status: response.status, body: response.status === 204 ? undefined as T : await response.json() as T, cookie: response.headers.get('set-cookie') || '', cache: response.headers.get('cache-control') }
  }
  const register = async (): Promise<Account> => {
    const result = await request<{ user: { id: string } }>('/api/auth/register', { body: { email: `saved-search-${randomUUID()}@example.test`, password: 'Local-test-password-123!', givenName: 'Synthetic' } })
    assert.equal(result.status, 201)
    users.push(result.body.user.id)
    return { id: result.body.user.id, cookie: result.cookie.split(';')[0] }
  }
  const filters: JobSearchFilters = { search: '  TypeScript  ', company: 'acme_100%\\labs', location: 'bENGALURU', status: 'SAVED', jobType: 'FULL_TIME' }
  const searchesFor = (account: Account) => request<{ searches: SavedSearch[] }>('/api/saved-searches', { account })
  try {
    const first = await register()
    const second = await register()
    phase = 'authentication and CSRF'
    assert.equal((await request('/api/saved-searches')).status, 401)
    assert.equal((await request('/api/saved-searches', { account: first, body: { name: 'Blocked', filters }, origin: 'https://attacker.example' })).status, 403)
    assert.equal((await request('/api/saved-searches', { account: first, body: { name: 'Blocked', filters }, origin: null })).status, 403)
    const sessionId = randomUUID()
    await prisma.extensionSession.create({ data: { id: sessionId, userId: first.id, refreshTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const bearer = jwt.sign({ userId: first.id, authVersion: 0, tokenUse: 'extension_access', sessionId }, config.jwtSecret, { expiresIn: '1m' })
    assert.equal((await request('/api/jobs', { bearer })).status, 200)
    assert.equal((await request('/api/saved-searches', { bearer })).status, 403)
    assert.equal((await request('/api/saved-searches', { bearer, body: { name: 'Extension denied', filters } })).status, 403)
    console.log('PASS: saved searches require website sessions; anonymous, extension and untrusted/missing Origin writes are denied.')

    phase = 'persisted CRUD, names and account isolation'
    const created = await request<SavedSearch>('/api/saved-searches', { account: first, body: { name: '  Ａｃｍｅ   Search  ', filters } })
    assert.equal(created.status, 201)
    assert.equal(created.body.name, 'Acme Search')
    assert.equal(created.body.filters.search, 'TypeScript')
    assert.match(created.body.createdAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.deepEqual((await prisma.savedSearch.findUniqueOrThrow({ where: { id: created.body.id } })).filters, { version: 1, ...created.body.filters })
    assert.deepEqual((await searchesFor(first)).body.searches, [created.body])
    assert.deepEqual((await searchesFor(second)).body.searches, [])
    assert.equal((await searchesFor(first)).cache, 'private, no-store')
    assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: second, method: 'PATCH', body: { name: 'Stolen' } })).status, 404)
    assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: second, method: 'DELETE' })).status, 404)
    const renamed = await request<SavedSearch>(`/api/saved-searches/${created.body.id}`, { account: first, method: 'PATCH', body: { name: 'Updated Search' } })
    assert.equal(renamed.status, 200)
    assert.deepEqual(renamed.body.filters, created.body.filters)
    const updated = await request<SavedSearch>(`/api/saved-searches/${created.body.id}`, { account: first, method: 'PATCH', body: { filters: { ...filters, search: 'Go' } } })
    assert.equal(updated.status, 200)
    assert.equal((await searchesFor(first)).body.searches[0].filters.search, 'Go')
    // A fresh application instance/client sees the same persisted data.
    const reloadServer = createApp().listen(0, '127.0.0.1')
    await new Promise<void>((resolve, reject) => { reloadServer.once('listening', resolve); reloadServer.once('error', reject) })
    try {
      const reloadAddress = reloadServer.address()
      assert.ok(reloadAddress && typeof reloadAddress !== 'string')
      const reload = await fetch(`http://127.0.0.1:${reloadAddress.port}/api/saved-searches`, { headers: { Cookie: first.cookie }, signal: AbortSignal.timeout(15_000) })
      assert.equal(reload.status, 200)
      assert.deepEqual((await reload.json() as { searches: SavedSearch[] }).searches, (await searchesFor(first)).body.searches)
    } finally { reloadServer.closeAllConnections(); await new Promise<void>((resolve) => reloadServer.close(() => resolve())) }
    console.log('PASS: CRUD persists across clients/app reconstruction, normalizes names and enforces account isolation atomically.')

    phase = 'concurrent normalized-name conflicts'
    const concurrent = await Promise.all([' Race Search ', 'race   search', 'ＲＡＣＥ Search', 'RACE SEARCH'].map((name) => request<SavedSearch>('/api/saved-searches', { account: first, body: { name, filters: DEFAULT_JOB_SEARCH_FILTERS } })))
    assert.equal(concurrent.filter((result) => result.status === 201).length, 1)
    assert.equal(concurrent.filter((result) => result.status === 409).length, 3)
    assert.equal(await prisma.savedSearch.count({ where: { userId: first.id, nameKey: 'race search' } }), 1)
    assert.equal((await request('/api/saved-searches', { account: second, body: { name: 'RACE SEARCH', filters: DEFAULT_JOB_SEARCH_FILTERS } })).status, 201)
    assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: first, method: 'PATCH', body: { name: 'race search' } })).status, 409)
    assert.equal((await prisma.savedSearch.findUniqueOrThrow({ where: { id: created.body.id } })).name, 'Updated Search')
    console.log('PASS: concurrent NFKC/case/whitespace name collisions produce one record and 409 responses; other accounts may use the same name.')

    phase = 'job filtering and compatibility'
    const common = { userId: first.id, title: 'TypeScript Platform', company: 'Acme_100%\\Labs', location: 'Bengaluru', jobType: 'FULL_TIME', status: 'SAVED', createdAt: new Date('2026-10-01T00:00:00.000Z') }
    const target = await prisma.job.create({ data: common })
    await prisma.job.createMany({ data: [
      { ...common, title: 'Python Platform' }, { ...common, company: 'AcmeX100anythingLabs' }, { ...common, location: 'Remote' },
      { ...common, status: 'APPLIED' }, { ...common, jobType: 'PART_TIME' }, { ...common, userId: second.id },
      { ...common, title: 'Literal %_ back\\slash' }, { ...common, title: 'Literal AX backZslash' },
    ] })
    await prisma.note.create({ data: { userId: first.id, jobId: target.id, content: 'Synthetic note preserved after deleting a saved search.' } })
    const active = await request<Jobs>(`/api/jobs?${new URLSearchParams(filtersToJobQuery(filters))}`, { account: first })
    assert.equal(active.status, 200)
    assert.equal(active.body.total, 1)
    assert.deepEqual(active.body.jobs.map((job) => job.id), [target.id])
    assert.equal(active.body.jobs[0]._count.notes, 1)
    assert.equal((await request<Jobs>('/api/jobs?search=%25_', { account: first })).body.total, 1)
    assert.equal((await request<Jobs>('/api/jobs?search=back%5Cslash', { account: first })).body.total, 1)
    assert.equal((await request<Jobs>('/api/jobs?search=python', { account: first })).body.total, 1)
    assert.equal((await request<Jobs>('/api/jobs?status=APPLIED', { account: first })).body.total, 1)
    for (const limit of [100, 200]) {
      const compatible = await request<Jobs>(`/api/jobs?limit=${limit}`, { account: first })
      assert.equal(compatible.status, 200, 'Existing Dashboard/Tracker batch size remains supported')
      assert.equal(compatible.body.limit, limit)
    }
    const legacy = await request<{ id: string }>('/api/jobs', { account: first, body: { title: 'Legacy API job', company: 'Compatibility', jobUrl: `https://jobs.example.test/${randomUUID()}` } })
    assert.equal(legacy.status, 201)
    assert.equal((await request(`/api/jobs/${legacy.body.id}`, { account: first })).status, 200)
    console.log('PASS: shared job filters intersect, ignore case, treat %, _ and backslash literally, retain legacy API and notes shape, and isolate accounts.')

    phase = 'stable pagination past fifty jobs'
    await prisma.job.createMany({ data: Array.from({ length: 61 }, (_, index) => ({ ...common, title: `Page fixture ${index}`, company: 'Pagination Company' })) })
    const params = 'company=pagination%20company'
    const pageOne = await request<Jobs>(`/api/jobs?${params}`, { account: first })
    const pageTwo = await request<Jobs>(`/api/jobs?${params}&page=2`, { account: first })
    assert.equal(pageOne.body.total, 61)
    assert.equal(pageOne.body.jobs.length, 50)
    assert.equal(pageTwo.body.jobs.length, 11)
    assert.equal(pageTwo.body.page, 2)
    assert.equal(pageTwo.body.limit, 50)
    const ids = [...pageOne.body.jobs, ...pageTwo.body.jobs].map((job) => job.id)
    assert.equal(new Set(ids).size, 61)
    assert.deepEqual(ids, [...ids].sort().reverse()) // Identical createdAt requires the id-desc tie breaker.
    assert.deepEqual((await request<Jobs>(`/api/jobs?${params}`, { account: first })).body.jobs.map((job) => job.id), pageOne.body.jobs.map((job) => job.id))
    assert.equal((await request<Jobs>(`/api/jobs?${params}&page=3`, { account: first })).body.jobs.length, 0)
    console.log('PASS: deterministic timestamp/id pagination returns all 61 matching jobs without duplicates or first-50 truncation.')

    phase = 'validation, injection and persisted criteria safety'
    for (const body of [
      { name: '', filters }, { name: ' '.repeat(10), filters }, { name: 'x'.repeat(81), filters }, { name: 'Bad\0name', filters },
      { name: 'Owner injection', filters, userId: second.id }, { name: 'ID injection', filters, id: 'forged' },
      { name: 'Unexpected filter', filters: { ...filters, userId: second.id } }, { name: 'Bad status', filters: { ...filters, status: 'HACK' } },
      { name: 'Bad type', filters: { ...filters, jobType: 'HACK' } }, { name: 'Bad scalar', filters: { ...filters, search: ['TypeScript'] } },
      { name: 'Long search', filters: { ...filters, search: 'x'.repeat(201) } }, { name: 'Long company', filters: { ...filters, company: 'x'.repeat(121) } },
      { name: 'Long location', filters: { ...filters, location: 'x'.repeat(121) } },
    ]) assert.equal((await request('/api/saved-searches', { account: first, body })).status, 400)
    for (const body of [{}, { userId: second.id }, { nameKey: 'forged' }, { filters: { ...filters, version: 2 } }]) {
      assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: first, method: 'PATCH', body })).status, 400)
    }
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=100001', 'page=2junk', 'limit=0', 'limit=201', 'limit=1e2', 'search=a&search=b', 'search[]=a', 'company[x]=a', 'status=HACK', 'jobType=HACK', 'userId=forged', `search=${'x'.repeat(201)}`, 'search=%00']) {
      assert.equal((await request(`/api/jobs?${query}`, { account: first })).status, 400, `query should fail: ${query.slice(0, 40)}`)
    }
    assert.equal((await request('/api/saved-searches', { account: first, raw: '{broken' })).status, 400)
    assert.equal((await request('/api/saved-searches', { account: first, raw: JSON.stringify({ name: 'Oversized', filters, padding: 'x'.repeat(17_000) }) })).status, 413)
    console.log('PASS: bounded strict input rejects owner injection, invalid arrays/objects/pagination and malformed/oversized JSON.')
    phase = 'persisted criteria integrity'
    for (const badFilters of [{}, [], { version: 2 }]) {
      await assert.rejects(prisma.savedSearch.create({ data: { userId: first.id, name: 'Invalid direct insert', nameKey: `bad-${randomUUID()}`, filters: badFilters } }))
    }
    const corrupt = await prisma.savedSearch.create({ data: { userId: first.id, name: 'Unsupported criteria', nameKey: 'unsupported criteria', filters: { version: 1, ...DEFAULT_JOB_SEARCH_FILTERS, unexpected: true } } })
    assert.equal((await searchesFor(first)).status, 503)
    assert.deepEqual((await searchesFor(second)).body.searches.map((search) => search.name), ['RACE SEARCH'])
    assert.equal((await request(`/api/saved-searches/${corrupt.id}`, { account: first, method: 'PATCH', body: { name: 'Must roll back' } })).status, 503)
    assert.equal((await prisma.savedSearch.findUniqueOrThrow({ where: { id: corrupt.id } })).name, 'Unsupported criteria')
    assert.equal((await request(`/api/saved-searches/${corrupt.id}`, { account: first, method: 'DELETE' })).status, 204)
    const incomplete = await prisma.savedSearch.create({ data: { userId: first.id, name: 'Incomplete criteria', nameKey: 'incomplete criteria', filters: { version: 1 } } })
    assert.equal((await searchesFor(first)).status, 503)
    assert.equal((await request(`/api/saved-searches/${incomplete.id}`, { account: first, method: 'DELETE' })).status, 204)
    console.log('PASS: SQL JSON-version checks and unsupported/incomplete stored criteria fail safely without partial update.')

    phase = 'deletion preservation and cascade'
    const beforeJobs = await prisma.job.findMany({ where: { userId: first.id }, orderBy: { id: 'asc' } })
    const beforeNotes = await prisma.note.findMany({ where: { userId: first.id }, orderBy: { id: 'asc' } })
    assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: first, method: 'DELETE' })).status, 204)
    assert.equal((await request(`/api/saved-searches/${created.body.id}`, { account: first, method: 'DELETE' })).status, 404)
    assert.deepEqual(await prisma.job.findMany({ where: { userId: first.id }, orderBy: { id: 'asc' } }), beforeJobs)
    assert.deepEqual(await prisma.note.findMany({ where: { userId: first.id }, orderBy: { id: 'asc' } }), beforeNotes)
    await prisma.user.delete({ where: { id: first.id } })
    assert.equal(await prisma.savedSearch.count({ where: { userId: first.id } }), 0)
    assert.equal(await prisma.savedSearch.count({ where: { userId: second.id } }), 1)
    console.log('PASS: deleting searches leaves jobs/notes unchanged; explicit synthetic-user deletion cascades only its saved searches.')
    console.log('PASS: all 8 saved-search PostgreSQL/HTTP groups completed without mocks.')
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    try { await prisma.user.deleteMany({ where: { id: { in: users } } }) }
    finally { await prisma.$disconnect() }
  }
}

main().catch((error: unknown) => {
  console.error(`Saved-search integration failed during: ${phase}. Credentials, names and criteria were not printed.`)
  if (error instanceof Error) {
    const sanitized = error.message.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@')
    console.error(`Reason: ${sanitized}`)
    console.error(error.stack?.split('\n').filter((line) => /^\s+at /.test(line)).join('\n'))
  }
  process.exitCode = 1
})
