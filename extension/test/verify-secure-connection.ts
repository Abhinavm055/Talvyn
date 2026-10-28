/** Runtime message tests use an isolated mocked Chrome worker, never the live API. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createPairingSecret, isAllowedApiRequest, isExactAllowedOrigin, validateSessionResponse } from '../src/services/secureConnection'

async function main(): Promise<void> {
const user = { id: 'user_one', email: 'one@example.test', profile: null }
const token = (claims: object) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
function credentials(sessionId = 'session_one', identity = user.id, exp = Math.floor(Date.now() / 1000) + 900) {
  return { sessionId, accessToken: token({ tokenUse: 'extension_access', sessionId, userId: identity, exp }),
    refreshToken: token({ tokenUse: 'extension_refresh', sessionId }), expiresIn: 900, user }
}

assert.equal(isExactAllowedOrigin('https://talvyn.vercel.app/extensions', ['https://talvyn.vercel.app']), true)
for (const url of ['https://talvyn.vercel.app.evil.test', 'https://evil.test/talvyn.vercel.app', 'http://localhost:5173', 'https://talvyn.vercel.app:444', 'javascript:alert(1)']) {
  assert.equal(isExactAllowedOrigin(url, ['https://talvyn.vercel.app']), false, `reject ${url}`)
}
for (const path of ['/api/auth/login', '/api/auth/extension-sessions/refresh', '/api/auth/extension-pairing/exchange', '//evil.test', '/api/jobs/../auth/me', '/api/jobs/%2e%2e/auth/me', '/api/jobs\\..\\auth', '/api/jobs#fragment']) {
  assert.equal(isAllowedApiRequest(path, 'POST'), false, `blocked proxy path ${path}`)
}
assert.equal(isAllowedApiRequest('/api/jobs/check-url?url=https%3A%2F%2Fexample.test%2Fjob', 'GET'), true)
assert.equal(isAllowedApiRequest('/api/jobs/one/timeline', 'POST'), true)
assert.equal(isAllowedApiRequest('/api/jobs/one/status', 'GET'), false)
const secret = await createPairingSecret()
assert.match(secret.verifier, /^[A-Za-z0-9_-]{43}$/)
assert.equal(secret.challenge, createHash('sha256').update(secret.verifier).digest('hex'))
assert.notEqual(secret.verifier, (await createPairingSecret()).verifier)
assert.ok(validateSessionResponse(credentials(), user))
assert.equal(validateSessionResponse(credentials('other', 'impostor'), user), null)
assert.equal(validateSessionResponse(credentials('session_one', user.id, 1), user), null)
assert.equal(validateSessionResponse({ ...credentials(), refreshToken: token({ tokenUse: 'extension_refresh', sessionId: 'other' }) }, user), null)

const values: Record<string, any> = {}
const listeners: Record<string, any> = {}
const calls: { url: string; options: RequestInit }[] = []
let approved = false
let unavailable = false
let stalledBody = false
let oversizedBody = false
let revoked = false
let refreshCount = 0
let revokeCount = 0
let deferredRequest: { path: string; onStart: () => void; response: Promise<Response> } | null = null
const requestId = '01234567-89ab-cdef-0123-456789abcdef'
const chromeMock = {
  runtime: { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', lastError: null, getManifest: () => ({ version: '1.3.0', content_scripts: [] }),
    onMessage: { addListener: (listener: any) => { listeners.internal = listener } },
    onMessageExternal: { addListener: (listener: any) => { listeners.external = listener } },
    onInstalled: { addListener: (listener: any) => { listeners.installed = listener } },
    onStartup: { addListener: (listener: any) => { listeners.startup = listener } } },
  storage: { local: {
    setAccessLevel: async (input: any) => { assert.equal(input.accessLevel, 'TRUSTED_CONTEXTS') },
    get: async (keys: string | string[] | null) => keys === null ? structuredClone(values) : Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map((key) => [key, structuredClone(values[key])])),
    set: async (input: any) => { Object.assign(values, structuredClone(input)) },
    remove: async (keys: string | string[]) => { for (const key of typeof keys === 'string' ? [keys] : keys) delete values[key] },
  } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, onClicked: { addListener: () => {} } },
  tabs: { create: async () => ({ id: 1 }), query: async () => [], sendMessage: async () => ({ success: true }) },
  permissions: { contains: async () => false },
}
Object.assign(globalThis, { chrome: chromeMock })
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, options = {}) => {
  const url = String(input)
  calls.push({ url, options })
  if (unavailable) throw new Error('Simulated API outage')
  const path = new URL(url).pathname
  if (deferredRequest?.path === path) {
    const held = deferredRequest
    deferredRequest = null
    held.onStart()
    return held.response
  }
  if (path.endsWith('/extension-pairing/start')) return Response.json({ requestId, expiresAt: new Date(Date.now() + 300_000).toISOString() })
  if (path.endsWith('/extension-pairing/exchange')) {
    const body = JSON.parse(String(options.body))
    assert.equal(body.verifier, values.talvyn_pending_pairing.verifier)
    return approved ? Response.json(credentials(), { status: 201 }) : Response.json({ pending: true }, { status: 202 })
  }
  if (path.endsWith('/extension-sessions/refresh')) { refreshCount++; return revoked ? Response.json({ error: 'Revoked session' }, { status: 401 }) : Response.json(credentials()) }
  if (path.endsWith('/extension-sessions/revoke')) { revokeCount++; return Response.json({ success: true }) }
  if (path.endsWith('/auth/me')) {
    if (stalledBody) return new Response(new ReadableStream<Uint8Array>({ start() { /* Simulated headers received, body never completes. */ } }))
    if (revoked) return Response.json({ error: 'Revoked session' }, { status: 401 })
    return Response.json(user)
  }
  if (path.endsWith('/jobs/check-url')) return Response.json({ exists: false, job: null })
  if (path.endsWith('/jobs')) return oversizedBody ? new Response(new Uint8Array(8 * 1024 * 1024 + 1)) : Response.json({ jobs: [], total: 0 })
  throw new Error(`Unexpected test API route ${path}`)
}
try {
  await import('../src/background/index')
  const website = { url: 'http://localhost:5173/extension/connect' }
  const popup = { id: chromeMock.runtime.id, url: `chrome-extension://${chromeMock.runtime.id}/src/popup/index.html` }
  const content = { id: chromeMock.runtime.id, url: 'https://example.test/job', tab: { id: 7 } }
  const message = (kind: 'internal' | 'external', data: any, sender: any): Promise<any> => new Promise((resolve) => listeners[kind](data, sender, resolve))
  const deferNextRequest = (path: string) => {
    let onStart!: () => void
    let release!: (response: Response) => void
    const started = new Promise<void>((resolve) => { onStart = resolve })
    const response = new Promise<Response>((resolve) => { release = resolve })
    deferredRequest = { path, onStart, response }
    return { started, release }
  }
  const ping = await message('external', { type: 'TALVYN_PING_EXTENSION' }, website)
  assert.deepEqual(ping, { success: true, installed: true, version: '1.3.0', protocolVersion: 2 })
  assert.equal(calls.length, 0, 'installation discovery never depends on the API')
  assert.equal((await message('external', { type: 'TALVYN_PING_EXTENSION' }, { url: 'https://evil.test' })).success, false)
  assert.equal((await message('external', { type: 'TALVYN_CONNECT_EXTENSION', ...credentials() }, website)).success, false, 'legacy token handoff is rejected')
  assert.equal((await message('internal', { type: 'SET_LOCAL_AI_SETTINGS', settings: {} }, content)).success, false, 'content cannot write local AI settings')
  assert.equal((await message('internal', { type: 'GET_AUTH' }, { id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', url: content.url })).success, false, 'sender identity is browser verified')
  const application = { id: 'application_one', pageUrl: content.url, startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), accessToken: 'injected', jobTitle: 'Engineer' }
  assert.equal((await message('internal', { type: 'TALVYN_APPLICATION_SESSION', action: 'set', session: application }, content)).success, true)
  assert.equal(values.talvyn_active_application_session.accessToken, undefined, 'application bridge sanitizes all unexpected fields')
  assert.equal((await message('internal', { type: 'TALVYN_APPLICATION_SESSION', action: 'set', session: { ...application, pageUrl: 'javascript:alert(1)' } }, content)).success, false)
  assert.equal((await message('internal', { type: 'TALVYN_API_REQUEST', path: '/api/auth/extension-sessions/refresh', method: 'POST' }, content)).success, false)
  const started = await Promise.all([message('external', { type: 'TALVYN_START_CONNECTION' }, website), message('external', { type: 'TALVYN_START_CONNECTION' }, website)])
  assert.equal(started[0].requestId, requestId)
  assert.equal(calls.filter((call) => call.url.endsWith('/start')).length, 1, 'duplicate connection requests are coalesced')
  assert.equal(JSON.stringify(started).includes('verifier'), false, 'website receives no pairing secret')
  assert.equal((await message('external', { type: 'TALVYN_GET_PAIRING_REQUEST', requestId: 'attacker_created_request' }, website)).success, false)
  assert.equal((await message('external', { type: 'TALVYN_GET_PAIRING_REQUEST', requestId }, website)).success, true)
  assert.equal((await message('external', { type: 'TALVYN_COMPLETE_CONNECTION', requestId }, website)).pending, true)
  assert.equal(revokeCount, 0, 'unapproved connection does not revoke an existing account')
  assert.equal(values.talvynAuth, undefined)
  approved = true
  const completed = await message('external', { type: 'TALVYN_COMPLETE_CONNECTION', requestId }, website)
  assert.deepEqual(completed, { success: true, user: { id: user.id, email: user.email } })
  assert.equal(values.talvyn_pending_pairing, undefined)
  assert.equal(values.talvyn_active_application_session, undefined, 'account connection clears previous account application context')
  assert.equal(values.talvyn_token, undefined, 'legacy duplicated credential key is absent')
  const status = await message('external', { type: 'TALVYN_GET_STATUS' }, website)
  assert.equal(status.connectionState, 'connected')
  assert.equal(JSON.stringify(status).includes('accessToken'), false)
  assert.equal(JSON.stringify(status).includes('refreshToken'), false)
  assert.equal('token' in status, false)
  const auth = await message('internal', { type: 'GET_AUTH' }, content)
  assert.equal(auth.authenticated, true)
  assert.equal('token' in auth, false)
  const staleProfile = deferNextRequest('/api/profile')
  const oldProfileRequest = message('internal', { type: 'TALVYN_API_REQUEST', path: '/api/profile' }, content)
  await staleProfile.started
  assert.equal((await message('internal', { type: 'DISCONNECT_TALVYN' }, popup)).success, true)
  await message('external', { type: 'TALVYN_START_CONNECTION' }, website)
  assert.equal((await message('external', { type: 'TALVYN_COMPLETE_CONNECTION', requestId }, website)).success, true)
  staleProfile.release(Response.json({ email: 'previous-account@example.test', skills: ['Private old profile'] }))
  const oldProfileResult = await oldProfileRequest
  assert.equal(oldProfileResult.success, false, 'previous-session data is not returned after reconnect')
  assert.equal(oldProfileResult.status, 409)
  assert.equal(values.talvynAuth.user.profile, null, 'previous-session profile cannot contaminate the new session')
  const staleStatus = deferNextRequest('/api/auth/me')
  const oldStatusRequest = message('external', { type: 'TALVYN_GET_STATUS' }, website)
  await staleStatus.started
  assert.equal((await message('internal', { type: 'DISCONNECT_TALVYN' }, popup)).success, true)
  await message('external', { type: 'TALVYN_START_CONNECTION' }, website)
  assert.equal((await message('external', { type: 'TALVYN_COMPLETE_CONNECTION', requestId }, website)).success, true)
  staleStatus.release(Response.json({ error: 'Old session revoked' }, { status: 401 }))
  assert.equal((await oldStatusRequest).connectionState, 'reconnecting')
  assert.ok(values.talvynAuth, 'previous-session 401 cannot invalidate a new connection')
  values.talvynAuth.token = credentials('session_one', user.id, 1).accessToken
  await Promise.all([message('internal', { type: 'GET_AUTH_STATUS' }, popup), message('internal', { type: 'GET_AUTH' }, content)])
  assert.equal(refreshCount, 1, 'concurrent expired-session requests share one renewal')
  const api = await message('internal', { type: 'TALVYN_API_REQUEST', path: '/api/jobs', method: 'GET', headers: { Authorization: 'Bearer injected', 'X-Evil': 'injected' } }, content)
  assert.equal(api.success, true)
  const last = calls[calls.length - 1]
  assert.equal(new Headers(last.options.headers).get('X-Evil'), null)
  assert.equal(new Headers(last.options.headers).get('Authorization'), `Bearer ${values.talvynAuth.token}`)
  oversizedBody = true
  assert.equal((await message('internal', { type: 'TALVYN_API_REQUEST', path: '/api/jobs' }, content)).success, false, 'oversized bodies are rejected before JSON parsing')
  oversizedBody = false
  stalledBody = true
  const stalledAt = Date.now()
  assert.equal((await message('external', { type: 'TALVYN_GET_STATUS' }, website)).connectionState, 'reconnecting', 'body stall after headers is bounded and never marks connected')
  assert.ok(Date.now() - stalledAt < 18_000, 'the body uses the same request deadline')
  stalledBody = false
  unavailable = true
  assert.equal((await message('external', { type: 'TALVYN_GET_STATUS' }, website)).connectionState, 'reconnecting')
  assert.equal((await message('internal', { type: 'DISCONNECT_TALVYN' }, popup)).success, false, 'outage cannot be reported as confirmed revocation')
  assert.ok(values.talvynAuth, 'unconfirmed disconnect retains credentials for later revocation')
  unavailable = false
  values.talvyn_active_application_session = { ...application }
  assert.equal((await message('internal', { type: 'DISCONNECT_TALVYN' }, popup)).state, 'disconnected')
  assert.equal(values.talvynAuth, undefined)
  assert.equal(values.talvyn_active_application_session, undefined, 'confirmed disconnect clears account context')
  const restored = credentials()
  values.talvynAuth = { token: restored.accessToken, refreshToken: restored.refreshToken, sessionId: restored.sessionId, user, connectedAt: new Date().toISOString() }
  values.talvyn_active_application_session = { ...application }
  revoked = true
  assert.equal((await message('external', { type: 'TALVYN_GET_STATUS' }, website)).connectionState, 'reconnect-required')
  assert.equal(values.talvynAuth, undefined)
  assert.equal(values.talvyn_active_application_session, undefined, 'server revocation clears account context')
  console.log('Secure extension connection checks passed (origin, pairing, private storage, verified status, proxy, refresh, revocation).')
} finally { globalThis.fetch = originalFetch }
}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
