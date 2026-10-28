/** Validate release readiness or build metadata from an actual published GitHub REST receipt. */
import fs from 'node:fs'
import path from 'node:path'
import { EXTENSION_RELEASE_NOTES } from '../extension/src/releaseNotes'
import { type PublishedExtensionRelease, validatePublishedRelease } from '../server/contracts/extensionRelease'
import { deriveExtensionIdentity } from '../server/services/extensionIdentity'
import { assertProductionManifest, CHECKSUM_NAME, NOTES_NAME, readReleaseZip, repositoryForRelease, sha256, validateReleaseTag, ZIP_NAME } from './github-release-artifacts'

export interface PreparedGitHubRelease {
  version: string
  repository: string
  extensionId: string
  sha256: string
  published: PublishedExtensionRelease | null
}

export function prepareGitHubRelease(options: {
  root: string; tag: string; publicKey: string; repository?: string; releaseInfo?: unknown;
}): PreparedGitHubRelease {
  // Identity validation precedes publication. The public key is stable configuration, never a private signing key.
  if (!options.publicKey?.trim()) throw new Error('An owner-configured TALVYN_EXTENSION_PUBLIC_KEY is required before publishing a shared unpacked extension.')
  const identity = deriveExtensionIdentity(options.publicKey)
  const repository = repositoryForRelease(options.root, options.repository)
  const output = path.join(options.root, 'extension/dist-package')
  const zip = fs.readFileSync(path.join(output, ZIP_NAME))
  const files = readReleaseZip(zip)
  const manifest = JSON.parse(files.get('manifest.json')?.toString('utf8') || 'null')
  assertProductionManifest(manifest, files)
  const metadata = JSON.parse(fs.readFileSync(path.join(options.root, 'extension/package.json'), 'utf8')) as { version: string }
  validateReleaseTag(options.tag, manifest.version)
  if (manifest.version !== metadata.version) throw new Error('Release tag, ZIP manifest and extension package must describe the same version.')
  if (manifest.key !== identity.publicKey) throw new Error('The packaged manifest key must match the owner-approved public extension identity. Rebuild with TALVYN_EXTENSION_PUBLIC_KEY.')
  const digest = sha256(zip)
  if (fs.readFileSync(path.join(output, CHECKSUM_NAME), 'utf8') !== `${digest}  ${ZIP_NAME}\n`) throw new Error('Release checksum does not match the ZIP.')
  if (!files.has(NOTES_NAME) || !files.get(NOTES_NAME)?.equals(fs.readFileSync(path.join(output, NOTES_NAME)))) throw new Error('ZIP and external release notes must match.')
  const result: PreparedGitHubRelease = { version: manifest.version, repository, extensionId: identity.extensionId, sha256: digest, published: null }
  if (options.releaseInfo === undefined) return result
  const info = options.releaseInfo as Record<string, unknown> | null
  const notesUrl = `https://github.com/${repository}/releases/tag/${options.tag}`
  const downloadUrl = `https://github.com/${repository}/releases/download/${options.tag}/${ZIP_NAME}`
  if (!info || typeof info !== 'object' || info.draft !== false || info.prerelease !== false || info.tag_name !== options.tag || info.html_url !== notesUrl || typeof info.published_at !== 'string' || !Array.isArray(info.assets)) throw new Error('Published metadata requires the actual non-draft, non-prerelease GitHub REST release receipt for this repository/tag.')
  const asset = info.assets.find((value) => value && typeof value === 'object' && value.name === ZIP_NAME) as Record<string, unknown> | undefined
  const checksum = info.assets.find((value) => value && typeof value === 'object' && value.name === CHECKSUM_NAME) as Record<string, unknown> | undefined
  if (!asset || asset.state !== 'uploaded' || asset.size !== zip.length || asset.browser_download_url !== downloadUrl || (asset.digest != null && asset.digest !== `sha256:${digest}`)) throw new Error('Published ZIP asset receipt must match the actual local version, URL, size and available SHA-256 digest.')
  if (!checksum || checksum.state !== 'uploaded' || checksum.browser_download_url !== `${downloadUrl}.sha256` || checksum.size !== fs.statSync(path.join(output, CHECKSUM_NAME)).size) throw new Error('The matching checksum must be uploaded before publication metadata is generated.')
  const published = validatePublishedRelease({
    schemaVersion: 1, distribution: 'github', repository, version: result.version,
    publishedAt: info.published_at, downloadUrl, sha256: digest, releaseNotesUrl: notesUrl,
    title: EXTENSION_RELEASE_NOTES.title, changes: [...EXTENSION_RELEASE_NOTES.changes], extensionId: identity.extensionId,
  }, repository)
  if (!published) throw new Error('The actual release receipt did not pass publication metadata validation.')
  fs.writeFileSync(path.join(output, 'extension-release.json'), `${JSON.stringify(published, null, 2)}\n`, 'utf8')
  result.published = published
  return result
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2)
    if (args.some((arg, index) => index % 2 === 0 && !['--tag', '--release-info'].includes(arg)) || args.length % 2) throw new Error('Usage: prepare-github-release.ts --tag v<version> [--release-info <actual-GitHub-REST-receipt.json>]')
    const tag = args[args.indexOf('--tag') + 1]
    if (!args.includes('--tag') || !tag) throw new Error('An exact approved --tag is required.')
    const infoIndex = args.indexOf('--release-info')
    const result = prepareGitHubRelease({
      root: path.resolve(__dirname, '..'), tag, publicKey: process.env.TALVYN_EXTENSION_PUBLIC_KEY || '',
      releaseInfo: infoIndex < 0 ? undefined : JSON.parse(fs.readFileSync(args[infoIndex + 1], 'utf8')),
    })
    console.log(result.published ? `Wrote publication metadata from the actual GitHub release receipt for ${tag}.` : `Validated local release candidate ${tag} (${result.repository}, extension ID ${result.extensionId}). No release or publication metadata was created.`)
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }
}
