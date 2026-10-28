import assert from 'node:assert/strict'
import { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '../src/api/client'
import { authApi } from '../src/api/auth'
import { initializeAuth } from '../src/api/initializeAuth'
import { clearLegacyAuth, useAuthStore } from '../src/store/authStore'
import { queryClient } from '../src/lib/queryClient'
import { User } from '../src/types'
import { safeRedirectPath } from '../src/utils/safeRedirect'

const user: User = { id: 'cookie-user', email: 'cookie@example.com', profile: null }
const switched: User = { id: 'next-user', email: 'next@example.com', profile: null }
let checks = 0
function check(condition: unknown, message: string) { assert.ok(condition, message); checks++ }

async function main() {
  check(safeRedirectPath('/extension/connect?requestId=approved-request-id') === '/extension/connect?requestId=approved-request-id', 'Internal pairing return URL survives sign-in')
  check(safeRedirectPath('%2Fextension%2Fconnect%3FrequestId%3Dapproved-request-id') === '/extension/connect?requestId=approved-request-id', 'Legacy encoded internal return path remains supported')
  for (const redirect of ['//evil.example', '/\\evil.example', '%2F%2Fevil.example', 'https://evil.example', '/\n/evil.example']) check(safeRedirectPath(redirect) === null, 'External and browser-normalized unsafe sign-in redirects are rejected')
  const removed: string[] = []
  clearLegacyAuth({ removeItem: (key) => { removed.push(key) } })
  check(removed.includes('talvyn-auth'), 'Legacy persisted bearer sessions are removed')
  clearLegacyAuth({ removeItem: () => { throw new Error('blocked storage') } }); checks++
  check(!('token' in useAuthStore.getState()), 'The website store has no token field')
  check(!useAuthStore.getState().isAuthenticated, 'Persisted user data cannot authorize a website session')
  const requests: InternalAxiosRequestConfig[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    return { config, status: 200, statusText: 'OK', headers: {}, data: config.url === '/auth/me' ? user : { user, success: true } }
  }
  const login = await authApi.login({ email: user.email, password: 'ephemeral-input' })
  useAuthStore.getState().setAuth(login.user)
  check(useAuthStore.getState().isAuthenticated && useAuthStore.getState().user?.id === user.id, 'Login sets verified user state from cookie-auth response')
  check(requests[0].baseURL === '/api' && requests[0].withCredentials === true, 'Login uses same-origin API and cookie transport')
  check(!requests[0].headers.has('Authorization'), 'Website API calls contain no bearer credentials')
  queryClient.setQueryData(['private-profile'], { email: user.email })
  useAuthStore.getState().setAuth(switched)
  check(queryClient.getQueryData(['private-profile']) === undefined, 'Switching account clears cached private data')
  await authApi.logout()
  check(requests.at(-1)?.url === '/auth/logout' && requests.at(-1)?.method === 'post', 'Website logout calls its dedicated cookie logout endpoint')
  useAuthStore.getState().logout()
  check(!useAuthStore.getState().isAuthenticated, 'Local logout clears only website state')
  check(!requests.some((request) => request.url?.includes('extension-sessions/revoke')), 'Website logout does not revoke independent extension sessions')
  await authApi.approveExtensionPairing('approved-request-id-123', user.id)
  const approvalBody = JSON.parse(requests.at(-1)?.data as string)
  check(approvalBody.keepConnected === true && approvalBody.expectedUserId === user.id, 'Pairing approval binds explicit consent to the displayed website account')
  await initializeAuth()
  check(useAuthStore.getState().user?.id === user.id, 'Reload bootstrap restores user only after authenticated /auth/me')

  let releaseMe: (() => void) | undefined
  apiClient.defaults.adapter = (config) => new Promise((resolve) => {
    releaseMe = () => resolve({ config, status: 200, statusText: 'OK', headers: {}, data: user })
  })
  const staleBootstrap = initializeAuth()
  await new Promise((resolve) => setImmediate(resolve))
  useAuthStore.getState().setAuth(switched)
  releaseMe!()
  await staleBootstrap
  check(useAuthStore.getState().user?.id === switched.id, 'A late bootstrap response cannot restore the previous account')

  let failOldRequest: (() => void) | undefined
  apiClient.defaults.adapter = (config) => new Promise((_resolve, reject) => {
    failOldRequest = () => reject(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { config, status: 401, statusText: 'Unauthorized', headers: {}, data: {} }))
  })
  const oldRequest = apiClient.get('/profile').catch(() => undefined)
  await new Promise((resolve) => setImmediate(resolve))
  useAuthStore.getState().setAuth(user)
  failOldRequest!()
  await oldRequest
  check(useAuthStore.getState().user?.id === user.id, 'Late 401 from an old account cannot sign out a new session')
  apiClient.defaults.adapter = async (config) => { throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { config, status: 401, statusText: 'Unauthorized', headers: {}, data: {} }) }
  await apiClient.get('/profile').catch(() => undefined)
  check(!useAuthStore.getState().isAuthenticated, 'Current-session 401 clears stale website state')
  console.log(`✓ Website cookie authentication: ${checks} transport, bootstrap, logout, and account-isolation checks passed`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
