/** MV3 service worker: trusted credential owner and one-time account pairing. */
import { TalvynAuthSession, getAuthSession, setAuthSession, clearAuth, STORAGE_KEYS } from '../utils/storage'
import { CONFIG, DashboardRoute, getDashboardRouteUrl } from '../utils/config'
import { isGenuineUpgrade } from '../services/releaseLifecycle'
import { PAIRING_REQUEST_PATTERN, createPairingSecret, decodeTokenClaims, isAllowedApiRequest, isExactAllowedOrigin, validateSessionResponse } from '../services/secureConnection'
import { analyzeLocalJob, detectLocalAi, validateLocalAiSettings, LocalAiSettings } from '../services/localAi'
import type { ApplicationSession } from '../types'

const PAIRING_KEY = 'talvyn_pending_pairing'
const LOCAL_AI_KEY = 'talvyn_local_ai'
const RECONNECT_KEY = 'talvyn_reconnect_required'
const APPLICATION_SESSION_KEY = 'talvyn_active_application_session'
const DEFAULT_LOCAL_AI: LocalAiSettings = { enabled: false, consent: false, endpoint: 'http://127.0.0.1:11434', model: 'llama3.2' }
interface PendingPairing { requestId: string; verifier: string; expiresAt: string }

// This restriction also covers old installations before migrating their credentials.
const trustedStorageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
let authGeneration = 0
let refreshInFlight: Promise<TalvynAuthSession | null> | null = null
let pairingInFlight: Promise<any> | null = null
let startPairingInFlight: Promise<any> | null = null

async function boundedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const maximumBodyBytes = 8 * 1024 * 1024
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error('Talvyn API request timed out.'))
    }, 12_000)
  })
  try {
    const response = await Promise.race([fetch(url, { ...options, signal: controller.signal, credentials: 'omit', redirect: 'error' }), timeout])
    if (!response.body) return response
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > maximumBodyBytes) {
        controller.abort()
        throw new Error('Talvyn API response exceeded its size limit.')
      }
      chunks.push(chunk.value)
    }
    const buffer = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
    return new Response(buffer, { status: response.status, statusText: response.statusText, headers: response.headers })
  } finally {
    clearTimeout(timeoutId!)
    // A stalled stream must not delay timeout cleanup or hold credentials in a task.
    void reader?.cancel().catch(() => {})
  }
}

function setBadge(state: 'on' | 'off'): void {
  void chrome.action.setBadgeText({ text: state === 'on' ? '✓' : '' })
  if (state === 'on') void chrome.action.setBadgeBackgroundColor({ color: '#6366f1' })
}

async function invalidateSession(): Promise<void> {
  authGeneration++
  await clearAuth()
  await clearAccountData()
  await chrome.storage.local.set({ [RECONNECT_KEY]: true })
  setBadge('off')
}

