/** Offline fixture tests only. No GitHub write, real owner identity or publication. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createPublicKey } from 'node:crypto'
import { allowedReleasePath, assertBuildMatchesArchive, assertProductionManifest, CHECKSUM_NAME, crc32, createReleaseZip, NOTES_NAME, readBuildFiles, readReleaseZip, repositoryForRelease, sha256, validateReleaseTag, ZIP_NAME } from '../scripts/github-release-artifacts'
import { prepareGitHubRelease } from '../scripts/prepare-github-release'
import { deriveExtensionIdentity } from '../server/services/extensionIdentity'
import { validatePublishedRelease } from '../server/contracts/extensionRelease'

// PUBLIC test vector: RFC 7517 Appendix A.1; never used as production configuration.
const publicKey = createPublicKey({ format: 'jwk', key: {
  kty: 'RSA', e: 'AQAB',
  n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx' +
    '4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMs' +
    'tn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2' +
    'QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbI' +
    'SD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqb' +
    'w0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
} }).export({ format: 'der', type: 'spki' }).toString('base64')
const repository = 'Abhinavm055/Talvyn'
const version = '1.3.0'
const tag = `v${version}`
const manifest = {
  manifest_version: 3, version, key: publicKey,
  background: { service_worker: 'service-worker-loader.js', type: 'module' },
  action: { default_popup: 'src/popup/index.html', default_icon: { 16: 'icons/icon16.png' } },
  icons: { 16: 'icons/icon16.png' },
  content_scripts: [{ js: ['assets/content.js'], matches: ['https://*/*'] }],
  externally_connectable: { matches: ['https://talvyn.vercel.app/*'] },
  host_permissions: ['https://talvyn-backend-7ucf.onrender.com/*'],
  web_accessible_resources: [{ resources: ['icons/*', 'assets/content.js'] }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
}
const build = new Map<string, Buffer>([
  ['manifest.json', Buffer.from(JSON.stringify(manifest))], ['service-worker-loader.js', Buffer.from('export {}')],
  ['assets/content.js', Buffer.from('console.log("fixture")')], ['src/popup/index.html', Buffer.from('<html></html>')],
  ['icons/icon16.png', Buffer.from([137, 80, 78, 71])],
])
const files = new Map(build)
files.set(NOTES_NAME, Buffer.from(`# Fixture v${version}\nhttps://github.com/${repository}/releases/tag/${tag}\n`))
const zip = createReleaseZip(files)
const digest = sha256(zip)
let checks = 0
function equal(actual: unknown, expected: unknown, message: string): void { assert.deepEqual(actual, expected, message); checks++ }
function rejects(action: () => unknown, message: string): void { assert.throws(action, undefined, message); checks++ }
function accepts(action: () => unknown, message: string): void { assert.doesNotThrow(action, message); checks++ }
equal(crc32(Buffer.from('123456789')), 0xcbf43926, 'CRC32 agrees with the standard test vector')
equal(sha256(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA256 agrees with the standard test vector')
equal(createReleaseZip(new Map([...files].reverse())), zip, 'ZIP is byte-stable across input insertion order and wall time')
equal(readReleaseZip(zip), new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)), 'Every archive file decompresses with matching CRC and contents')
equal(readReleaseZip(zip).has('manifest.json'), true, 'Manifest is at archive root')
equal(readReleaseZip(zip).has(`extension/manifest.json`), false, 'No nested extension folder is introduced')
accepts(() => assertBuildMatchesArchive(build, readReleaseZip(zip)), 'Complete build plus release notes is valid')
rejects(() => assertBuildMatchesArchive(new Map([...build].slice(1)), readReleaseZip(zip)), 'Archive cannot include unrelated extra build files')
rejects(() => assertBuildMatchesArchive(build, new Map(build)), 'Release notes are required')
const differentBuild = new Map(build)
differentBuild.set('assets/content.js', Buffer.from('different build'))
rejects(() => assertBuildMatchesArchive(differentBuild, readReleaseZip(zip)), 'Stale ZIP bytes are detected')
for (const name of ['extension/manifest.json', '../manifest.json', '/manifest.json', 'assets/../server.js', 'assets\\bad.js', '.env', 'assets/source.ts', 'assets/source.js.map', 'node_modules/package.json', 'server/index.js', 'assets/private.pem', 'assets/.env.js', 'icons/../../icon.png']) {
  equal(allowedReleasePath(name), false, `Reject unsafe/source/nonrelease path ${name}`)
  rejects(() => createReleaseZip(new Map([[name, Buffer.from('unwanted')]])), `Writer refuses ${name}`)
}
rejects(() => createReleaseZip(new Map([['assets/A.js', Buffer.from('1')], ['assets/a.js', Buffer.from('2')]])), 'Windows case-colliding names are rejected')
rejects(() => createReleaseZip(new Map()), 'Empty archive is rejected')
rejects(() => readReleaseZip(zip.subarray(0, zip.length - 1)), 'Truncated archive fails')
rejects(() => readReleaseZip(Buffer.concat([zip, Buffer.from('trailer')])), 'Unexpected trailer fails')
const corruptData = Buffer.from(zip)
const firstNameLength = corruptData.readUInt16LE(26)
corruptData[30 + firstNameLength] ^= 0xff
rejects(() => readReleaseZip(corruptData), 'Corrupt compressed bytes fail')
const corruptDirectory = Buffer.from(zip)
const directoryOffset = corruptDirectory.readUInt32LE(corruptDirectory.length - 6)
corruptDirectory.writeUInt32LE((corruptDirectory.readUInt32LE(directoryOffset + 16) ^ 1) >>> 0, directoryOffset + 16)
rejects(() => readReleaseZip(corruptDirectory), 'Central/local CRC disagreement fails')
const corruptBothCrc = Buffer.from(zip)
corruptBothCrc.writeUInt32LE((corruptBothCrc.readUInt32LE(14) ^ 1) >>> 0, 14)
corruptBothCrc.writeUInt32LE((corruptBothCrc.readUInt32LE(directoryOffset + 16) ^ 1) >>> 0, directoryOffset + 16)
rejects(() => readReleaseZip(corruptBothCrc), 'Matching forged headers still fail decompressed CRC verification')
const corruptCount = Buffer.from(zip)
corruptCount.writeUInt16LE(0, corruptCount.length - 12)
rejects(() => readReleaseZip(corruptCount), 'Incorrect central directory entry count fails')
accepts(() => assertProductionManifest(manifest, files), 'Production manifest references resolve')
for (const modified of [
  { ...manifest, background: { service_worker: 'missing.js' } },
  { ...manifest, action: { default_popup: 'missing.html' } },
  { ...manifest, content_scripts: [{ css: ['missing.css'] }] },
  { ...manifest, externally_connectable: { matches: ['http://localhost:5173/*'] } },
  { ...manifest, externally_connectable: { matches: ['https://*.example.test/*'] } },
  { ...manifest, host_permissions: ['http://localhost:3001/*'] },
  { ...manifest, web_accessible_resources: [{ resources: ['assets/missing.js'] }] },
  { ...manifest, content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'" } },
]) rejects(() => assertProductionManifest(modified, files), 'Missing references/development configuration cannot pass production verification')
accepts(() => validateReleaseTag(tag, version), 'Exact version tag is valid')
for (const invalid of ['v1.3.1', '1.3.0', 'main', 'v1.3.0-beta', 'v01.3.0']) rejects(() => validateReleaseTag(invalid, version), 'Mismatched/unapproved version tag fails')

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'talvyn-release-test-'))
const previousRepository = process.env.GITHUB_REPOSITORY
delete process.env.GITHUB_REPOSITORY
try {
  fs.mkdirSync(path.join(temporaryRoot, 'extension/dist-package'), { recursive: true })
  fs.mkdirSync(path.join(temporaryRoot, 'extension/dist'), { recursive: true })
  fs.writeFileSync(path.join(temporaryRoot, 'package.json'), JSON.stringify({ repository: `https://github.com/${repository}.git` }))
  fs.writeFileSync(path.join(temporaryRoot, 'extension/package.json'), JSON.stringify({ version }))
  const output = path.join(temporaryRoot, 'extension/dist-package')
  fs.writeFileSync(path.join(output, ZIP_NAME), zip)
  fs.writeFileSync(path.join(output, CHECKSUM_NAME), `${digest}  ${ZIP_NAME}\n`)
  fs.writeFileSync(path.join(output, NOTES_NAME), files.get(NOTES_NAME)!)
  for (const [name, data] of build) {
    const destination = path.join(temporaryRoot, 'extension/dist', name)
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data)
  }
  equal(readBuildFiles(path.join(temporaryRoot, 'extension/dist')), new Map([...build].sort(([a], [b]) => a.localeCompare(b, 'en'))), 'Build scanner reads only intended complete release files')
  fs.writeFileSync(path.join(temporaryRoot, 'extension/dist', '.env'), 'not-a-secret-fixture')
  rejects(() => readBuildFiles(path.join(temporaryRoot, 'extension/dist')), 'Build scanner rejects an unexpected local environment file')
  fs.unlinkSync(path.join(temporaryRoot, 'extension/dist', '.env'))
  equal(repositoryForRelease(temporaryRoot), repository, 'Repository falls back to actual configured package URL outside a git checkout')
  equal(repositoryForRelease(temporaryRoot, repository), repository, 'CI uses GITHUB_REPOSITORY')
  rejects(() => repositoryForRelease(temporaryRoot, 'https://evil.test/owner/repo'), 'Repository URL cannot escape GitHub')
  const options = { root: temporaryRoot, tag, publicKey, repository }
  const candidate = prepareGitHubRelease(options)
  equal(candidate.sha256, digest, 'Candidate contains actual ZIP checksum')
  equal(candidate.extensionId, deriveExtensionIdentity(publicKey).extensionId, 'Candidate identity is derived from the actual packaged public key')
  equal(candidate.published, null, 'Local validation never invents successful publication')
  equal(fs.existsSync(path.join(output, 'extension-release.json')), false, 'Local validation does not write a publication receipt')
  rejects(() => prepareGitHubRelease({ ...options, publicKey: '' }), 'Missing owner public key blocks release before publication')
  rejects(() => prepareGitHubRelease({ ...options, tag: 'v1.3.1' }), 'Tag mismatch blocks publication')
  const receipt = {
    tag_name: tag, html_url: `https://github.com/${repository}/releases/tag/${tag}`,
    published_at: '2026-10-24T00:00:00Z', draft: false, prerelease: false,
    assets: [
      { name: ZIP_NAME, state: 'uploaded', size: zip.length, browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${ZIP_NAME}`, digest: `sha256:${digest}` },
      { name: CHECKSUM_NAME, state: 'uploaded', size: fs.statSync(path.join(output, CHECKSUM_NAME)).size, browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${CHECKSUM_NAME}` },
    ],
  }
  for (const invalid of [
    null, {}, { ...receipt, draft: true }, { ...receipt, prerelease: true }, { ...receipt, published_at: null },
    { ...receipt, published_at: 'invalid' }, { ...receipt, tag_name: 'v1.3.1' }, { ...receipt, html_url: 'https://evil.test/release' },
    { ...receipt, assets: [] }, { ...receipt, assets: [{ ...receipt.assets[0], size: 0 }, receipt.assets[1]] },
    { ...receipt, assets: [{ ...receipt.assets[0], digest: `sha256:${'0'.repeat(64)}` }, receipt.assets[1]] },
    { ...receipt, assets: [{ ...receipt.assets[0], browser_download_url: 'https://evil.test/extension.zip' }, receipt.assets[1]] },
    { ...receipt, assets: [receipt.assets[0]] },
  ]) rejects(() => prepareGitHubRelease({ ...options, releaseInfo: invalid }), 'Only matching, complete, actually published release receipts are accepted')
  const published = prepareGitHubRelease({ ...options, releaseInfo: receipt }).published!
  equal(published.publishedAt, receipt.published_at, 'Metadata uses the actual receipt timestamp without inventing a date')
  equal(published.sha256, digest, 'Published metadata refers to the actual ZIP bytes')
  equal(validatePublishedRelease(published, repository), published, 'Generated published JSON matches the shared browser/server contract')
  equal(JSON.parse(fs.readFileSync(path.join(output, 'extension-release.json'), 'utf8')), published, 'Published receipt is written only to the local packaging output')
  fs.writeFileSync(path.join(output, CHECKSUM_NAME), `${'0'.repeat(64)}  ${ZIP_NAME}\n`)
  rejects(() => prepareGitHubRelease(options), 'Modified checksum sidecar cannot pass preparation')
} finally {
  if (previousRepository === undefined) delete process.env.GITHUB_REPOSITORY
  else process.env.GITHUB_REPOSITORY = previousRepository
  // Remove only this test's newly created directory after checking its absolute parent and owned prefix.
  assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()))
  assert.ok(path.basename(temporaryRoot).startsWith('talvyn-release-test-'))
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}

const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/extension-release.yml'), 'utf8')
equal(workflow.includes('pull_request_target'), false, 'Untrusted pull requests do not use privileged pull_request_target')
equal((workflow.match(/contents: write/g) || []).length, 1, 'Repository writes are granted only to the publication job')
equal(workflow.includes("vars.TALVYN_RELEASES_ENABLED == 'true'") && workflow.includes('environment: extension-release'), true, 'Publication requires explicit enablement and the owner-configured protected environment')
equal(workflow.includes("startsWith(github.ref, 'refs/tags/v')") && workflow.includes('needs: validate'), true, 'Publication is tag-only and follows successful validation')
equal(workflow.includes('--verify-tag') && !workflow.includes('--clobber'), true, 'Publication cannot create a missing tag or silently replace existing release assets')
console.log(`PASS: ${checks} offline GitHub release tooling and archive checks. No release was published.`)
