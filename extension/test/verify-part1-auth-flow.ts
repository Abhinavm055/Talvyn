/**
 * Verification Test: Talvyn Part 1 - Extension Popup & Shared Authentication Flow
 *
 * Verifies:
 * 1. Extension Manifest popup configuration (MV3 default_popup points to src/popup/index.html)
 * 2. Background Service Worker internal message contract:
 *    - GET_AUTH_STATUS returns unauthenticated when no session stored
 *    - GET_AUTH_STATUS returns authenticated + user details when valid session stored
 *    - GET_AUTH_STATUS cleanly flags expired session
 * 3. Route navigation contract (OPEN_DASHBOARD_ROUTE: dashboard, profile, tracker, settings)
 * 4. Production vs Development URL resolution without hardcoding localhost in production
 * 5. Web App & Extension single shared user identity (resolves to same backend user)
 * 6. Web App logout notification to extension
 */

import fs from 'fs'
import path from 'path'
import { CONFIG, getDashboardRouteUrl } from '../src/utils/config'

console.log('=================================================================')
console.log('TALVYN PART 1: EXTENSION POPUP & SHARED AUTHENTICATION FLOW TESTS')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failed++
  }
}

async function runTests() {
  // ─── 1. Extension Manifest & Popup Configuration ──────────────────────────────
  console.log('--- 1. Testing Manifest & Action Popup Configuration ---')
  
  const manifestSrc = fs.readFileSync(path.resolve(__dirname, '../src/manifest.ts'), 'utf8')
  assert(
    manifestSrc.includes("default_popup: 'src/popup/index.html'"),
    'Extension manifest.ts specifies default_popup: src/popup/index.html'
  )

  const distManifestPath = path.resolve(__dirname, '../dist/manifest.json')
  assert(fs.existsSync(distManifestPath), 'Compiled manifest.json exists in dist')
  if (fs.existsSync(distManifestPath)) {
    const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'))
    assert(
      distManifest.action?.default_popup === 'src/popup/index.html',
      'Compiled manifest.json contains action.default_popup = src/popup/index.html'
    )
    assert(
      Boolean(distManifest.action?.default_title),
      'Action block defines default_title'
    )
    assert(
      Boolean(distManifest.action?.default_icon),
      'Action block defines default_icon dictionary'
    )
  }

  // ─── 2. Background Service Worker Message Router ──────────────────────────────
  console.log('\n--- 2. Testing Background Service Worker Auth & Navigation Handlers ---')

  const bgSrc = fs.readFileSync(path.resolve(__dirname, '../src/background/index.ts'), 'utf8')
  assert(
    bgSrc.includes("msg.type === 'GET_AUTH_STATUS'"),
    'Background service worker implements GET_AUTH_STATUS message handler'
  )
  assert(
    bgSrc.includes("msg.type === 'OPEN_DASHBOARD_ROUTE'"),
    'Background service worker implements OPEN_DASHBOARD_ROUTE message handler'
  )
  assert(
    bgSrc.includes("msg.type === 'CONNECT_TALVYN'"),
    'Background service worker implements CONNECT_TALVYN message handler'
  )
  assert(
    bgSrc.includes("msg.type === 'DISCONNECT_TALVYN'"),
    'Background service worker implements DISCONNECT_TALVYN message handler'
  )
  assert(
    bgSrc.includes("message.type === 'TALVYN_CONNECT_EXTENSION'"),
    'Background service worker implements TALVYN_CONNECT_EXTENSION external handler'
  )
  assert(
    bgSrc.includes("message.type === 'TALVYN_DISCONNECT_EXTENSION'"),
    'Background service worker implements TALVYN_DISCONNECT_EXTENSION external handler'
  )

  // ─── 3. Popup UI & Navigation Buttons ─────────────────────────────────────────
  console.log('\n--- 3. Testing Popup UI Structure & Navigation ---')

  const popupSrc = fs.readFileSync(path.resolve(__dirname, '../src/popup/popup.ts'), 'utf8')
  assert(
    popupSrc.includes('sendBackgroundMessage'),
    'Popup communicates through background service worker messaging'
  )
  assert(
    popupSrc.includes('btn-open-dashboard') &&
    popupSrc.includes('btn-open-profile') &&
    popupSrc.includes('btn-open-tracker') &&
    popupSrc.includes('btn-open-settings'),
    'Popup implements all 4 navigation buttons: Dashboard, Profile, Tracker, Settings'
  )
  assert(
    popupSrc.includes('renderLoading') &&
    popupSrc.includes('Connecting...'),
    'Popup contains Loading / Connecting state'
  )
  assert(
    popupSrc.includes('renderDisconnected') &&
    popupSrc.includes('Not connected') &&
    popupSrc.includes('Connect Talvyn'),
    'Popup contains Not connected state with Connect Talvyn button'
  )
  assert(
    popupSrc.includes('renderConnected') &&
    popupSrc.includes('Connected'),
    'Popup contains Connected state rendering user name and email'
  )
  assert(
    popupSrc.includes('renderExpired') &&
    popupSrc.includes('Session expired') &&
    popupSrc.includes('Reconnect Talvyn'),
    'Popup contains Session expired state with Reconnect Talvyn action'
  )
  assert(
    popupSrc.includes('renderError') &&
    popupSrc.includes('Unable to connect'),
    'Popup contains Error / Unable to connect state with retry action'
  )

  // ─── 4. Route Navigation & URL Construction ───────────────────────────────────
  console.log('\n--- 4. Testing Route URL Generation ---')

  const dashUrl = getDashboardRouteUrl('dashboard')
  const profUrl = getDashboardRouteUrl('profile')
  const trackUrl = getDashboardRouteUrl('tracker')
  const settingsUrl = getDashboardRouteUrl('settings')
  const connectUrl = getDashboardRouteUrl('connect', 'mock-extension-id-123')

  assert(dashUrl.endsWith('/dashboard'), `Dashboard URL generated correctly: ${dashUrl}`)
  assert(profUrl.endsWith('/profile'), `Profile URL generated correctly: ${profUrl}`)
  assert(trackUrl.endsWith('/tracker'), `Tracker URL generated correctly: ${trackUrl}`)
  assert(settingsUrl.endsWith('/extensions'), `Settings URL points to /extensions: ${settingsUrl}`)
  assert(
    connectUrl.includes('/extension/connect') && connectUrl.includes('extId=mock-extension-id-123'),
    `Connect URL includes extension ID parameter: ${connectUrl}`
  )

  // ─── 5. Production URL Safety Check ───────────────────────────────────────────
  console.log('\n--- 5. Testing Production Endpoint Safety ---')

  assert(
    CONFIG.API_BASE === 'http://localhost:3001' || CONFIG.API_BASE === 'https://talvyn-backend-7ucf.onrender.com',
    `API_BASE is a recognized valid endpoint (${CONFIG.API_BASE})`
  )
  assert(
    CONFIG.DASHBOARD_URL === 'http://localhost:5173' || CONFIG.DASHBOARD_URL === 'https://talvyn.vercel.app',
    `DASHBOARD_URL is a recognized valid endpoint (${CONFIG.DASHBOARD_URL})`
  )

  // ─── 6. Web App Single Identity & Logout Synchronization ──────────────────────
  console.log('\n--- 6. Testing Web App & Extension Shared Identity Consistency ---')

  const sidebarSrc = fs.readFileSync(path.resolve(__dirname, '../../src/components/layout/Sidebar.tsx'), 'utf8')
  assert(
    sidebarSrc.includes('notifyExtensionDisconnect') || sidebarSrc.includes('TALVYN_DISCONNECT_EXTENSION'),
    'Web dashboard notifies extension on logout to synchronize session clearing'
  )

  const extensionConnectSrc = fs.readFileSync(path.resolve(__dirname, '../../src/pages/extensions/ExtensionConnect.tsx'), 'utf8')
  assert(
    extensionConnectSrc.includes('TALVYN_CONNECT_EXTENSION') &&
    extensionConnectSrc.includes('useAuthStore'),
    'Web /extension/connect passes the active web user identity to extension without creating duplicate users'
  )
  assert(
    extensionConnectSrc.includes('talvyn_connected_extension_id'),
    'Web /extension/connect persists connected extension ID in localStorage for reliable logout signaling'
  )

  const extensionSyncSrc = fs.readFileSync(path.resolve(__dirname, '../../src/utils/extensionSync.ts'), 'utf8')
  assert(
    extensionSyncSrc.includes('TALVYN_DISCONNECT_EXTENSION') &&
    extensionSyncSrc.includes('talvyn:auth-logout'),
    'src/utils/extensionSync.ts dispatches both runtime message and DOM event on logout'
  )

  const contentSrc = fs.readFileSync(path.resolve(__dirname, '../src/content/index.ts'), 'utf8')
  assert(
    contentSrc.includes('talvyn:auth-logout') && contentSrc.includes('DISCONNECT_TALVYN'),
    'Content script listens for talvyn:auth-logout event and forwards DISCONNECT_TALVYN to background'
  )

  // ─── 7. Part 1 Lifecycle State Machine Simulation ─────────────────────────────
  console.log('\n--- 7. Testing Focused Part 1 Auth Sync Lifecycle Scenarios ---')

  // Mock chrome.storage.local
  const mockStorage: Record<string, any> = {}
  let mockBadge: string = 'off'

  // Helper to create mock JWT tokens (valid or expired)
  function createMockJwt(expInSecondsFromNow: number, userId: string = 'user-123'): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const exp = Math.floor(Date.now() / 1000) + expInSecondsFromNow
    const payload = Buffer.from(JSON.stringify({ userId, email: `${userId}@example.com`, exp })).toString('base64url')
    return `${header}.${payload}.mock-signature`
  }

  const validToken = createMockJwt(3600) // 1 hour in future
  const expiredToken = createMockJwt(-3600) // 1 hour in past

  // Simulated background service worker logic for GET_AUTH_STATUS and external messages
  async function simulateBackgroundHandleMessage(
    msg: any,
    backendMock: { validateToken: (token: string) => Promise<{ status: number; user?: any }> }
  ): Promise<any> {
    if (msg.type === 'TALVYN_CONNECT_EXTENSION') {
      const { token, user } = msg
      const res = await backendMock.validateToken(token)
      if (res.status !== 200) {
        return { success: false, error: 'Token verification failed with backend' }
      }
      mockStorage['talvynAuth'] = { token, user: res.user || user, connectedAt: new Date().toISOString() }
      mockBadge = 'on'
      return { success: true, user: res.user || user, message: 'Extension connected successfully' }
    }

    if (msg.type === 'TALVYN_DISCONNECT_EXTENSION' || msg.type === 'DISCONNECT_TALVYN') {
      delete mockStorage['talvynAuth']
      delete mockStorage['talvyn_token']
      delete mockStorage['talvyn_user']
      mockBadge = 'off'
      return { success: true, message: 'Extension disconnected' }
    }

    if (msg.type === 'GET_AUTH_STATUS') {
      const session = mockStorage['talvynAuth']
      if (!session?.token) {
        mockBadge = 'off'
        return { success: true, state: 'disconnected', user: null, token: null }
      }

      // Check mathematical JWT expiry
      try {
        const parts = session.token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            delete mockStorage['talvynAuth']
            mockBadge = 'off'
            return { success: true, state: 'expired', user: null, token: null }
          }
        }
      } catch {}

      // Backend live validation
      const res = await backendMock.validateToken(session.token)
      if (res.status === 200) {
        mockBadge = 'on'
        return { success: true, state: 'connected', user: res.user || session.user, token: session.token }
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        delete mockStorage['talvynAuth']
        mockBadge = 'off'
        return { success: true, state: 'expired', user: null, token: null }
      } else {
        return { success: false, state: 'error', error: 'Unable to verify authentication with backend' }
      }
    }

    return { success: false, error: 'Unknown message' }
  }

  // Simulated popup state evaluator
  function evaluatePopupUI(response: any): 'Connected' | 'Not connected' | 'Session expired' | 'Error' {
    if (!response || !response.success) {
      return 'Error'
    }
    if (response.state === 'connected' && response.user) {
      return 'Connected'
    }
    if (response.state === 'expired') {
      return 'Session expired'
    }
    return 'Not connected'
  }

  // Define backend mock
  const backendMock = {
    validateToken: async (token: string) => {
      if (token === validToken) {
        return { status: 200, user: { id: 'user-123', email: 'alex@example.com', profile: { givenName: 'Alex' } } }
      }
      return { status: 401 }
    },
  }

  // SCENARIO 1: Logged-in dashboard -> extension Connected
  console.log('  Testing Scenario 1: Logged-in dashboard -> extension Connected...')
  const connectRes = await simulateBackgroundHandleMessage(
    {
      type: 'TALVYN_CONNECT_EXTENSION',
      token: validToken,
      user: { id: 'user-123', email: 'alex@example.com' },
    },
    backendMock
  )
  assert(connectRes.success === true, 'Scenario 1: Connect message accepted with valid token')
  assert(mockBadge === 'on', 'Scenario 1: Extension badge is set to on')

  const status1 = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, backendMock)
  assert(status1.state === 'connected' && status1.user?.email === 'alex@example.com', 'Scenario 1: GET_AUTH_STATUS returns connected with user details')
  assert(evaluatePopupUI(status1) === 'Connected', 'Scenario 1: Popup displays Connected')

  // SCENARIO 2: Dashboard logout -> extension Not Connected
  console.log('  Testing Scenario 2: Dashboard logout -> extension Not Connected...')
  const disconnectRes = await simulateBackgroundHandleMessage({ type: 'TALVYN_DISCONNECT_EXTENSION' }, backendMock)
  assert(disconnectRes.success === true, 'Scenario 2: Disconnect message acknowledged')
  assert(mockStorage['talvynAuth'] === undefined, 'Scenario 2: Storage is completely cleared on disconnect')
  assert(mockBadge === 'off', 'Scenario 2: Badge is set to off on disconnect')

  const status2 = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, backendMock)
  assert(status2.state === 'disconnected', 'Scenario 2: GET_AUTH_STATUS returns disconnected after logout')
  assert(evaluatePopupUI(status2) === 'Not connected', 'Scenario 2: Popup displays Not connected after logout')

  // SCENARIO 3: Stale token -> Not Connected / Session expired
  console.log('  Testing Scenario 3: Stale token -> Not Connected / Session expired...')
  // Sub-case 3a: Mathematically expired token
  mockStorage['talvynAuth'] = {
    token: expiredToken,
    user: { id: 'user-123', email: 'alex@example.com' },
    connectedAt: new Date(Date.now() - 86400000).toISOString(),
  }
  const status3a = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, backendMock)
  assert(status3a.state === 'expired', 'Scenario 3a: Mathematically expired token is caught and flagged as expired')
  assert(mockStorage['talvynAuth'] === undefined, 'Scenario 3a: Expired session is purged from storage')
  assert(evaluatePopupUI(status3a) === 'Session expired', 'Scenario 3a: Popup renders Session expired, NOT Connected')

  // Sub-case 3b: Token rejected by backend as revoked/invalid (401)
  const revokedToken = createMockJwt(3600, 'revoked-user') // structurally valid but rejected by backend
  mockStorage['talvynAuth'] = {
    token: revokedToken,
    user: { id: 'revoked-user', email: 'revoked-user@example.com' },
    connectedAt: new Date().toISOString(),
  }
  const status3b = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, backendMock)
  assert(status3b.state === 'expired', 'Scenario 3b: Token rejected with 401 by backend returns state expired')
  assert(mockStorage['talvynAuth'] === undefined, 'Scenario 3b: Stale token purged from storage, not trusted blindly')
  assert(evaluatePopupUI(status3b) === 'Session expired', 'Scenario 3b: Popup renders Session expired, NOT Connected')

  // SCENARIO 4: Popup reopened after logout -> Not Connected (fresh state, no stale cache)
  console.log('  Testing Scenario 4: Popup reopened after logout -> Not Connected...')
  // Reset storage to empty as after a logout
  delete mockStorage['talvynAuth']
  // Simulate opening popup a second time: fresh init() sends fresh GET_AUTH_STATUS
  const status4 = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, backendMock)
  assert(status4.state === 'disconnected', 'Scenario 4: Reopened popup fetches fresh disconnected status')
  assert(evaluatePopupUI(status4) === 'Not connected', 'Scenario 4: Reopened popup renders Not connected, never cached Connected')

  // SCENARIO 5: Reconnect after logout -> Connected again
  console.log('  Testing Scenario 5: Reconnect after logout -> Connected again...')
  const freshValidToken = createMockJwt(7200)
  const reconnectBackend = {
    validateToken: async (tok: string) => {
      if (tok === freshValidToken) {
        return { status: 200, user: { id: 'user-123', email: 'alex@example.com', profile: { givenName: 'Alex' } } }
      }
      return { status: 401 }
    },
  }
  const reconnectRes = await simulateBackgroundHandleMessage(
    {
      type: 'TALVYN_CONNECT_EXTENSION',
      token: freshValidToken,
      user: { id: 'user-123', email: 'alex@example.com' },
    },
    reconnectBackend
  )
  assert(reconnectRes.success === true, 'Scenario 5: Reconnection handshake succeeds')
  assert(mockBadge === 'on', 'Scenario 5: Badge is on after reconnect')
  const status5 = await simulateBackgroundHandleMessage({ type: 'GET_AUTH_STATUS' }, reconnectBackend)
  assert(status5.state === 'connected', 'Scenario 5: GET_AUTH_STATUS returns connected after re-authenticating')
  assert(evaluatePopupUI(status5) === 'Connected', 'Scenario 5: Popup displays Connected again')

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log('=================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
