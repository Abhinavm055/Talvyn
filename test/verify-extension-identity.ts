import assert from 'node:assert/strict'
import { createHash, createPublicKey } from 'node:crypto'
import {
  deriveExtensionIdentity, resolveManifestExtensionIdentity,
  resolveTrustedExtensionIds, resolveWebsiteExtensionId,
} from '../server/services/extensionIdentity'

// PUBLIC test vector only: RFC 7517 Appendix A.1. No key pair is generated,
// and no private component or usable production identity is configured here.
// https://www.rfc-editor.org/rfc/rfc7517#appendix-A.1
const publicRsa = createPublicKey({ format: 'jwk', key: {
  kty: 'RSA', e: 'AQAB',
  n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx' +
    '4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMs' +
    'tn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2' +
    'QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbI' +
    'SD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqb' +
    'w0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
} })
const bytes = publicRsa.export({ format: 'der', type: 'spki' })
const publicKey = bytes.toString('base64')
const fixtureId = createHash('sha256').update(bytes).digest().subarray(0, 16)
  .reduce((id, byte) => id + 'abcdefghijklmnop'[byte >> 4] + 'abcdefghijklmnop'[byte & 15], '')
let checks = 0
function equal(actual: unknown, expected: unknown, message: string) { assert.deepEqual(actual, expected, message); checks++ }
function rejects(action: () => unknown, message: string) { assert.throws(action, undefined, message); checks++ }

equal(publicRsa.asymmetricKeyType, 'rsa', 'fixture is a genuine public RSA key')
equal(deriveExtensionIdentity(publicKey), { publicKey, extensionId: fixtureId }, 'canonical SPKI bytes use Chrome SHA256/a-p ID encoding')
equal(deriveExtensionIdentity(` \n${publicKey}\n `).extensionId, fixtureId, 'outer whitespace does not alter identity')
equal(/^[a-p]{32}$/.test(fixtureId), true, 'ID has Chrome format')
for (const invalid of [
  '', 'a'.repeat(64), publicKey.slice(0, -1), `${publicKey}\n${publicKey}`,
  '-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----',
  '-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----',
  Buffer.concat([bytes, Buffer.from([0])]).toString('base64'), 'A'.repeat(16388),
]) rejects(() => deriveExtensionIdentity(invalid), 'invalid/noncanonical/private-shaped key is rejected')

const devId = 'b'.repeat(32)
const explicitId = 'c'.repeat(32)
const env = {
  TALVYN_EXTENSION_PUBLIC_KEY: publicKey,
  TALVYN_DEV_EXTENSION_IDS: devId,
  TALVYN_EXTENSION_IDS: `${explicitId},invalid,${explicitId}`,
}
equal(resolveManifestExtensionIdentity('production', {}), undefined, 'unconfigured local packaging remains possible')
equal(resolveWebsiteExtensionId('production', {}), '', 'missing key never invents a production ID')
equal(resolveTrustedExtensionIds('production', {}), [], 'missing identity leaves the backend closed')
equal(resolveManifestExtensionIdentity('production', env)?.extensionId, fixtureId, 'production manifest uses owner public key')
equal(resolveManifestExtensionIdentity('development', env), undefined, 'development does not inherit production key')
equal(resolveWebsiteExtensionId('production', env), fixtureId, 'production website targets key-derived ID')
equal(resolveWebsiteExtensionId('development', env), '', 'production key does not silently configure development site')
equal(resolveTrustedExtensionIds('production', env), [fixtureId, explicitId], 'production ignores development IDs and preserves explicit owner allowlist')
equal(resolveTrustedExtensionIds('development', env), [explicitId, devId], 'development uses separate IDs plus compatible explicit allowlist')
equal(resolveWebsiteExtensionId('production', { ...env, VITE_TALVYN_EXTENSION_ID: fixtureId }), fixtureId, 'matching legacy production setting is accepted')
rejects(() => resolveWebsiteExtensionId('production', { ...env, VITE_TALVYN_EXTENSION_ID: devId }), 'manual production ID cannot override key-derived identity')
rejects(() => resolveWebsiteExtensionId('production', { VITE_TALVYN_EXTENSION_ID: devId }), 'manual production ID cannot bypass missing key')
equal(resolveWebsiteExtensionId('development', { ...env, VITE_TALVYN_EXTENSION_ID: devId }), devId, 'development can target actual path-dependent ID')
rejects(() => resolveWebsiteExtensionId('development', { VITE_TALVYN_EXTENSION_ID: 'invalid' }), 'invalid development ID rejected')
const keyedDev = { ...env, TALVYN_DEV_EXTENSION_PUBLIC_KEY: publicKey }
equal(resolveManifestExtensionIdentity('development', keyedDev)?.extensionId, fixtureId, 'explicit development public key is supported')
equal(resolveWebsiteExtensionId('development', keyedDev), fixtureId, 'development website can derive its own supplied public-key ID')
equal(resolveTrustedExtensionIds('development', keyedDev), [fixtureId, explicitId, devId], 'development backend includes separately derived identity')
rejects(() => resolveWebsiteExtensionId('development', { ...keyedDev, VITE_TALVYN_EXTENSION_ID: devId }), 'inconsistent development ID/key rejected')
equal(resolveManifestExtensionIdentity('production', { ...env, TALVYN_DEV_EXTENSION_PUBLIC_KEY: 'invalid' })?.extensionId, fixtureId, 'production ignores development key')
rejects(() => resolveManifestExtensionIdentity('production', { TALVYN_EXTENSION_PUBLIC_KEY: 'invalid' }), 'invalid owner key fails closed')
console.log(`✓ Extension identity configuration: ${checks} public-key, derivation and production/development checks passed (no real Chrome validation).`)
