import assert from 'node:assert/strict'
import { createExtensionBridge, ExtensionRuntime } from '../src/utils/extensionBridge'
import { parseRelease } from '../src/types/release'

const trustedId = 'a'.repeat(32)
const otherId = 'b'.repeat(32)
const requestId = 'c'.repeat(36)
const future = new Date(Date.now() + 60_000).toISOString()
let assertions = 0
function check(condition: unknown, message: string) { assert.ok(condition, message); assertions++ }

async function main() {
  const pending = createExtensionBridge({ extensionId: '', timeoutMs: 10 })
  check(!('storeUrl' in pending), 'Extension bridge does not expose store URLs in GitHub distribution model')
  check((await pending.detect()).state === 'configuration-required', 'No invented ID or store link while configuration is required')
  await assert.rejects(pending.startConnection(), /configured|public key/); assertions++
  check((await createExtensionBridge({ extensionId: trustedId, runtime: () => undefined }).detect()).state === 'unavailable', 'Unavailable browser messaging is distinct from missing publication')

  const messages: Array<{ extensionId: string; message: Record<string, unknown> }> = []
  let reply: (message: Record<string, unknown>) => unknown = (message) => message.type === 'TALVYN_PING_EXTENSION'
    ? { success: true, installed: true, version: '1.3.0', protocolVersion: 2 }
    : { success: true, state: 'connected', user: { id: 'user-1', email: 'candidate@example.com', accessToken: 'must-be-discarded' }, token: 'must-be-discarded' }
  const runtime: ExtensionRuntime = {
    sendMessage: (extensionId, message, callback) => {
      messages.push({ extensionId, message: message as Record<string, unknown> })
      callback(reply(message as Record<string, unknown>))
    },
  }
  const bridge = createExtensionBridge({ extensionId: trustedId, runtime: () => runtime, timeoutMs: 15 })
  const connected = await bridge.detect()
  check(connected.state === 'connected' && connected.user?.id === 'user-1', 'Connected requires a verified minimal account status')
  check(!JSON.stringify(connected).includes('must-be-discarded'), 'Credential-shaped status fields are discarded')
  check(messages.every((message) => message.extensionId === trustedId), 'Every message targets the configured trusted extension ID')
  reply = (message) => message.type === 'TALVYN_PING_EXTENSION'
    ? { success: true, installed: true, version: '1.3.0', protocolVersion: 2 }
    : { success: true, state: 'disconnected', user: null }
  check((await bridge.detect()).state === 'disconnected', 'Installed disconnected is detected without false connection')
  reply = (message) => message.type === 'TALVYN_PING_EXTENSION'
    ? { success: true, installed: true, version: '1.3.0', protocolVersion: 2 }
    : { success: true, state: 'reconnecting', user: null }
  check((await bridge.detect()).state === 'reconnecting', 'Backend outage/recovery is represented separately')
  reply = (message) => message.type === 'TALVYN_PING_EXTENSION'
    ? { success: true, installed: true, version: '1.3.0', protocolVersion: 2 }
    : { success: true, state: 'connected', user: null }
  const invalid = await bridge.detect()
  check(invalid.state === 'unavailable' && invalid.installed, 'Missing account cannot produce Connected while preserving installation evidence')
  reply = () => ({ success: true, installed: true, version: '1.2.0', protocolVersion: 1 })
  check((await bridge.detect()).state === 'unavailable', 'Old connection protocol requires update')
  runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' }
  check((await bridge.detect()).state === 'not-installed', 'Disabled/absent extension is a retryable not-installed state')
  runtime.lastError = undefined
  const silent = createExtensionBridge({ extensionId: trustedId, runtime: () => ({ sendMessage() {} }), timeoutMs: 10 })
  check((await silent.detect()).state === 'unavailable', 'Missing callbacks terminate with a bounded timeout')
  const throwing = createExtensionBridge({ extensionId: trustedId, runtime: () => ({ sendMessage() { throw new Error('browser blocked') } }), timeoutMs: 10 })
  check((await throwing.detect()).state === 'unavailable', 'Browser permission exceptions are handled')
  reply = () => ({ success: true, requestId, expiresAt: future, verifier: 'private-secret' })
  const started = await bridge.startConnection()
  check(started.requestId === requestId && !JSON.stringify(started).includes('private-secret'), 'Pairing start returns metadata only')
  await bridge.verifyPairing(requestId); assertions++
  reply = () => ({ success: true, requestId: 'd'.repeat(36), expiresAt: future })
  await assert.rejects(bridge.verifyPairing(requestId), /different/); assertions++
  reply = () => ({ success: true, requestId, expiresAt: new Date(Date.now() - 1000).toISOString() })
  await assert.rejects(bridge.verifyPairing(requestId), /expired/); assertions++
  await assert.rejects(bridge.verifyPairing('../spoofed'), /Invalid/); assertions++
  reply = () => ({ success: true, user: { id: 'user-1', email: 'candidate@example.com', refreshToken: 'private-secret' } })
  const complete = await bridge.completeConnection(requestId)
  check(complete.id === 'user-1' && !JSON.stringify(complete).includes('private-secret'), 'Completion exposes only the connected account')
  check(messages.every(({ message }) => !('accessToken' in message) && !('refreshToken' in message) && !('verifier' in message)), 'Website messages contain no extension credentials or private proof')
  const metadata = { extensionVersion: '1.3.0', websiteVersion: '1.0.0', releaseDate: '2026-10-14', title: 'Prepared build', changes: [], backendCompatibility: 'API pairing v2', installInstructions: '', distribution: 'github', repository: 'Abhinavm055/Talvyn', publicationStatus: 'not-published', publishedExtensionVersion: null }
  check(parseRelease(metadata)?.publishedExtensionVersion === null, 'Unpublished local builds cannot create store update claims')
  check(parseRelease({ ...metadata, publicationStatus: 'published' }) === null, 'Local build notes reject claiming published status')
  check(parseRelease({ ...metadata, distribution: 'store' }) === null, 'Local build notes reject non-github distribution')
  check(parseRelease({ ...metadata, changes: [42] }) === null, 'Malformed release metadata is rejected')
  console.log(`✓ Website extension bridge: ${assertions} security, lifecycle, and publication checks passed`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
