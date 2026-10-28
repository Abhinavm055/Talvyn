import assert from 'node:assert/strict'
import { isGenuineUpgrade, shouldShowReleaseNotice } from '../src/services/releaseLifecycle'
import { compareVersions } from '../../src/utils/compareVersions'

assert.equal(isGenuineUpgrade('install', undefined, '1.2.0'), false, 'first install does not count as an upgrade')
assert.equal(isGenuineUpgrade('update', undefined, '1.2.0'), false, 'missing previous version does not claim an upgrade')
assert.equal(isGenuineUpgrade('update', '1.2.0', '1.2.0'), false, 'restarts do not count as upgrades')
assert.equal(isGenuineUpgrade('update', '1.1.0', '1.2.0'), true, 'a real runtime version change creates a notice')

assert.equal(shouldShowReleaseNotice(undefined, '1.2.0', undefined), false, 'first install has no pending notice')
assert.equal(shouldShowReleaseNotice('1.1.0', '1.2.0', undefined), false, 'notice only matches the running manifest version')
assert.equal(shouldShowReleaseNotice('1.2.0', '1.2.0', undefined), true, 'new version notice is visible')
assert.equal(shouldShowReleaseNotice('1.2.0', '1.2.0', '1.2.0'), false, 'dismissal is remembered for this version')
assert.equal(shouldShowReleaseNotice('1.3.0', '1.3.0', '1.2.0'), true, 'a later release can show a new notice')

assert.equal(compareVersions('1.2.0', '1.1.9'), 1, 'newer installed release compares correctly')
assert.equal(compareVersions('1.2', '1.2.0'), 0, 'missing trailing zero is equivalent')
assert.equal(compareVersions('1.0.0', '1.2.0'), -1, 'stale installed release compares correctly')
assert.equal(compareVersions('not-a-version', '1.2.0'), null, 'invalid version is not treated as an update')

console.log('✓ Release lifecycle regression checks passed')
