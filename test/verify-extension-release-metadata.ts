/**
 * Offline unit and integration tests for extension release metadata,
 * contracts, caching, SSRF guards, missing releases, and router integration.
 */
import assert from 'node:assert/strict'
import {
  isExtensionVersion,
  compareExtensionVersions,
  normalizeRepository,
  validatePublishedRelease,
  validateReleaseAvailability,
  type PublishedExtensionRelease,
} from '../server/contracts/extensionRelease'
import { ExtensionReleaseService } from '../server/services/extensionReleaseService'
import { createReleaseRouter } from '../server/routes/releases'
import { createApp } from '../server/app'
import { releaseClient } from '../src/api/extensionRelease'

let checks = 0
function check(condition: unknown, label: string): void {
  assert.ok(condition, label)
  checks++
}
function equal(actual: unknown, expected: unknown, label: string): void {
  assert.deepEqual(actual, expected, label)
  checks++
}
function rejects(action: () => unknown, label: string): void {
  assert.throws(action, undefined, label)
  checks++
}

const repository = 'Abhinavm055/Talvyn'
const validRelease: PublishedExtensionRelease = {
  schemaVersion: 1,
  distribution: 'github',
  repository,
  version: '1.3.0',
  publishedAt: '2026-10-24T00:00:00.000Z',
  downloadUrl: `https://github.com/${repository}/releases/download/v1.3.0/talvyn-extension.zip`,
  sha256: 'a'.repeat(64),
  releaseNotesUrl: `https://github.com/${repository}/releases/tag/v1.3.0`,
  title: 'Official Talvyn extension v1.3.0',
  changes: ['Reviewed autofill security', 'Manual same-folder update lifecycle'],
  extensionId: 'a'.repeat(32),
}

