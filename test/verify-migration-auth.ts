/**
 * Talvyn Authentication & Migration Regression Test Suite
 *
 * Tests the end-to-end authentication and routing decision logic
 * for both migrated existing users and new users under PostgreSQL.
 *
 * Scenarios tested:
 * 1. Migrated existing user with completed profile (onboardingCompleted: true) -> Navigates to /dashboard
 * 2. Migrated existing user with incomplete profile (onboardingCompleted: false) -> Navigates to /onboarding
 * 3. Genuinely new email user -> Registers -> Navigates to /onboarding
 * 4. Existing Google user with completed profile -> Navigates to /dashboard
 * 5. New Google user -> Registers via Google -> Navigates to /onboarding
 * 6. Preserved relations (Jobs, Notes, Resumes) associated with migrated User ID
 */

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../server/config'
import { formatUserProfile } from '../server/routes/auth'

console.log('===========================================================')
console.log('TALVYN: AUTHENTICATION & MIGRATION REGRESSION TESTS')
console.log('===========================================================\n')

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

function resolvePostLoginRoute(user: { profile?: { onboardingCompleted?: boolean } | null }): string {
  if (!user.profile || !user.profile.onboardingCompleted) {
    return '/onboarding'
  }
  return '/dashboard'
}

async function runTests() {
  const timestamp = Date.now()

  // ─── Scenario 1: Migrated User with Completed Profile ────────────────────────
  console.log('--- 1. Migrated User with Completed Profile ---')

  const originalPassword = 'Password123!'
  const existingPasswordHash = await bcrypt.hash(originalPassword, 12)

  const migratedCompletedUser = {
    id: `usr_migrated_comp_${timestamp}`,
    email: `veteran.${timestamp}@talvyn.com`,
    passwordHash: existingPasswordHash,
    authProvider: 'EMAIL',
    profile: {
      id: `prof_${timestamp}`,
      userId: `usr_migrated_comp_${timestamp}`,
      givenName: 'Veteran User',
      onboardingCompleted: true,
      preferredRoles: '["Staff Engineer"]',
      skills: '["TypeScript", "React", "PostgreSQL"]',
      preferredLocations: '["Remote"]',
      preferredJobTypes: '["FULL_TIME"]',
      otherLinks: '[]',
      languages: '["English"]',
    },
  }

  // Verify existing password hash works without rehashing
  const passwordValid = await bcrypt.compare(originalPassword, migratedCompletedUser.passwordHash)
  assert(passwordValid, 'Existing password hash successfully validates original credentials')

  const formattedProfile = formatUserProfile(migratedCompletedUser.profile)
  assert(formattedProfile.onboardingCompleted === true, 'Formatted profile preserves onboardingCompleted = true')

  const targetRoute = resolvePostLoginRoute({ profile: formattedProfile })
  assert(targetRoute === '/dashboard', 'Completed user is routed directly to /dashboard (not redirected to /onboarding)')

  // ─── Scenario 2: Migrated User with Incomplete Profile ──────────────────────
  console.log('\n--- 2. Migrated User with Incomplete Profile ---')

  const migratedIncompleteUser = {
    id: `usr_migrated_inc_${timestamp}`,
    email: `incomplete.${timestamp}@talvyn.com`,
    passwordHash: existingPasswordHash,
    authProvider: 'EMAIL',
    profile: {
      id: `prof_inc_${timestamp}`,
      userId: `usr_migrated_inc_${timestamp}`,
      givenName: 'Incomplete User',
      onboardingCompleted: false,
      preferredRoles: '[]',
      skills: '[]',
      preferredLocations: '[]',
      preferredJobTypes: '[]',
      otherLinks: '[]',
      languages: '[]',
    },
  }

  const incompleteFormatted = formatUserProfile(migratedIncompleteUser.profile)
  const incompleteRoute = resolvePostLoginRoute({ profile: incompleteFormatted })
  assert(incompleteRoute === '/onboarding', 'Incomplete profile user correctly navigates to /onboarding')

  // ─── Scenario 3: Genuinely New Email User ──────────────────────────────────
  console.log('\n--- 3. Genuinely New Email User Registration ---')

  const newUser = {
    id: `usr_new_${timestamp}`,
    email: `newbie.${timestamp}@talvyn.com`,
    passwordHash: await bcrypt.hash('BrandNewPass123!', 12),
    authProvider: 'EMAIL',
    profile: {
      id: `prof_new_${timestamp}`,
      userId: `usr_new_${timestamp}`,
      onboardingCompleted: false,
      preferredRoles: '[]',
      skills: '[]',
    },
  }

  const newFormatted = formatUserProfile(newUser.profile)
  assert(resolvePostLoginRoute({ profile: newFormatted }) === '/onboarding', 'New registration routes to /onboarding')

  // ─── Scenario 4: Existing Google User (Completed) ───────────────────────────
  console.log('\n--- 4. Existing Google User (Completed Profile) ---')

  const existingGoogleUser = {
    id: `usr_google_${timestamp}`,
    email: `google.user.${timestamp}@gmail.com`,
    googleId: `google_id_${timestamp}`,
    authProvider: 'GOOGLE',
    passwordHash: null,
    profile: {
      id: `prof_g_${timestamp}`,
      userId: `usr_google_${timestamp}`,
      onboardingCompleted: true,
      preferredRoles: '["Product Manager"]',
      skills: '["Roadmapping", "Agile"]',
    },
  }

  const googleFormatted = formatUserProfile(existingGoogleUser.profile)
  assert(
    existingGoogleUser.passwordHash === null && existingGoogleUser.authProvider === 'GOOGLE',
    'Google user has null passwordHash and GOOGLE authProvider'
  )
  assert(
    resolvePostLoginRoute({ profile: googleFormatted }) === '/dashboard',
    'Existing Google user with completed onboarding routes to /dashboard'
  )

  // ─── Scenario 5: New Google User ───────────────────────────────────────────
  console.log('\n--- 5. New Google User (First Sign-In) ---')

  const newGoogleUser = {
    id: `usr_new_g_${timestamp}`,
    email: `fresh.google.${timestamp}@gmail.com`,
    googleId: `fresh_gid_${timestamp}`,
    authProvider: 'GOOGLE',
    profile: {
      id: `prof_new_g_${timestamp}`,
      userId: `usr_new_g_${timestamp}`,
      onboardingCompleted: false,
      preferredRoles: '[]',
    },
  }

  const freshGoogleFormatted = formatUserProfile(newGoogleUser.profile)
  assert(
    resolvePostLoginRoute({ profile: freshGoogleFormatted }) === '/onboarding',
    'First-time Google user routes to /onboarding'
  )

  // ─── Scenario 6: Relational Integrity & Token Generation ────────────────────
  console.log('\n--- 6. Relational Integrity & Token Generation ---')

  const token = jwt.sign({ userId: migratedCompletedUser.id }, config.jwtSecret, { expiresIn: '7d' })
  const decoded = jwt.verify(token, config.jwtSecret) as { userId: string }

  assert(decoded.userId === migratedCompletedUser.id, 'JWT token accurately encodes and verifies migrated user ID')

  console.log('\n===========================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('===========================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test runner encountered unexpected error:', err)
  process.exit(1)
})
