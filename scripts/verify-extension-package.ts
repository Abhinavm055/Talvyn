/** Verify local release bytes, safety checks and metadata. Never publishes. */
import fs from 'node:fs'
import path from 'node:path'
import { EXTENSION_VERSION } from '../extension/src/manifest'
import { assertBuildMatchesArchive, assertProductionManifest, CHECKSUM_NAME, NOTES_NAME, readBuildFiles, readReleaseZip, repositoryForRelease, sha256, ZIP_NAME } from './github-release-artifacts'
import { validatePublishedRelease } from '../server/contracts/extensionRelease'

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'extension/dist-package')
let passed = 0
let failed = 0
function check(condition: unknown, name: string): void {
  if (condition) { passed++; console.log(`PASS: ${name}`) }
  else { failed++; console.error(`FAIL: ${name}`) }
}
function verify(): void {
  const zipPath = path.join(output, ZIP_NAME)
  check(fs.existsSync(zipPath), 'Local ZIP exists')
  if (!fs.existsSync(zipPath)) return
  const zip = fs.readFileSync(zipPath)
  check(zip.length > 5000, 'ZIP has the expected nonempty build size')
  check(zip.readUInt32LE(0) === 0x04034b50, 'ZIP starts with a PKZIP local header')
  check(!/^\s*</.test(zip.subarray(0, 100).toString('utf8')), 'ZIP is not an HTML fallback')
  let files: Map<string, Buffer>
  try { files = readReleaseZip(zip); check(true, 'Every archive entry passes central/local structure, length and CRC verification') }
  catch (error) { check(false, `Archive integrity: ${error instanceof Error ? error.message : 'invalid ZIP'}`); return }
  const names = [...files.keys()]
  check(files.has('manifest.json'), 'manifest.json is at the ZIP root')
  check(names.some((name) => name.startsWith('icons/')), 'Package has icons')
  check(names.some((name) => /icons\/.*\.png$/.test(name)), 'Package has PNG icons')
  check(files.has('src/popup/index.html'), 'Package has popup HTML')
  check(names.some((name) => /^assets\/.*\.js$/.test(name)), 'Package has compiled JavaScript assets')
  check(!names.some((name) => /(?:^|\/)\.env|\.(?:ts|tsx|map|pem|key)$|(?:^|\/)(?:node_modules|server|public|\.git)(?:\/|$)/.test(name)), 'No source, maps, secrets, website, backend or dependency directories')
  const secretPatterns = [/DATABASE_URL/, /JWT_(?:REFRESH_)?SECRET/, /GOOGLE_CLIENT_SECRET/, /XAI_API_KEY/, /\b(?:sk|xai)-[A-Za-z0-9_-]{20,}/, /Bearer\s+eyJ[A-Za-z0-9_-]{20,}/, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/]
  const executablePatterns = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bimportScripts\s*\(/, /import\s*\(\s*['"]https?:\/\//, /<script\b[^>]*src\s*=\s*['"]https?:\/\//i]
  const text = [...files].filter(([name]) => /\.(?:js|json|html)$/.test(name)).map(([, value]) => value.toString('utf8'))
  check(!text.some((value) => secretPatterns.some((pattern) => pattern.test(value))), 'Text bundles have no checked secret patterns')
  check(!text.some((value) => executablePatterns.some((pattern) => pattern.test(value))), 'Text bundles have no checked remote executable loaders or eval patterns')
  const build = readBuildFiles(path.join(root, 'extension/dist'))
  try { assertBuildMatchesArchive(build, files); check(true, 'Every production build file is byte-identical in the archive; only release notes are added') }
  catch (error) { check(false, String(error)) }
  const manifest = JSON.parse(files.get('manifest.json')!.toString('utf8'))
  check(manifest.manifest_version === 3, 'Manifest uses MV3')
  try { assertProductionManifest(manifest, files); check(true, 'All manifest references resolve; production hosts and package CSP are valid') }
  catch (error) { check(false, String(error)) }
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'extension/package.json'), 'utf8')) as { version: string }
  check(manifest.version === metadata.version, 'Archive and extension package versions agree')
  check(manifest.version === EXTENSION_VERSION, 'Archive and source manifest versions agree')
  check(files.get('manifest.json')?.equals(build.get('manifest.json')!), 'Archive and built manifests agree')
  const repository = repositoryForRelease(root)
  const notes = files.get(NOTES_NAME)?.toString('utf8') || ''
  check(notes.includes(`v${manifest.version}`), 'Archive contains versioned release notes')
  check(notes.includes(`https://github.com/${repository}/releases/tag/v${manifest.version}`), 'Release notes link to the configured repository and exact version tag')
  check(fs.existsSync(path.join(output, CHECKSUM_NAME)), 'SHA-256 checksum file exists')
  if (fs.existsSync(path.join(output, CHECKSUM_NAME))) check(fs.readFileSync(path.join(output, CHECKSUM_NAME), 'utf8') === `${sha256(zip)}  ${ZIP_NAME}\n`, 'SHA-256 exactly matches the packaged ZIP')
  const localPath = path.join(root, 'public/extension-release.json')
  check(fs.existsSync(localPath), 'Local website build metadata exists')
  if (fs.existsSync(localPath)) {
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'))
    check(local.extensionVersion === manifest.version, 'Website local build version matches the ZIP')
    check(local.publicationStatus === 'not-published' && local.publishedExtensionVersion === null, 'A local build does not claim publication')
    check(local.distribution === 'github' && local.repository === repository, 'Website metadata describes the actual GitHub distribution')
    check(Boolean(local.releaseDate && local.title && local.changes?.length && local.backendCompatibility), 'Local metadata has build notes and compatibility information')
    check(typeof local.installInstructions === 'string' && local.installInstructions.includes('chrome://extensions') && !local.installInstructions.includes('Chrome Web Store'), 'Local metadata describes manual unpacked installation without a store dependency')
  }
  const publishedPath = path.join(output, 'extension-release.json')
  if (fs.existsSync(publishedPath)) {
    const published = validatePublishedRelease(JSON.parse(fs.readFileSync(publishedPath, 'utf8')), repository)
    check(Boolean(published && published.version === manifest.version && published.sha256 === sha256(zip)), 'Optional published receipt matches the exact version and ZIP checksum')
  }
  console.log(`Verified ${files.size} ZIP entries; SHA-256 ${sha256(zip)}`)
}
try { verify() } catch (error) { check(false, error instanceof Error ? error.message : 'Unexpected package verification failure') }
console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
if (failed) process.exitCode = 1
else console.log('Package checks passed. This does not prove publication or real Chrome/Brave installation and update behavior.')
