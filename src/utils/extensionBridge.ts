import { isExtensionVersion } from '../../server/contracts/extensionRelease'

export type ExtensionConnectionState = 'connected' | 'reconnecting' | 'reconnect-required' | 'disconnected'
export interface ExtensionAccount { id: string; email: string }
export interface ExtensionStatus {
  state: 'checking' | 'configuration-required' | 'not-installed' | 'unavailable' | ExtensionConnectionState
  installed: boolean
  version?: string
  user?: ExtensionAccount
  message: string
}

export interface ExtensionRuntime {
  sendMessage: (extensionId: string, message: object, callback: (response: unknown) => void) => void
  lastError?: { message?: string }
}

type Message =
  | { type: 'TALVYN_PING_EXTENSION' | 'TALVYN_GET_STATUS' | 'TALVYN_START_CONNECTION' }
  | { type: 'TALVYN_GET_PAIRING_REQUEST' | 'TALVYN_COMPLETE_CONNECTION'; requestId: string }

interface PairingResponse { requestId: string; expiresAt: string }
type RecordValue = Record<string, unknown>
const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)
const isVersion = isExtensionVersion
export const isExtensionId = (value: string): boolean => /^[a-p]{32}$/.test(value)
export const isPairingRequestId = (value: string): boolean => /^[A-Za-z0-9_-]{16,128}$/.test(value)

export function isChromiumBrowser(): boolean {
  if (typeof window === 'undefined') return true
  const win = window as any
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const ua = nav?.userAgent || ''
  return Boolean(win.chrome) || /Chrome|Chromium|Edg|Brave|OPR/i.test(ua)
}

class BridgeError extends Error {
  constructor(message: string, public kind: 'not-installed' | 'unavailable' = 'unavailable') { super(message) }
}

function accountFrom(value: unknown): ExtensionAccount | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.email !== 'string') return undefined
  return { id: value.id, email: value.email }
}

