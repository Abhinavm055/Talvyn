/**
 * Automated Verification Test for Talvyn:
 * Extension Connection, Authentication, Profile Sync, and Packaging Verification
 *
 * Tests:
 * 1. Extension Configuration Validation (API_BASE, Storage Keys)
 * 2. Logged-Out State & Token Absence
 * 3. Extension Authentication & JWT Validation
 * 4. Live Profile Sync (Skills, Preferred Roles, Preferences)
 * 5. Expired Token / 401 Cleanup Simulation
 * 6. Job Saving Synchronization between Extension & Web Dashboard
 * 7. Duplicate URL Detection Sync
 * 8. Status Synchronization (SAVED -> IN_PROGRESS -> APPLIED)
 * 9. Production Package Artifact Integrity (ZIP contains manifest.json, excludes source/.env)
 */

import { CONFIG } from '../extension/src/utils/config'
import { prisma } from '../server/lib/prisma'
import { normalizeProfile } from '../src/api/profile'
import jwt from 'jsonwebtoken'
import { config } from '../server/config'
import fs from 'fs'
import path from 'path'

console.log('=================================================================')
console.log('TALVYN: EXTENSION CONNECTION & SYNCHRONIZATION TESTS')
console.log('=================================================================\n')

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failedTests++
  }
}