async function refreshAuthSession(): Promise<TalvynAuthSession | null> {
  if (refreshInFlight) return refreshInFlight
  const generation = authGeneration
  refreshInFlight = (async () => {
    const current = await getAuthSession()
    if (!current?.refreshToken || !current.sessionId) return null
    const response = await boundedFetch(`${CONFIG.API_BASE}/api/auth/extension-sessions/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    if (!response.ok) {
      if (generation === authGeneration && (response.status === 401 || response.status === 403)) await invalidateSession()
      throw Object.assign(new Error('Could not renew the extension session.'), { status: response.status })
    }
    const result = await response.json()
    const verified = validateSessionResponse(result, result.user)
    if (!verified || verified.sessionId !== current.sessionId || verified.user.id !== current.user.id) {
      if (generation === authGeneration) await invalidateSession()
      throw new Error('Invalid extension session returned by the server.')
    }
    if (generation !== authGeneration) return null
    const updated = { ...verified, connectedAt: current.connectedAt }
    await setAuthSession(updated)
    return updated
  })()
  try { return await refreshInFlight } finally { refreshInFlight = null }
}

async function getValidAuthSession(): Promise<TalvynAuthSession | null> {
  await trustedStorageReady
  const session = await getAuthSession()
  if (!session) return null
  if (!session.sessionId || !session.refreshToken || !session.user || typeof session.user.id !== 'string' || typeof session.user.email !== 'string') { await invalidateSession(); return null }
  const claims = decodeTokenClaims(session.token)
  if (claims?.tokenUse !== 'extension_access' || claims.sessionId !== session.sessionId || claims.userId !== session.user.id) {
    await invalidateSession(); return null
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now() + 60_000) return refreshAuthSession()
  return session
}

async function fetchAuthorized(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const generation = authGeneration
  const session = await getValidAuthSession()
  if (generation !== authGeneration) throw Object.assign(new Error('The connected account changed. Please retry.'), { status: 409 })
  if (!session?.token) throw Object.assign(new Error('Reconnect your Talvyn account.'), { status: 401 })
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.set('Authorization', `Bearer ${session.token}`)
  const response = await boundedFetch(`${CONFIG.API_BASE}${path}`, { ...options, headers })
  // A request sent for a previous account must never be retried as the new
  // account, clear its credentials, or return the old account's private data.
  if (generation !== authGeneration) throw Object.assign(new Error('The connected account changed. Please retry.'), { status: 409 })
  if (response.status === 401 && retry) {
    const renewed = await refreshAuthSession()
    if (generation !== authGeneration) throw Object.assign(new Error('The connected account changed. Please retry.'), { status: 409 })
    if (renewed) return fetchAuthorized(path, options, false)
  }
  if (response.status === 401) await invalidateSession()
  return response
}

async function revokeCurrentExtensionSession(): Promise<boolean> {
  const current = await getAuthSession()
  if (!current) return true
  if (!current.sessionId || !current.refreshToken) { await invalidateSession(); return true }
  try {
    const response = await fetchAuthorized('/api/auth/extension-sessions/revoke', {
      method: 'POST', body: JSON.stringify({ sessionId: current.sessionId }),
    })
    return response.ok || response.status === 401 || response.status === 403
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) return true
    return false
  }
}

async function disconnect(): Promise<any> {
  // Do not claim server revocation when an outage prevents confirmation.
  if (!(await revokeCurrentExtensionSession())) {
    return { success: false, state: 'reconnecting', error: 'Could not confirm disconnect with Talvyn. Please retry when the service is available.' }
  }
  authGeneration++
  await clearAuth()
  await clearAccountData()
  await chrome.storage.local.remove([PAIRING_KEY, RECONNECT_KEY])
  setBadge('off')
  return { success: true, state: 'disconnected' }
}

async function readPendingPairing(): Promise<PendingPairing | null> {
  await trustedStorageReady
  const values = await chrome.storage.local.get(PAIRING_KEY)
  const pending = values[PAIRING_KEY] as PendingPairing | undefined
  if (!pending || !PAIRING_REQUEST_PATTERN.test(pending.requestId) || typeof pending.verifier !== 'string') return null
  if (!Number.isFinite(Date.parse(pending.expiresAt)) || Date.parse(pending.expiresAt) <= Date.now()) {
    await chrome.storage.local.remove(PAIRING_KEY)
    return null
  }
  return pending
}

async function startPairing(): Promise<any> {
  if (startPairingInFlight) return startPairingInFlight
  startPairingInFlight = (async () => {
    await trustedStorageReady
    const existing = await readPendingPairing()
    if (existing) return { success: true, requestId: existing.requestId, expiresAt: existing.expiresAt }
    const secret = await createPairingSecret()
    const response = await boundedFetch(`${CONFIG.API_BASE}/api/auth/extension-pairing/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId: chrome.runtime.id, challenge: secret.challenge }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return { success: false, error: result.error || 'Talvyn could not start connection. Please retry.', status: response.status }
    if (!PAIRING_REQUEST_PATTERN.test(result.requestId) || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) {
      return { success: false, error: 'Invalid connection request from Talvyn.' }
    }
    await chrome.storage.local.set({ [PAIRING_KEY]: { ...secret, requestId: result.requestId, expiresAt: result.expiresAt } })
    return { success: true, requestId: result.requestId, expiresAt: result.expiresAt }
  })()
  try { return await startPairingInFlight } finally { startPairingInFlight = null }
}