// Configuration is injected for isolated browser-message tests. Production's
// singleton below reads only build-time configuration, never page/URL IDs.
export function createExtensionBridge(options: {
  extensionId: string
  runtime?: () => ExtensionRuntime | undefined
  timeoutMs?: number
}) {
  const extensionId = isExtensionId(options.extensionId) ? options.extensionId : ''
  const runtimeProvider = options.runtime || (() => {
    if (typeof window === 'undefined') return undefined
    return (window as Window & { chrome?: { runtime?: ExtensionRuntime } }).chrome?.runtime
  })

  function send(message: Message): Promise<RecordValue> {
    if (!extensionId) return Promise.reject(new BridgeError('Trusted extension identity is not configured. The project owner must configure the production public key.'))
    const runtime = runtimeProvider()
    if (!runtime || typeof runtime.sendMessage !== 'function') {
      const isChromium = isChromiumBrowser()
      const message = isChromium
        ? 'Talvyn extension is not detected or is disabled in this browser. Please ensure the extension is installed and enabled in chrome://extensions.'
        : 'Extension messaging is unavailable. Open this page in Chrome or Brave with Talvyn enabled.'
      return Promise.reject(new BridgeError(message, 'unavailable'))
    }
    return new Promise((resolve, reject) => {
      let finished = false
      const finish = (error?: Error, response?: RecordValue) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        if (error) reject(error)
        else resolve(response!)
      }
      const timeoutMs = options.timeoutMs ?? (message.type === 'TALVYN_PING_EXTENSION' ? 5000 : message.type === 'TALVYN_START_CONNECTION' ? 15000 : 45000)
      const timer = setTimeout(() => finish(new BridgeError('Talvyn did not respond in time. Check that the extension is enabled, then retry.')), timeoutMs)
      try {
        runtime.sendMessage(extensionId, message, (response) => {
          // Chrome lastError must be read within this callback.
          const lastError = runtime.lastError?.message
          if (lastError) {
            const absent = /receiving end does not exist|could not establish connection|access to extension is denied|invalid extension id/i.test(lastError)
            finish(new BridgeError(absent ? 'Talvyn is not installed or is disabled in this browser.' : 'Talvyn connection is unavailable. Please retry.', absent ? 'not-installed' : 'unavailable'))
          } else if (!isRecord(response) || response.success !== true) {
            finish(new BridgeError(isRecord(response) && typeof response.error === 'string' ? response.error.slice(0, 300) : 'Talvyn returned an invalid response.'))
          } else finish(undefined, response)
        })
      } catch { finish(new BridgeError('Extension messaging failed. Please retry.')) }
    })
  }

  async function detect(): Promise<ExtensionStatus> {
    if (!extensionId) return { state: 'configuration-required', installed: false, message: 'Trusted extension identity is not configured. The project owner must configure the public key before account connection is available.' }
    let installed = false
    let version: string | undefined
    try {
      const ping = await send({ type: 'TALVYN_PING_EXTENSION' })
      if (ping.installed !== true || !isVersion(ping.version)) throw new BridgeError('Talvyn returned an invalid installation response.')
      installed = true
      version = ping.version
      if (ping.protocolVersion !== 2) return { state: 'unavailable', installed, version, message: 'This extension needs an update before it can securely connect. Follow the manual update instructions on the Extensions page.' }
      const response = await send({ type: 'TALVYN_GET_STATUS' })
      const state = response.connectionState ?? response.state
      if (state !== 'connected' && state !== 'reconnecting' && state !== 'reconnect-required' && state !== 'disconnected') throw new BridgeError('Talvyn returned an invalid connection state.')
      const user = accountFrom(response.user)
      if (state === 'connected' && !user) throw new BridgeError('Talvyn could not verify the connected account.')
      const messages = {
        connected: `Connected to ${user?.email || 'your account'}.`,
        reconnecting: 'Talvyn is restoring its session. Retry in a moment.',
        'reconnect-required': 'The extension session has expired or was revoked. Connect your account again.',
        disconnected: 'Talvyn is installed. Connect your account to synchronize jobs and profile data.',
      }
      return { state, installed, version, user, message: messages[state] }
    } catch (error) {
      return { state: installed ? 'unavailable' : error instanceof BridgeError ? error.kind : 'unavailable', installed, version, message: error instanceof Error ? error.message : 'Extension connection is unavailable. Please retry.' }
    }
  }

  async function pairingResponse(message: Message): Promise<PairingResponse> {
    const response = await send(message)
    if (typeof response.requestId !== 'string' || !isPairingRequestId(response.requestId) || typeof response.expiresAt !== 'string' || !Number.isFinite(Date.parse(response.expiresAt)) || Date.parse(response.expiresAt) <= Date.now()) throw new BridgeError('This connection request is invalid or expired. Start a new connection.')
    return { requestId: response.requestId, expiresAt: response.expiresAt }
  }

  return {
    extensionId,
    detect,
    startConnection: () => pairingResponse({ type: 'TALVYN_START_CONNECTION' }),
    verifyPairing: async (requestId: string) => {
      if (!isPairingRequestId(requestId)) throw new BridgeError('Invalid connection request. Start a new connection.')
      const pending = await pairingResponse({ type: 'TALVYN_GET_PAIRING_REQUEST', requestId })
      if (pending.requestId !== requestId) throw new BridgeError('This request belongs to a different browser extension session. Start a new connection.')
      return pending
    },
    completeConnection: async (requestId: string): Promise<ExtensionAccount> => {
      if (!isPairingRequestId(requestId)) throw new BridgeError('Invalid connection request.')
      const response = await send({ type: 'TALVYN_COMPLETE_CONNECTION', requestId })
      const user = accountFrom(response.user)
      if (!user) throw new BridgeError('Talvyn could not verify the connected account. Please retry.')
      return user
    },
  }
}

export const extensionBridge = createExtensionBridge({
  extensionId: import.meta.env?.VITE_TALVYN_EXTENSION_ID || '',
})
