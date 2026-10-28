/** Real storage/worker bridge contracts; worker lifecycle is tested in verify-secure-connection.ts. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getAuthSession, getStorageData, getUser, setAuthSession } from '../src/utils/storage'
import { CONFIG, getDashboardRouteUrl } from '../src/utils/config'
import { __resetRuntimeStateForTesting } from '../src/utils/extensionContext'

async function main(): Promise<void> {
  __resetRuntimeStateForTesting()
  const root = path.resolve(__dirname, '../..')
  const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8')
  assert.ok(!sidebar.includes('TALVYN_DISCONNECT_EXTENSION') && !sidebar.includes('notifyExtensionDisconnect'), 'Website logout preserves independent extension consent')
  const content = fs.readFileSync(path.join(root, 'extension/src/content/index.ts'), 'utf8')
  assert.ok(!content.includes('getToken') && !content.includes('setToken') && !content.includes('setUser'), 'Content scripts do not read or store credentials')
  assert.ok(!content.includes('talvyn:auth-logout') && !content.includes('DISCONNECT_TALVYN'))
  const connect = fs.readFileSync(path.join(root, 'src/pages/extensions/ExtensionConnect.tsx'), 'utf8')
  assert.ok(!connect.includes('session.accessToken') && !connect.includes('session.refreshToken'), 'Website never receives extension credentials')
  assert.ok(connect.includes('keepConnected') && connect.includes('useState(false)'), 'Independent session has explicit opt-in')
  assert.ok(connect.includes('completeConnection') || connect.includes('TALVYN_COMPLETE_CONNECTION'), 'Website uses one-time backend pairing')
  for (const [route, suffix] of [['dashboard', '/dashboard'], ['profile', '/profile'], ['tracker', '/tracker'], ['settings', '/extensions'], ['connect', '/extension/connect']] as const) assert.equal(getDashboardRouteUrl(route), CONFIG.DASHBOARD_URL + suffix)
  assert.ok(!getDashboardRouteUrl('connect').includes('extId='), 'Production connection URL cannot introduce an arbitrary target extension')

  let calls = 0
  let reads = 0
  let writes = 0
  const user = { id: 'verified-user', email: 'verified@example.test', profile: null }
  let reply: object = { success: true, authenticated: true, user }
  const values: Record<string, unknown> = {}
  Object.assign(globalThis, { location: { protocol: 'https:' }, chrome: {
    runtime: { id: 'extension-under-test', sendMessage: async (message: { type: string }) => { calls++; assert.equal(message.type, 'GET_AUTH'); return reply } },
    storage: { local: { get: async (keys: string[]) => { reads++; return Object.fromEntries(keys.map((key) => [key, values[key]])) }, set: async (value: object) => { writes++; Object.assign(values, value) }, remove: async () => {} } },
  } })
  assert.deepEqual(await getUser(), user)
  assert.equal(reads, 0, 'Content auth queries only the verified worker state')
  reply = { success: true, authenticated: false, user }
  assert.equal(await getUser(), null, 'Stale cached user cannot claim authenticated status')
  reply = { success: false, authenticated: true, user }
  assert.equal(await getUser(), null, 'Failed worker verification cannot become Connected')
  const session = { token: 'access-secret', refreshToken: 'refresh-secret', sessionId: 'session', user, connectedAt: new Date().toISOString() }
  await setAuthSession(session)
  assert.equal(writes, 0, 'Content context cannot write credential storage')
  values.talvynAuth = session
  assert.equal(await getAuthSession(), null, 'Content context cannot read credential storage')
  assert.equal(reads, 0)
  Object.assign(globalThis, { location: { protocol: 'chrome-extension:' } })
  assert.deepEqual(await getAuthSession(), session, 'Trusted extension context can restore worker credentials')
  reply = { success: true, authenticated: true, user }
  const publicState = await getStorageData()
  assert.ok(!('token' in publicState) && !('refreshToken' in publicState), 'Popup data contract excludes credential fields')
  assert.deepEqual(publicState.user, user)
  assert.ok(calls >= 4)
  console.log('PASS: authoritative worker auth, independent website logout, credential isolation, trusted restoration, consent, and safe navigation.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