async function completePairing(requestId: string): Promise<any> {
  const pending = await readPendingPairing()
  if (!pending || requestId !== pending.requestId) return { success: false, error: 'This connection request expired or does not belong to this extension.' }
  if (pairingInFlight) return pairingInFlight
  const generation = authGeneration
  pairingInFlight = (async () => {
    const response = await boundedFetch(`${CONFIG.API_BASE}/api/auth/extension-pairing/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, verifier: pending.verifier }),
    })
    const result = await response.json().catch(() => ({}))
    if (response.status === 202 && result.pending === true) {
      return { success: false, pending: true, status: 202, error: 'Approve the connection on the Talvyn website.' }
    }
    if (!response.ok) {
      if ([400, 401, 404, 410].includes(response.status)) await chrome.storage.local.remove(PAIRING_KEY)
      return { success: false, pending: response.status === 409 || response.status === 202, status: response.status, error: result.error || 'Approve the connection on the Talvyn website.' }
    }
    const me = await boundedFetch(`${CONFIG.API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${result.accessToken}` } })
    if (!me.ok) return { success: false, error: 'Talvyn could not verify the new session. Please reconnect.' }
    const user = await me.json()
    const verified = validateSessionResponse(result, user)
    if (!verified) return { success: false, error: 'Talvyn returned inconsistent connection credentials.' }
    // A pending, unapproved request must never disconnect the existing account.
    const previousRevoked = generation === authGeneration && await revokeCurrentExtensionSession()
    if (generation !== authGeneration || !previousRevoked) {
      await boundedFetch(`${CONFIG.API_BASE}/api/auth/extension-sessions/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${verified.token}` },
        body: JSON.stringify({ sessionId: verified.sessionId }),
      }).catch(() => null)
      await chrome.storage.local.remove(PAIRING_KEY)
      return { success: false, error: 'Could not replace the previous session safely. Retry the connection.' }
    }
    authGeneration++
    await setAuthSession(verified)
    await chrome.storage.local.remove([PAIRING_KEY, RECONNECT_KEY])
    await clearAccountData()
    setBadge('on')
    return { success: true, user: { id: user.id, email: user.email } }
  })()
  try { return await pairingInFlight } finally { pairingInFlight = null }
}

async function clearAccountData(): Promise<void> {
  const values = await chrome.storage.local.get(null)
  const keys = Object.keys(values).filter((key) =>
    key === STORAGE_KEYS.LAST_JOB || key === 'talvyn_last_scan_summary' || key === APPLICATION_SESSION_KEY ||
    /^(talvyn_(?:application|autofill|save_queue|job_cache|profile_cache))/.test(key))
  if (keys.length) await chrome.storage.local.remove(keys)
}

async function getAuthStatus(resumePending = false): Promise<any> {
  await trustedStorageReady
  if (resumePending) {
    const pending = await readPendingPairing()
    if (pending) {
      const completed = await completePairing(pending.requestId).catch(() => null)
      if (completed?.success) {
        const session = await getAuthSession()
        if (session) return { success: true, state: 'connected', user: session.user }
      }
    }
  }
  const current = await getAuthSession()
  if (!current) {
    const values = await chrome.storage.local.get(RECONNECT_KEY)
    setBadge('off')
    return { success: true, state: values[RECONNECT_KEY] ? 'reconnect-required' : 'disconnected', user: null }
  }
  const generation = authGeneration
  try {
    const response = await fetchAuthorized('/api/auth/me')
    if (response.status === 401 || response.status === 403) {
      await invalidateSession()
      return { success: true, state: 'reconnect-required', user: null }
    }
    if (!response.ok) return { success: true, state: 'reconnecting', user: null, error: 'Talvyn could not verify the connection. Retry when the service is available.' }
    const user = await response.json()
    if (generation !== authGeneration) return { success: true, state: 'reconnecting', user: null, error: 'The connected account changed. Retry to verify it.' }
    const live = await getAuthSession()
    if (!live || user.id !== live.user.id) { await invalidateSession(); return { success: true, state: 'reconnect-required', user: null } }
    await setAuthSession({ ...live, user })
    setBadge('on')
    return { success: true, state: 'connected', user }
  } catch (error: any) {
    return { success: true, state: error?.status === 401 || error?.status === 403 ? 'reconnect-required' : 'reconnecting', user: null,
      error: 'Unable to verify your connection. Please retry.' }
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  await trustedStorageReady
  const version = chrome.runtime.getManifest().version
  await chrome.storage.local.set({ talvyn_installed_version: version })
  if (reason === 'install') {
    await clearAuth(); setBadge('off')
    await chrome.storage.local.remove(['talvyn_pending_release_version', PAIRING_KEY, RECONNECT_KEY])
  } else if (isGenuineUpgrade(reason, previousVersion, version)) {
    await chrome.storage.local.set({ talvyn_pending_release_version: version })
  }
  // Legacy website tokens require fresh explicit pairing.
  await chrome.storage.local.remove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER])
  await getAuthStatus(true)
})
chrome.runtime.onStartup.addListener(() => { void getAuthStatus(true) })

function isInternalSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && Boolean(sender.url || sender.origin)
}
function isTrustedUiSender(sender: chrome.runtime.MessageSender): boolean {
  const url = sender.url || sender.origin || ''
  return isInternalSender(sender) && url.startsWith(`chrome-extension://${chrome.runtime.id}/`) && !sender.tab
}

async function proxyRequest(msg: any): Promise<any> {
  const generation = authGeneration
  const method = typeof msg.method === 'string' ? msg.method.toUpperCase() : 'GET'
  if (!isAllowedApiRequest(msg.path, method)) return { success: false, status: 400, error: 'This API request is not permitted.' }
  let body: string | undefined
  try {
    if (msg.body !== undefined && !['GET', 'DELETE'].includes(method)) body = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body)
    if (body && body.length > 1_000_000) throw new Error('Request too large')
  } catch { return { success: false, status: 400, error: 'Invalid API payload.' } }
  try {
    const response = await fetchAuthorized(msg.path, { method, body })
    const data = response.status === 204 ? undefined : await response.json().catch(() => ({}))
    if (generation !== authGeneration) return { success: false, status: 409, error: 'The connected account changed. Please retry.' }
    if (!response.ok) return { success: false, status: response.status, body: data, job: data?.job, error: data?.error || (response.status === 401 ? 'Reconnect your Talvyn account.' : 'Talvyn could not complete this request. Please retry.') }
    if (msg.path === '/api/profile' && data) {
      const current = await getAuthSession()
      if (current) await setAuthSession({ ...current, user: { ...current.user, profile: data } })
    }
    return { success: true, status: response.status, data, payload: data, job: data }
  } catch (error: any) {
    return { success: false, status: error?.status || 0, error: error?.status === 401 ? 'Reconnect your Talvyn account.' : 'Connection problem. Please retry.' }
  }
}

async function readLocalAiSettings(): Promise<LocalAiSettings> {
  const values = await chrome.storage.local.get(LOCAL_AI_KEY)
  try { return validateLocalAiSettings(values[LOCAL_AI_KEY] || DEFAULT_LOCAL_AI) || DEFAULT_LOCAL_AI }
  catch { return DEFAULT_LOCAL_AI }
}
async function hasLocalAiPermission(settings: LocalAiSettings): Promise<boolean> {
  const endpoint = new URL(settings.endpoint)
  return chrome.permissions.contains({ origins: [`${endpoint.protocol}//${endpoint.hostname}/*`] })
}

async function handleInternalMessage(msg: any, sender: chrome.runtime.MessageSender): Promise<any> {
  await trustedStorageReady
  if (!isInternalSender(sender) || !msg || typeof msg !== 'object' || typeof msg.type !== 'string') return { success: false, error: 'Invalid extension message.' }
  const trustedUi = isTrustedUiSender(sender)
  if (msg.type === 'TALVYN_APPLICATION_SESSION') {
    if (msg.action === 'get') {
      const values = await chrome.storage.local.get(APPLICATION_SESSION_KEY)
      return { success: true, session: values[APPLICATION_SESSION_KEY] || null }
    }
    if (msg.action === 'clear') {
      await chrome.storage.local.remove(APPLICATION_SESSION_KEY)
      return { success: true }
    }
    if (msg.action !== 'set') return { success: false, error: 'Invalid application session action.' }
    const session = sanitizeApplicationSession(msg.session)
    if (!session) return { success: false, error: 'Invalid application session.' }
    await chrome.storage.local.set({ [APPLICATION_SESSION_KEY]: session })
    return { success: true, session }
  }
  if (msg.type === 'GET_AUTH' || msg.type === 'GET_AUTH_STATUS') {
    const status = await getAuthStatus(true)
    if (msg.type === 'GET_AUTH_STATUS') return status
    return { success: true, authenticated: status.state === 'connected', user: status.user,
      type: 'AUTH_STATE', payload: { isAuthenticated: status.state === 'connected', user: status.user } }
  }
  if (msg.type === 'TALVYN_API_REQUEST') return proxyRequest(msg)
  if (msg.type === 'TALVYN_SAVE_JOB' || msg.type === 'SAVE_JOB') return proxyRequest({ path: '/api/jobs', method: 'POST', body: msg.payload || msg.job })
  if (msg.type === 'TALVYN_CHECK_DUPLICATE' || msg.type === 'CHECK_DUPLICATE') {
    const url = msg.payload?.url || msg.url
    if (typeof url !== 'string' || url.length > 4096 || !/^https?:\/\//.test(url)) return { success: false, error: 'Invalid job URL.' }
    return proxyRequest({ path: `/api/jobs/check-url?url=${encodeURIComponent(url)}` })
  }
  if (msg.type === 'OPEN_DASHBOARD_ROUTE') {
    if (!['dashboard','profile','tracker','settings','signup'].includes(msg.route)) return { success: false, error: 'Invalid dashboard route.' }
    const tab = await chrome.tabs.create({ url: getDashboardRouteUrl(msg.route as DashboardRoute) })
    return { success: true, tabId: tab.id }
  }
  if (msg.type === 'CONNECT_TALVYN') {
    const result = await startPairing()
    if (!result.success) return result
    await chrome.tabs.create({ url: `${getDashboardRouteUrl('connect')}?requestId=${encodeURIComponent(result.requestId)}` })
    return result
  }
  if (msg.type === 'DISCONNECT_TALVYN') return trustedUi ? disconnect() : { success: false, error: 'Disconnect from the extension popup.' }
  if (msg.type === 'GET_LOCAL_AI_SETTINGS') return trustedUi ? { success: true, settings: await readLocalAiSettings() } : { success: false, error: 'Settings are available in the popup.' }
  if (msg.type === 'SET_LOCAL_AI_SETTINGS') {
    if (!trustedUi) return { success: false, error: 'Update settings in the popup.' }
    const settings = validateLocalAiSettings(msg.settings)
    if (!settings) return { success: false, error: 'Use a loopback endpoint and a downloaded local model.' }
    if (settings.enabled && (!settings.consent || !(await hasLocalAiPermission(settings)))) return { success: false, error: 'Local AI requires explicit consent and browser permission.' }
    await chrome.storage.local.set({ [LOCAL_AI_KEY]: settings })
    return { success: true, settings }
  }
  if (msg.type === 'CHECK_LOCAL_AI' || msg.type === 'LOCAL_AI_ANALYZE_JOB') {
    const settings = await readLocalAiSettings()
    if (!settings.enabled || !settings.consent || !(await hasLocalAiPermission(settings))) return { success: false, reason: 'Local AI is disabled or its browser permission is missing.' }
    if (msg.type === 'CHECK_LOCAL_AI') return trustedUi ? detectLocalAi(settings) : { success: false, reason: 'Check local AI in the popup.' }
    return analyzeLocalJob(msg.data, settings)
  }
  if (msg.type === 'TRIGGER_ACTIVE_TAB_PANEL' || msg.type === 'TALVYN_OPEN_FLOATING_WINDOW') {
    if (!trustedUi) return { success: false, error: 'Open analysis using the extension popup.' }
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    const tab = tabs[0]
    if (!tab?.id) return { success: false, error: 'No active tab found.' }
    const result = await triggerIntelligencePanelOnTab(tab.id, tab.url, tab.title)
    return result ? { success: result.success !== false, result } : { success: false, error: 'This page could not be analyzed. Try a job page in a regular browser tab.' }
  }
  return { success: false, error: 'Unsupported extension message.' }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleInternalMessage(message, sender).then(sendResponse).catch(() => sendResponse({ success: false, error: 'Talvyn could not complete this request. Please retry.' }))
  return true
})

function sanitizeApplicationSession(value: unknown): ApplicationSession | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id) ||
      typeof data.pageUrl !== 'string' || data.pageUrl.length > 4096 || !isHttpUrl(data.pageUrl) ||
      typeof data.startedAt !== 'string' || !Number.isFinite(Date.parse(data.startedAt)) ||
      typeof data.lastActivityAt !== 'string' || !Number.isFinite(Date.parse(data.lastActivityAt)) ||
      Date.parse(data.startedAt) > Date.now() + 300_000 || Date.parse(data.lastActivityAt) > Date.now() + 300_000) return null
  const session: ApplicationSession = { id: data.id, pageUrl: data.pageUrl, startedAt: data.startedAt, lastActivityAt: data.lastActivityAt }
  for (const key of ['jobUrl', 'jobTitle', 'company', 'location'] as const) {
    if (data[key] !== undefined && data[key] !== null) {
      if (typeof data[key] !== 'string' || (data[key] as string).length > (key === 'jobUrl' ? 4096 : 1000)) return null
      if (key === 'jobUrl' && !isHttpUrl(data[key] as string)) return null
      session[key] = data[key] as string
    }
  }
  if (data.submitted !== undefined && typeof data.submitted !== 'boolean') return null
  if (typeof data.submitted === 'boolean') session.submitted = data.submitted
  return session
}

