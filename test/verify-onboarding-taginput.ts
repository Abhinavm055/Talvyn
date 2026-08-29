/**
 * Automated Verification Test for Talvyn:
 * TagInput & Onboarding Robustness & Array Normalization
 *
 * Tests:
 * 1. TagInput with []
 * 2. TagInput with undefined
 * 3. TagInput with null
 * 4. TagInput with a string (single item)
 * 5. TagInput with a comma-separated string
 * 6. TagInput with JSON string ('["TypeScript", "React"]')
 * 7. TagInput with empty JSON string ('[]')
 * 8. TagInput with malformed JSON string ('{"invalid-json')
 * 9. TagInput with valid string[]
 * 10. Frontend API normalizeProfile with incomplete/null profile
 * 11. Frontend API normalizeProfile with raw SQLite string arrays
 * 12. Backend Google user creation profile defaults
 * 13. Backend auth response formatUserProfile deserialization
 * 14. React Hook Form defaultValues simulation
 */

import { normalizeTags } from '../src/components/ui/TagInput'
import { normalizeProfile, safeArray } from '../src/api/profile'
import { formatUserProfile } from '../server/routes/auth'
import { googleAuthService } from '../server/services/googleAuthService'

console.log('=================================================================')
console.log('TALVYN: TAGINPUT & ONBOARDING ROBUSTNESS VERIFICATION TESTS')
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
  // ─── 1. TagInput normalization with [] ─────────────────────────────────────
  console.log('--- 1. TagInput with Empty Array ---')
  const r1 = normalizeTags([])
  assert(Array.isArray(r1) && r1.length === 0, 'normalizeTags([]) returns []')

  // ─── 2. TagInput normalization with undefined ──────────────────────────────
  console.log('\n--- 2. TagInput with undefined ---')
  const r2 = normalizeTags(undefined)
  assert(Array.isArray(r2) && r2.length === 0, 'normalizeTags(undefined) returns [] without throwing')

  // ─── 3. TagInput normalization with null ───────────────────────────────────
  console.log('\n--- 3. TagInput with null ---')
  const r3 = normalizeTags(null)
  assert(Array.isArray(r3) && r3.length === 0, 'normalizeTags(null) returns [] without throwing')

  // ─── 4. TagInput normalization with a single string ────────────────────────
  console.log('\n--- 4. TagInput with Single String ---')
  const r4 = normalizeTags('Software Engineer')
  assert(
    Array.isArray(r4) && r4.length === 1 && r4[0] === 'Software Engineer',
    'normalizeTags("Software Engineer") safely wraps in array: ["Software Engineer"]'
  )

  // ─── 5. TagInput normalization with comma-separated string ─────────────────
  console.log('\n--- 5. TagInput with Comma-Separated String ---')
  const r5 = normalizeTags('React, TypeScript, Node.js')
  assert(
    Array.isArray(r5) && r5.length === 3 && r5[1] === 'TypeScript',
    'normalizeTags("React, TypeScript, Node.js") splits into clean string array'
  )

  // ─── 6. TagInput normalization with JSON string ────────────────────────────
  console.log('\n--- 6. TagInput with JSON Array String ---')
  const r6 = normalizeTags('["Python", "Go", "Rust"]')
  assert(
    Array.isArray(r6) && r6.length === 3 && r6[0] === 'Python',
    'normalizeTags("[\"Python\", \"Go\", \"Rust\"]") parses correctly'
  )

  // ─── 7. TagInput normalization with empty JSON string ──────────────────────
  console.log('\n--- 7. TagInput with Empty JSON Array String ---')
  const r7 = normalizeTags('[]')
  assert(Array.isArray(r7) && r7.length === 0, 'normalizeTags("[]") returns []')

  // ─── 8. TagInput normalization with malformed JSON string ──────────────────
  console.log('\n--- 8. TagInput with Malformed JSON String ---')
  const r8 = normalizeTags('{"malformed: [unclosed')
  assert(
    Array.isArray(r8) && typeof r8.map === 'function',
    'normalizeTags with malformed JSON string returns safe array that can call .map()'
  )

  // ─── 9. TagInput normalization with valid string[] ─────────────────────────
  console.log('\n--- 9. TagInput with Valid string[] ---')
  const r9 = normalizeTags(['Frontend', 'Full Stack', ''])
  assert(
    Array.isArray(r9) && r9.length === 2 && r9[0] === 'Frontend',
    'normalizeTags(["Frontend", "Full Stack", ""]) filters empty items'
  )

  // ─── 10. Frontend API normalizeProfile with incomplete/null profile ────────
  console.log('\n--- 10. Frontend API normalizeProfile with null ---')
  const p10 = normalizeProfile(null)
  assert(
    Array.isArray(p10.skills) &&
    Array.isArray(p10.preferredRoles) &&
    Array.isArray(p10.preferredLocations) &&
    Array.isArray(p10.preferredJobTypes) &&
    Array.isArray(p10.otherLinks),
    'normalizeProfile(null) initializes all array fields to []'
  )

  // ─── 11. Frontend API normalizeProfile with raw SQLite string arrays ───────
  console.log('\n--- 11. Frontend API normalizeProfile with SQLite JSON Strings ---')
  const p11 = normalizeProfile({
    skills: '["Docker", "Kubernetes"]' as any,
    preferredRoles: '[]' as any,
    preferredLocations: 'San Francisco, New York' as any,
  })
  assert(
    Array.isArray(p11.skills) && p11.skills.length === 2 &&
    Array.isArray(p11.preferredRoles) && p11.preferredRoles.length === 0 &&
    Array.isArray(p11.preferredLocations) && p11.preferredLocations.length === 2,
    'normalizeProfile accurately decodes all string variants into string[] arrays'
  )

  // ─── 12. Backend Google User Creation Profile Defaults ─────────────────────
  console.log('\n--- 12. Google User Profile Creation Defaults ---')
  const testSub = `sub-onboarding-test-${Date.now()}`
  const mockToken = `test-google-token:${JSON.stringify({
    sub: testSub,
    email: `onboarding.test.${Date.now()}@example.com`,
    name: 'Alex Johnson',
    given_name: 'Alex',
    family_name: 'Johnson',
    email_verified: true,
    exp: Math.floor((Date.now() + 3600000) / 1000),
    iss: 'https://accounts.google.com',
  })}`

  const verifiedGoogle = await googleAuthService.verifyGoogleToken(mockToken)
  const authResult = await googleAuthService.authenticateGoogleUser(verifiedGoogle)
  const formattedProfile = formatUserProfile(authResult.user.profile)

  assert(
    authResult.isNewUser === true &&
    Array.isArray(formattedProfile.skills) &&
    Array.isArray(formattedProfile.preferredRoles) &&
    Array.isArray(formattedProfile.preferredLocations) &&
    Array.isArray(formattedProfile.otherLinks),
    'New Google user has safe deserialized array fields on profile'
  )

  // ─── 13. React Hook Form defaultValues simulation ──────────────────────────
  console.log('\n--- 13. React Hook Form defaultValues Simulation ---')
  const rawProfileFromGoogleSignup = authResult.user.profile
  const hookFormDefaultValues = {
    givenName: rawProfileFromGoogleSignup?.givenName || '',
    email: authResult.user.email || '',
    preferredRoles: normalizeTags(rawProfileFromGoogleSignup?.preferredRoles),
    skills: normalizeTags(rawProfileFromGoogleSignup?.skills),
    otherLinks: normalizeTags(rawProfileFromGoogleSignup?.otherLinks),
    preferredLocations: normalizeTags(rawProfileFromGoogleSignup?.preferredLocations),
  }

  assert(
    Array.isArray(hookFormDefaultValues.skills) &&
    Array.isArray(hookFormDefaultValues.preferredRoles) &&
    typeof hookFormDefaultValues.skills.map === 'function',
    'React Hook Form defaultValues for all TagInput fields are guaranteed arrays with working .map()'
  )

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('=================================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
