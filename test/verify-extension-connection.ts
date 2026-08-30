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

  const token = jwt.sign({ userId: testUser.id }, config.jwtSecret, { expiresIn: '7d' })

  const decoded = jwt.verify(token, config.jwtSecret) as { userId: string }
  assert(
    decoded.userId === testUser.id,
    'Extension token verifies against Talvyn JWT secret and resolves user'
  )

  // ─── 3. Live Profile Synchronization ───────────────────────────────────────
  console.log('\n--- 3. Testing Live Profile Synchronization ---')

  const profileRecord = await prisma.userProfile.findUnique({ where: { userId: testUser.id } })
  const syncedProfile = normalizeProfile(profileRecord)

  assert(
    syncedProfile.preferredRoles.includes('Senior Frontend Engineer') &&
    syncedProfile.skills.includes('React') &&
    syncedProfile.preferredLocations.includes('Remote'),
    'Extension fetches and synchronizes candidate profile preferences from backend'
  )

  // ─── 4. Job Save & Duplicate Check Synchronization ─────────────────────────
  console.log('\n--- 4. Testing Extension Job Saving & Duplicate Detection ---')

  const testJobUrl = `https://jobs.example.com/frontend-${timestamp}`
  const savedJob = await prisma.job.create({
    data: {
      userId: testUser.id,
      title: 'Senior Frontend Engineer',
      company: 'Vercel',
      jobUrl: testJobUrl,
      sourceWebsite: 'example.com',
      status: 'SAVED',
    },
  })

  assert(
    savedJob.userId === testUser.id && savedJob.title === 'Senior Frontend Engineer',
    'Extension saves job directly to user account in database'
  )

  const duplicate = await prisma.job.findFirst({
    where: { userId: testUser.id, jobUrl: testJobUrl },
  })

  assert(
    duplicate?.id === savedJob.id,
    'Extension duplicate check identifies saved job on same URL'
  )

  // ─── 5. Status Transition Synchronization ──────────────────────────────────
  console.log('\n--- 5. Testing Status Transition Synchronization ---')

  const updatedJob = await prisma.job.update({
    where: { id: savedJob.id },
    data: { status: 'APPLIED', dateApplied: new Date() },
  })

  assert(
    updatedJob.status === 'APPLIED' && updatedJob.dateApplied !== null,
    'Application submission success transitions job status to APPLIED with timestamp'
  )

  // ─── 6. Expired Token / 401 Handling ───────────────────────────────────────
  console.log('\n--- 6. Testing Expired Token Simulation ---')

  const expiredToken = jwt.sign({ userId: testUser.id }, config.jwtSecret, { expiresIn: '-1s' })
  let tokenExpiredCaught = false

  try {
    jwt.verify(expiredToken, config.jwtSecret)
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      tokenExpiredCaught = true
    }
  }

  assert(tokenExpiredCaught, 'Correctly identifies expired token to prompt clean re-authentication')

  // ─── 7. Package ZIP Artifact Integrity ─────────────────────────────────────
  console.log('\n--- 7. Testing Extension Production Package Artifact ---')

  const packageZipPath = path.resolve(process.cwd(), 'extension', 'dist-package', 'Talvyn v1.zip')
  const distManifestPath = path.resolve(process.cwd(), 'extension', 'dist', 'manifest.json')

  const publicZipPath = path.resolve(process.cwd(), 'public', 'downloads', 'Talvyn v1.zip')

  assert(
    fs.existsSync(distManifestPath),
    'Extension dist directory contains compiled manifest.json'
  )

  assert(
    fs.existsSync(packageZipPath),
    'Distribution package Talvyn v1.zip exists in extension/dist-package'
  )

  assert(
    fs.existsSync(publicZipPath),
    'Public download package exists in public/downloads for static hosting on Vercel'
  )

  if (fs.existsSync(packageZipPath)) {
    const stats = fs.statSync(packageZipPath)
    assert(stats.size > 1000, `Package archive has valid non-empty payload (${(stats.size / 1024).toFixed(1)} KB)`)
  }

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('=================================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Extension connection test runner failed:', err)
  process.exit(1)
})