function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password }
  catch { return false }
}

chrome.runtime.onMessageExternal.addListener((message: any, sender, sendResponse) => {
  if (!isExactAllowedOrigin(sender.url || sender.origin, CONFIG.WEB_ORIGINS) || !message || typeof message !== 'object' || typeof message.type !== 'string') {
    sendResponse({ success: false, error: 'Unauthorized website message.' }); return false
  }
  // Discovery must remain independent of authentication and API availability.
  if (message.type === 'TALVYN_PING_EXTENSION') {
    sendResponse({ success: true, installed: true, version: chrome.runtime.getManifest().version, protocolVersion: CONFIG.PROTOCOL_VERSION }); return false
  }
  void (async () => {
    if (message.type === 'TALVYN_START_CONNECTION') return startPairing()
    if (message.type === 'TALVYN_GET_PAIRING_REQUEST') {
      const pending = await readPendingPairing()
      return pending && message.requestId === pending.requestId
        ? { success: true, requestId: pending.requestId, expiresAt: pending.expiresAt }
        : { success: false, error: 'This request does not belong to the installed extension.' }
    }
    if (message.type === 'TALVYN_COMPLETE_CONNECTION') {
      if (typeof message.requestId !== 'string' || !PAIRING_REQUEST_PATTERN.test(message.requestId)) return { success: false, error: 'Invalid connection request.' }
      return completePairing(message.requestId)
    }
    if (message.type === 'TALVYN_GET_STATUS') {
      const status = await getAuthStatus(false)
      return { success: true, state: status.state, connectionState: status.state, error: status.error,
        user: status.user ? { id: status.user.id, email: status.user.email } : null, version: chrome.runtime.getManifest().version }
    }
    if (message.type === 'TALVYN_DISCONNECT_EXTENSION') return disconnect()
    return { success: false, error: 'Unsupported website message.' }
  })().then(sendResponse).catch(() => sendResponse({ success: false, error: 'Talvyn could not complete this request. Please retry.' }))
  return true
})