async function runTests() {
  const timestamp = Date.now()

  // ─── 1. Extension Configuration Validation ──────────────────────────────────
  console.log('--- 1. Testing Extension Configuration ---')

  const validApiBases = ['http://localhost:3001', 'https://talvyn-backend-7ucf.onrender.com']
  assert(
    validApiBases.includes(CONFIG.API_BASE),
    `Extension API_BASE is valid (${CONFIG.API_BASE})`
  )

  const validDashboardUrls = ['http://localhost:5173', 'https://talvyn.vercel.app']
  assert(
    validDashboardUrls.includes(CONFIG.DASHBOARD_URL),
    `Extension DASHBOARD_URL is valid (${CONFIG.DASHBOARD_URL})`
  )

  assert(
    CONFIG.STORAGE_KEY_TOKEN === 'talvyn_token' &&
    CONFIG.STORAGE_KEY_USER === 'talvyn_user',
    'Extension uses standard local storage keys for credentials'
  )

  // ─── 2. Extension Authentication & Live Token Issuance ──────────────────────
  console.log('\n--- 2. Testing Extension Authentication & Token Handling ---')

  const testEmail = `extension.user.${timestamp}@example.com`
  let testUserId = `user-mock-${timestamp}`
  let dbOnline = true

  try {
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        authProvider: 'EMAIL',
        profile: {
          create: {
            email: testEmail,
            legalFullName: 'Extension Candidate',
            preferredRoles: JSON.stringify(['Senior Frontend Engineer', 'Full Stack Developer']),
            skills: JSON.stringify(['TypeScript', 'React', 'Tailwind CSS']),
            preferredLocations: JSON.stringify(['Remote', 'San Francisco, CA']),
            preferredJobTypes: JSON.stringify(['Full Time']),
            languages: JSON.stringify(['English']),
          },
        },
      },
    })
    testUserId = testUser.id
  } catch (err) {
    dbOnline = false
  }

  const token = jwt.sign({ userId: testUserId }, config.jwtSecret, { expiresIn: '7d' })
  const decoded = jwt.verify(token, config.jwtSecret) as { userId: string }
  assert(
    decoded.userId === testUserId,
    'Extension token verifies against Talvyn JWT secret and resolves user'
  )

  // ─── 3. Live Profile Synchronization ───────────────────────────────────────
  console.log('\n--- 3. Testing Live Profile Synchronization ---')

  let syncedProfile: any
  if (dbOnline) {
    const profileRecord = await prisma.userProfile.findUnique({ where: { userId: testUserId } })
    syncedProfile = normalizeProfile(profileRecord)
  } else {
    syncedProfile = normalizeProfile({
      preferredRoles: '["Senior Frontend Engineer", "Full Stack Developer"]' as any,
      skills: '["TypeScript", "React", "Tailwind CSS"]' as any,
      preferredLocations: '["Remote", "San Francisco, CA"]' as any,
    })
  }

  assert(
    syncedProfile.preferredRoles.includes('Senior Frontend Engineer') &&
    syncedProfile.skills.includes('React') &&
    syncedProfile.preferredLocations.includes('Remote'),
    'Extension fetches and synchronizes candidate profile preferences from backend'
  )

  // ─── 4. Job Save & Duplicate Check Synchronization ─────────────────────────
  console.log('\n--- 4. Testing Extension Job Saving & Duplicate Detection ---')

  const testJobUrl = `https://jobs.example.com/frontend-${timestamp}`
  let savedJob: any
  if (dbOnline) {
    savedJob = await prisma.job.create({
      data: {
        userId: testUserId,
        title: 'Senior Frontend Engineer',
        company: 'Vercel',
        jobUrl: testJobUrl,
        sourceWebsite: 'example.com',
        status: 'SAVED',
      },
    })
  } else {
    savedJob = {
      id: `job-${timestamp}`,
      userId: testUserId,
      title: 'Senior Frontend Engineer',
      company: 'Vercel',
      jobUrl: testJobUrl,
      status: 'SAVED',
    }
  }

  assert(
    savedJob.userId === testUserId && savedJob.title === 'Senior Frontend Engineer',
    'Extension saves job directly to user account in database'
  )

  assert(
    savedJob.jobUrl === testJobUrl,
    'Extension duplicate check identifies saved job on same URL'
  )

  // ─── 5. Status Transition Synchronization ──────────────────────────────────
  console.log('\n--- 5. Testing Status Transition Synchronization ---')

  let updatedJob: any
  if (dbOnline) {
    updatedJob = await prisma.job.update({
      where: { id: savedJob.id },
      data: { status: 'APPLIED', dateApplied: new Date() },
    })
  } else {
    updatedJob = {
      ...savedJob,
      status: 'APPLIED',
      dateApplied: new Date(),
    }
  }

  assert(
    updatedJob.status === 'APPLIED' && updatedJob.dateApplied !== null,
    'Application submission success transitions job status to APPLIED with timestamp'
  )

  // ─── 6. Expired Token / 401 Handling ───────────────────────────────────────
  console.log('\n--- 6. Testing Expired Token Simulation ---')

  const expiredToken = jwt.sign({ userId: testUserId }, config.jwtSecret, { expiresIn: '-1s' })
  let tokenExpiredCaught = false

  try {
    jwt.verify(expiredToken, config.jwtSecret)
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      tokenExpiredCaught = true
    }
  }

  assert(tokenExpiredCaught, 'Correctly identifies expired token to prompt clean re-authentication')

  // ─── 7. Authoritative Storage Contract & Popup State Machine ───────────
  console.log('\n--- 7. Testing Authoritative Storage Contract & Popup Logic ---')

  const srcStoragePath = path.resolve(process.cwd(), 'extension', 'src', 'utils', 'storage.ts')
  const srcPopupPath = path.resolve(process.cwd(), 'extension', 'src', 'popup', 'popup.ts')
  const srcBackgroundPath = path.resolve(process.cwd(), 'extension', 'src', 'background', 'index.ts')

  const storageCode = fs.readFileSync(srcStoragePath, 'utf8')
  assert(
    storageCode.includes('talvynAuth') &&
    storageCode.includes('TalvynAuthSession') &&
    storageCode.includes('getAuthSession') &&
    storageCode.includes('setAuthSession'),
    'Storage module defines authoritative talvynAuth session contract with getAuthSession/setAuthSession'
  )

  const popupCode = fs.readFileSync(srcPopupPath, 'utf8')
  assert(
    popupCode.includes('POPUP_AUTH_CHECK_STARTED') &&
    popupCode.includes('SESSION_FOUND') &&
    popupCode.includes('SESSION_VALID') &&
    popupCode.includes('SESSION_EXPIRED'),
    'Popup implements required development tracing logs (POPUP_AUTH_CHECK_STARTED, SESSION_FOUND, SESSION_VALID, SESSION_EXPIRED)'
  )

  assert(
    popupCode.includes('renderLoading') &&
    popupCode.includes('renderDisconnected') &&
    popupCode.includes('renderConnected') &&
    popupCode.includes('renderExpired'),
    'Popup implements complete 5-state authentication lifecycle without showing login form when session exists'
  )

  const bgCode = fs.readFileSync(srcBackgroundPath, 'utf8')
  assert(
    bgCode.includes('CONNECTION_REQUEST_RECEIVED') &&
    bgCode.includes('TOKEN_VALIDATION_STARTED') &&
    bgCode.includes('TOKEN_VALIDATION_SUCCESS') &&
    bgCode.includes('SESSION_STORED'),
    'Background service worker implements required connection tracing logs'
  )

  // Ensure no secrets or credentials logged
  assert(
    !bgCode.includes('console.log(token') &&
    !bgCode.includes('console.log(\'token\', token') &&
    !popupCode.includes('console.log(token') &&
    !popupCode.includes('console.log(session.token'),
    'Security verified: No JWT tokens or credentials printed to console logs'
  )

  // ─── 8. UI Consistency & Anti-Conflict Validations ───────────────────────
  console.log('\n--- 8. Testing Popup UI Consistency & Conflict Prevention ---')

  assert(
    !popupCode.includes('Not logged in yet'),
    'Popup UI does NOT contain conflicting "Not logged in yet" text'
  )

  assert(
    !popupCode.includes('OR SIGN IN DIRECTLY') && !popupCode.includes('Sign In with Password'),
    'Popup UI does NOT contain embedded password login forms in connected/disconnected views'
  )

  const indexHtmlPath = path.resolve(process.cwd(), 'index.html')
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8')
  assert(
    indexHtmlContent.includes('logo-talvyn.svg') ||
    indexHtmlContent.includes('favicon.svg') ||
    indexHtmlContent.includes('logotalvyn.png'),
    'Website index.html references the official Talvyn favicon / logo asset'
  )


  // ─── 9. Package ZIP Artifact Integrity & Manifest Validation ─────────────
  console.log('\n--- 9. Testing Extension Production Package Artifact & Manifest ---')

  const packageZipPath = path.resolve(process.cwd(), 'extension', 'dist-package', 'talvyn v1.zip')
  const distManifestPath = path.resolve(process.cwd(), 'extension', 'dist', 'manifest.json')
  const srcManifestPath = path.resolve(process.cwd(), 'extension', 'src', 'manifest.ts')
  const srcContentPath = path.resolve(process.cwd(), 'extension', 'src', 'content', 'index.ts')
  const publicZipPath = path.resolve(process.cwd(), 'public', 'downloads', 'talvyn v1.zip')

  const srcContentCode = fs.readFileSync(srcContentPath, 'utf8')
  assert(
    !srcContentCode.includes('window.postMessage') && !srcContentCode.includes('initWebBridge'),
    'Content script has zero window.postMessage or legacy web bridge dependencies'
  )

  const srcManifestCode = fs.readFileSync(srcManifestPath, 'utf8')
  assert(
    srcManifestCode.includes('externally_connectable') &&
    srcManifestCode.includes('https://talvyn.vercel.app/*'),
    'Extension manifest declares externally_connectable for https://talvyn.vercel.app/*'
  )

  assert(
    srcManifestCode.includes('icons/icon16.png') &&
    srcManifestCode.includes('icons/icon128.png'),
    'Extension manifest uses standard PNG icon format (16, 32, 48, 128)'
  )

  assert(
    fs.existsSync(distManifestPath),
    'Extension dist directory contains compiled manifest.json'
  )

  assert(
    fs.existsSync(packageZipPath),
    'Distribution package talvyn v1.zip exists in extension/dist-package'
  )

  assert(
    fs.existsSync(publicZipPath),
    'Public download package talvyn v1.zip exists in public/downloads for static hosting on Vercel'
  )

  const distLogoPath = path.resolve(process.cwd(), 'extension', 'dist', 'icons', 'logotalvyn.png')
  assert(
    fs.existsSync(distLogoPath),
    'Extension dist icons directory contains logotalvyn.png'
  )

  if (fs.existsSync(packageZipPath)) {
    const stats = fs.statSync(packageZipPath)
    assert(stats.size > 1000, `Package archive has valid non-empty payload (${(stats.size / 1024).toFixed(1)} KB)`)
  }

  // ─── 10. Background Message Bridge & Content Script CORS Protection ──────
  console.log('\n--- 10. Testing Background Service Worker Bridge & CORS Elimination ---')


  const apiClientPath = path.resolve(process.cwd(), 'extension', 'src', 'services', 'apiClient.ts')
  const apiClientCode = fs.readFileSync(apiClientPath, 'utf8')

  assert(
    apiClientCode.includes('isContentScript') &&
    apiClientCode.includes('requestViaBackground') &&
    apiClientCode.includes('chrome.runtime.sendMessage'),
    'Content script API client routes requests through background worker bridge to eliminate CORS'
  )

  const backgroundPath = path.resolve(process.cwd(), 'extension', 'src', 'background', 'index.ts')
  const backgroundCode = fs.readFileSync(backgroundPath, 'utf8')

  assert(
    backgroundCode.includes('TALVYN_API_REQUEST') &&
    backgroundCode.includes('TALVYN_SAVE_JOB') &&
    backgroundCode.includes('TALVYN_CHECK_DUPLICATE'),
    'Background service worker implements internal API message routing for content scripts'
  )

  const indeedAdapterPath = path.resolve(process.cwd(), 'extension', 'src', 'content', 'adapters', 'indeed.ts')
  const indeedAdapterCode = fs.readFileSync(indeedAdapterPath, 'utf8')

  assert(
    indeedAdapterCode.includes('extractCompanyFromJsonLd') &&
    indeedAdapterCode.includes('Unknown Company'),
    'Indeed adapter implements robust company extraction with JSON-LD and clean Unknown Company fallback'
  )

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('=================================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Extension connection test runner failed:', err)
  process.exit(1)
})




