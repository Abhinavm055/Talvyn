/** Run repository suites with an explicitly isolated database configuration. */
import { spawnSync } from 'node:child_process'
import { config as loadEnvironment } from 'dotenv'

loadEnvironment()
const dedicatedDatabase = process.env.TALVYN_TEST_DATABASE_URL?.trim()
// Tests must never inherit the application database, even if a legacy fixture
// probes Prisma before deciding whether persistence is available.
const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: dedicatedDatabase || 'postgresql://talvyn_test:unused@127.0.0.1:1/talvyn_test?connect_timeout=1',
}
const suites: Record<string, string[]> = {
  "security": [
    "test/verify-extension-identity.ts",
    "test/verify-github-release-artifacts.ts",
    "test/verify-extension-release-metadata.ts",
    "extension/test/verify-reviewed-autofill.ts",
    "extension/test/verify-autofill-review-plan.ts",
    "test/verify-upload-access.ts",
    "extension/test/verify-user-edit-preservation.ts",
    "extension/test/verify-native-application-safety.ts",
    "extension/test/verify-job-requirement-evidence.ts",
    "test/verify-test-database-isolation.ts",
    "test/verify-secure-pairing.ts",
    "test/verify-website-extension-bridge.ts",
    "test/verify-website-cookie-auth.ts",
    "extension/test/verify-secure-connection.ts",
    "extension/test/verify-local-ai.ts",
    "extension/test/verify-analysis-safeguards.ts"
  ],
  "regression": [
    "test/verify-extension-distribution-ui.tsx",
    "test/verify-saved-search-ui.tsx",
    "test/verify-dropdowns-auth.ts",
    "test/verify-extension-sessions.ts",
    "test/verify-google-auth.ts",
    "test/verify-onboarding-taginput.ts",
    "test/verify-smart-inputs.ts",
    "test/verify-profile-resume-storage.ts",
    "test/verify-extension-connection.ts",
    "test/verify-migration-auth.ts",
    "test/verify-status-synchronization.ts",
    "test/verify-resume-onboarding.ts",
    "test/verify-jd-autofill.ts",
    "extension/test/verify-scoring.ts",
    "extension/test/verify-autofill.ts",
    "extension/test/verify-success-detection.ts",
    "extension/test/verify-opportunity-timeline.ts",
    "extension/test/verify-hardening.ts",
    "extension/test/verify-application-assistant.ts",
    "extension/test/verify-extension-apply-action.ts",
    "extension/test/verify-job-detection-gate.ts",
    "extension/test/verify-ux-and-profile.ts",
    "extension/test/verify-part1-auth-flow.ts",
    "extension/test/verify-part2-floating-intelligence.ts",
    "extension/test/verify-part3-universal-analysis.ts",
    "extension/test/verify-universal-anchor-fallback.ts",
    "extension/test/verify-custom-elements-no-throw.ts",
    "extension/test/verify-runtime-fixes.ts",
    "extension/test/verify-job-context-lifecycle.ts",
    "extension/test/verify-popup-modes.ts",
    "extension/test/verify-release-lifecycle.ts"
  ]
}
const suite = process.argv[2]
if (!suites[suite]) throw new Error('Choose the security or regression suite.')
console.log(dedicatedDatabase
  ? 'Database integration checks use TALVYN_TEST_DATABASE_URL. Use a disposable migrated test database.'
  : 'No dedicated test database configured; database persistence checks are skipped or use explicitly reported fixtures.')
for (const test of suites[suite]) {
  const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), test], {
    cwd: process.cwd(), env: testEnvironment, stdio: 'inherit',
  })
  if (result.error) { console.error('Could not start test:', test); process.exit(1) }
  if (result.status !== 0) process.exit(result.status || 1)
}