interface PanelTriggerResult { success?: boolean; mode?: string; detectedJobs?: number; error?: string }
export async function triggerIntelligencePanelOnTab(tabId: number, tabUrl?: string, tabTitle?: string): Promise<PanelTriggerResult | null> {
  try {
    const response: PanelTriggerResult = await chrome.tabs.sendMessage(tabId, {
      type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
      tabUrl,
      tabTitle,
    })
    return response
  } catch {
    if (
      tabUrl?.startsWith('chrome://') ||
      tabUrl?.startsWith('chrome-extension://') ||
      tabUrl?.startsWith('edge://') ||
      tabUrl?.startsWith('brave://') ||
      tabUrl?.startsWith('about:')
    ) {
      return null
    }

    try {
      if (chrome.scripting?.executeScript) {
        const manifest = chrome.runtime.getManifest()
        const contentScriptFiles = manifest.content_scripts?.[0]?.js || []
        if (contentScriptFiles.length > 0) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: contentScriptFiles,
          })
          // Retry with exponential backoff / polling up to 3 times to allow dynamic import to finish
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 150))
            try {
              const retryRes: PanelTriggerResult = await chrome.tabs.sendMessage(tabId, {
                type: 'TALVYN_OPEN_INTELLIGENCE_PANEL',
                tabUrl,
                tabTitle,
              })
              return retryRes
            } catch {
              /* retry */
            }
          }
        }
      }
    } catch { /* Restricted pages remain unavailable; caller presents the result. */ }
  }
  return null
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  await triggerIntelligencePanelOnTab(tab.id, tab.url, tab.title)
})