async function runTests(): Promise<void> {
  // ─── 1. Contract & Validator Tests ──────────────────────────────────────────
  console.log('--- 1. Testing Release Contracts & Validators ---')

  // Version format
  check(isExtensionVersion('1.3.0'), 'valid 3-part version')
  check(isExtensionVersion('1.0'), 'valid 2-part version')
  check(isExtensionVersion('0.1'), 'valid decimal version')
  check(isExtensionVersion('2026.10.24'), 'valid date-style version')
  check(!isExtensionVersion(''), 'reject empty version')
  check(!isExtensionVersion('v1.3.0'), 'reject leading v')
  check(!isExtensionVersion('1.3.0-beta'), 'reject prerelease suffix')
  check(!isExtensionVersion('0.0.0.0'), 'reject all-zero version')
  check(!isExtensionVersion('01.3.0'), 'reject leading zero in multi-digit part')
  check(!isExtensionVersion('65536.1.1'), 'reject part > 65535')

  // Version comparison
  equal(compareExtensionVersions('1.3.0', '1.2.0'), 1, 'newer version returns 1')
  equal(compareExtensionVersions('1.2.0', '1.3.0'), -1, 'older version returns -1')
  equal(compareExtensionVersions('1.3.0', '1.3.0'), 0, 'identical version returns 0')
  equal(compareExtensionVersions('1.3', '1.3.0.0'), 0, 'missing trailing zeros compare equal')
  equal(compareExtensionVersions('invalid', '1.3.0'), null, 'invalid version returns null')

  // Repository normalization
  equal(normalizeRepository('Abhinavm055/Talvyn'), 'Abhinavm055/Talvyn', 'standard owner/repo')
  equal(normalizeRepository('git@github.com:Abhinavm055/Talvyn.git'), 'Abhinavm055/Talvyn', 'SSH URL')
  equal(normalizeRepository('https://github.com/Abhinavm055/Talvyn.git'), 'Abhinavm055/Talvyn', 'HTTPS URL with .git')
  equal(normalizeRepository('https://github.com/Abhinavm055/Talvyn/'), 'Abhinavm055/Talvyn', 'HTTPS URL with trailing slash')
  equal(normalizeRepository('https://gitlab.com/Abhinavm055/Talvyn'), null, 'reject non-GitHub host')
  equal(normalizeRepository('https://evil.com/Abhinavm055/Talvyn'), null, 'reject phishing host')
  equal(normalizeRepository('https://user:pass@github.com/owner/repo'), null, 'reject URL with credentials')
  equal(normalizeRepository('https://github.com:8080/owner/repo'), null, 'reject non-standard port')
  equal(normalizeRepository('owner/../other/repo'), null, 'reject path traversal')
  equal(normalizeRepository(''), null, 'reject empty repository')

  // validatePublishedRelease
  equal(validatePublishedRelease(validRelease, repository), validRelease, 'valid published release passes')
  equal(validatePublishedRelease(validRelease, 'other-owner/Talvyn'), null, 'rejects repository mismatch')
  equal(validatePublishedRelease({ ...validRelease, schemaVersion: 2 }, repository), null, 'rejects unsupported schema')
  equal(validatePublishedRelease({ ...validRelease, distribution: 'store' }, repository), null, 'rejects non-github distribution')
  equal(validatePublishedRelease({ ...validRelease, version: 'invalid' }, repository), null, 'rejects invalid version')
  equal(validatePublishedRelease({ ...validRelease, publishedAt: '2026-99-99T00:00:00Z' }, repository), null, 'rejects invalid timestamp')
  equal(validatePublishedRelease({ ...validRelease, downloadUrl: 'https://evil.com/release.zip' }, repository), null, 'rejects untrusted download URL')
  equal(validatePublishedRelease({ ...validRelease, releaseNotesUrl: 'https://evil.com/notes' }, repository), null, 'rejects untrusted notes URL')
  equal(validatePublishedRelease({ ...validRelease, sha256: 'short' }, repository), null, 'rejects malformed sha256')
  equal(validatePublishedRelease({ ...validRelease, extensionId: 'xyz' }, repository), null, 'rejects malformed extensionId')
  equal(validatePublishedRelease({ ...validRelease, title: '' }, repository), null, 'rejects empty title')
  equal(validatePublishedRelease({ ...validRelease, changes: [] }, repository)?.changes, [], 'allows empty changes array')
  equal(validatePublishedRelease({ ...validRelease, changes: Array(25).fill('change') }, repository), null, 'rejects > 20 changes')

  // validateReleaseAvailability
  equal(
    validateReleaseAvailability({ status: 'published', release: validRelease }, repository),
    { status: 'published', release: validRelease },
    'published availability passes'
  )
  equal(
    validateReleaseAvailability({ status: 'not-published', repository }, repository),
    { status: 'not-published', repository },
    'not-published availability passes'
  )
  equal(validateReleaseAvailability({ status: 'not-published', repository: 'other/repo' }, repository), null, 'rejects not-published repo mismatch')
  equal(validateReleaseAvailability({ status: 'unknown', repository }, repository), null, 'rejects unknown status')

  // ─── 2. ExtensionReleaseService Tests ───────────────────────────────────────
  console.log('\n--- 2. Testing ExtensionReleaseService (Mock Transport) ---')

  // Constructor validation
  rejects(() => new ExtensionReleaseService('invalid'), 'rejects invalid repository name')
  rejects(() => new ExtensionReleaseService('https://evil.com/repo'), 'rejects non-github repository')

  // Successful release fetch
  let fetchCount = 0
  let clockTime = 1000
  const mockFetcherSuccess: typeof fetch = async (input, init) => {
    fetchCount++
    const url = String(input)
    if (url.includes('extension-release.json')) {
      return new Response(JSON.stringify(validRelease), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(JSON.stringify(validRelease).length) },
      })
    }
    return new Response('Not found', { status: 404 })
  }

  const service = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherSuccess,
    now: () => clockTime,
    ttlMs: 60_000,
  })

  const result1 = await service.get()
  equal(result1, { status: 'published', release: validRelease }, 'service returns published release')
  equal(fetchCount, 1, 'fetcher was called once')

  // Cache hit
  const result2 = await service.get()
  equal(result2, { status: 'published', release: validRelease }, 'service returns cached result')
  equal(fetchCount, 1, 'fetcher was not called on cache hit')

  // Expired cache fetches again
  clockTime += 65_000
  const result3 = await service.get()
  equal(result3, { status: 'published', release: validRelease }, 'service fetches after TTL expires')
  equal(fetchCount, 2, 'fetcher was called again after expiry')

  // Missing release: asset 404 + API 404 -> status: 'not-published'
  let missingFetches = 0
  const mockFetcherMissing: typeof fetch = async (input) => {
    missingFetches++
    const url = String(input)
    if (url.includes('extension-release.json')) {
      return new Response('Not found', { status: 404 })
    }
    if (url.includes('api.github.com/repos')) {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    }
    return new Response('Error', { status: 500 })
  }

  const missingService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherMissing,
    now: () => 1000,
  })
  const missingResult = await missingService.get()
  equal(missingResult, { status: 'not-published', repository }, 'missing release resolves to not-published')
  equal(missingFetches, 2, 'checked asset first, then checked GitHub releases API')

  // Missing release: asset 404 + API failure/rate-limit + web redirect to /releases -> status: 'not-published'
  let fallbackFetches = 0
  const mockFetcherFallbackRedirect: typeof fetch = async (input) => {
    fallbackFetches++
    const url = String(input)
    if (url.includes('extension-release.json')) {
      return new Response('Not found', { status: 404 })
    }
    if (url.includes('api.github.com/repos')) {
      // Simulate rate-limit 403 or network issue
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403 })
    }
    if (url.includes('github.com') && url.includes('/releases/latest')) {
      return new Response(null, {
        status: 302,
        headers: { location: `https://github.com/${repository}/releases` },
      })
    }
    return new Response('Error', { status: 500 })
  }
  const fallbackService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherFallbackRedirect,
    now: () => 1000,
  })
  const fallbackResult = await fallbackService.get()
  equal(fallbackResult, { status: 'not-published', repository }, 'fallback redirect resolves to not-published when API is rate-limited')
  equal(fallbackFetches, 3, 'checked asset, attempted API, and checked GitHub web redirect')

  // Incomplete release: asset 404 + API 200 -> throws error (release exists without metadata)
  const mockFetcherIncomplete: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes('extension-release.json')) {
      return new Response('Not found', { status: 404 })
    }
    if (url.includes('api.github.com/repos')) {
      return new Response(JSON.stringify({ tag_name: 'v1.3.0', draft: false }), { status: 200 })
    }
    return new Response('Error', { status: 500 })
  }
  const incompleteService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherIncomplete,
    now: () => 1000,
  })
  let incompleteError: Error | null = null
  try {
    await incompleteService.get()
  } catch (err) {
    incompleteError = err as Error
  }
  check(Boolean(incompleteError), 'incomplete release throws error')

  // SSRF guard: redirect to untrusted host rejected
  const mockFetcherRedirectSsrf: typeof fetch = async () => {
    return new Response(null, {
      status: 302,
      headers: { location: 'https://evil-attacker.example.com/malicious.json' },
    })
  }
  const ssrfService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherRedirectSsrf,
    now: () => 1000,
  })
  let ssrfError: Error | null = null
  try {
    await ssrfService.get()
  } catch (err) {
    ssrfError = err as Error
  }
  check(Boolean(ssrfError), 'SSRF redirect to untrusted host is blocked')

  // Oversized payload rejected (> 64KB)
  const hugeData = 'x'.repeat(70_000)
  const mockFetcherOversized: typeof fetch = async () => {
    return new Response(hugeData, {
      status: 200,
      headers: { 'Content-Length': String(hugeData.length) },
    })
  }
  const oversizedService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherOversized,
    now: () => 1000,
  })
  let sizeError: Error | null = null
  try {
    await oversizedService.get()
  } catch (err) {
    sizeError = err as Error
  }
  check(Boolean(sizeError), 'oversized metadata payload is rejected')

  // Failure cool-off behavior (cooldown prevents immediate retry)
  let failCount = 0
  let failTime = 1000
  const mockFetcherFailing: typeof fetch = async () => {
    failCount++
    throw new Error('Network error')
  }
  const failingService = new ExtensionReleaseService(repository, {
    fetcher: mockFetcherFailing,
    now: () => failTime,
  })
  try { await failingService.get() } catch { /* expected */ }
  equal(failCount, 1, 'first call failed')
  // Second call within 15 seconds cooldown
  failTime += 5000
  try { await failingService.get() } catch (err) {
    check((err as Error).message.includes('temporarily unavailable'), 'cooldown active')
  }
  equal(failCount, 1, 'second call during cooldown did not invoke fetcher')

  // ─── 3. Release Router Integration Tests ───────────────────────────────────
  console.log('\n--- 3. Testing Release Router (/api/releases/extension) ---')

  // Case A: Router with valid mock service
  const routerWithService = createReleaseRouter({
    get: async () => ({ status: 'published', release: validRelease }),
  })
  let resStatus = 0
  let resBody: unknown = null
  const headers = new Map<string, string>()
  const mockRes = {
    setHeader: (name: string, val: string) => { headers.set(name.toLowerCase(), val); return mockRes },
    status: (code: number) => { resStatus = code; return mockRes },
    json: (data: unknown) => { resBody = data; return mockRes },
  }
  // Call handler
  await new Promise<void>((resolve) => {
    routerWithService({ method: 'GET', url: '/extension', headers: {} } as any, mockRes as any, () => resolve())
    // router executes synchronously or resolves through promise
    setTimeout(resolve, 50)
  })
  equal(resBody, { status: 'published', release: validRelease }, 'router returns published metadata')
  equal(headers.get('x-content-type-options'), 'nosniff', 'sets nosniff header')
  equal(headers.get('cache-control'), 'public, max-age=60, s-maxage=300', 'sets public cache header on success')

  // Case B: Router when service fails
  const routerWithFailingService = createReleaseRouter({
    get: async () => { throw new Error('Service down') },
  })
  let failResStatus = 0
  let failResBody: unknown = null
  const failHeaders = new Map<string, string>()
  const mockFailRes = {
    setHeader: (name: string, val: string) => { failHeaders.set(name.toLowerCase(), val); return mockFailRes },
    status: (code: number) => { failResStatus = code; return mockFailRes },
    json: (data: unknown) => { failResBody = data; return mockFailRes },
  }
  await new Promise<void>((resolve) => {
    routerWithFailingService({ method: 'GET', url: '/extension', headers: {} } as any, mockFailRes as any, () => resolve())
    setTimeout(resolve, 50)
  })
  equal(failResStatus, 503, 'returns 503 on service failure')
  equal(failHeaders.get('cache-control'), 'no-store', 'sets no-store on failure')

  // Case C: Router with no repository / service configured
  const emptyRouter = createReleaseRouter({
    get: null as any,
  })
  // If reader is null:
  const nullReaderRouter = createReleaseRouter(undefined)
  // Save TALVYN_GITHUB_REPOSITORY temporarily if set
  const savedRepo = process.env.TALVYN_GITHUB_REPOSITORY
  delete process.env.TALVYN_GITHUB_REPOSITORY

  // Case D: Full Express app route unauthenticated access to /api/releases/extension
  const app = createApp()
  const server = app.listen(0)
  try {
    const port = (server.address() as any).port
    const releaseRes = await fetch(`http://127.0.0.1:${port}/api/releases/extension`)
    check(releaseRes.status !== 401, 'unauthenticated /api/releases/extension is never blocked with 401')
    const releaseBody = await releaseRes.json()
    check(releaseBody.error !== 'Sign in to continue', 'unauthenticated release route never returns "Sign in to continue"')

    // Protected routes must still require authentication
    const notesRes = await fetch(`http://127.0.0.1:${port}/api/notes/1`)
    equal(notesRes.status, 401, 'notes route still requires authentication')
    const notesBody = await notesRes.json()
    equal(notesBody.error, 'Sign in to continue', 'notes route returns "Sign in to continue"')
  } finally {
    server.close()
  }

  // ─── 4. Client releaseClient Tests ─────────────────────────────────────────
  console.log('\n--- 4. Testing releaseClient.load ---')

  const originalFetch = globalThis.fetch
  try {
    // Client receives valid release from API
    globalThis.fetch = (async (url: string) => {
      check(url === '/api/releases/extension', 'client calls /api/releases/extension')
      return new Response(JSON.stringify({ status: 'published', release: validRelease }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    // Temporarily ensure releaseClient is set to the test repository
    const clientRepo = releaseClient.repository
    Object.assign(releaseClient, { repository })
    const loaded = await releaseClient.load()
    equal(loaded, { status: 'published', release: validRelease }, 'client validates and returns published release')

    // Client handles not-published
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ status: 'not-published', repository }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    const loadedNotPublished = await releaseClient.load()
    equal(loadedNotPublished, { status: 'not-published', repository }, 'client handles not-published release')

    // Client rejects HTTP 503 and preserves user-friendly message
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'Release metadata could not be verified. Please retry later.' }), { status: 503 })
    }) as typeof fetch
    let clientError: Error | null = null
    try {
      await releaseClient.load()
    } catch (err) {
      clientError = err as Error
    }
    check(Boolean(clientError), 'client throws on non-200 HTTP response')
    check(clientError?.message === 'Release metadata could not be verified. Please retry later.', 'client preserves server error reason')

    // Client rejects missing/invalid asset URL in published release payload
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        status: 'published',
        release: { ...validRelease, downloadUrl: 'https://attacker.example.com/malicious.zip' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    let invalidAssetError: Error | null = null
    try {
      await releaseClient.load()
    } catch (err) {
      invalidAssetError = err as Error
    }
    check(Boolean(invalidAssetError), 'client rejects release with untrusted download URL')

    // Restore
    Object.assign(releaseClient, { repository: clientRepo })
  } finally {
    globalThis.fetch = originalFetch
    if (savedRepo !== undefined) process.env.TALVYN_GITHUB_REPOSITORY = savedRepo
  }

  console.log(`\nPASS: ${checks} release metadata, missing release, caching, SSRF, router, and client checks passed.`)
}

runTests().catch((err) => {
  console.error('Release metadata test runner failed:', err)
  process.exit(1)
})
