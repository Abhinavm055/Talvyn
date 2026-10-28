import fs from 'node:fs'
import path from 'node:path'
import { EXTENSION_VERSION } from '../extension/src/manifest'
import { EXTENSION_RELEASE_NOTES } from '../extension/src/releaseNotes'
import { normalizeRepository, isExtensionVersion } from '../server/contracts/extensionRelease'

const root = path.resolve(__dirname, '..')
const extensionPackage = JSON.parse(fs.readFileSync(path.join(root, 'extension/package.json'), 'utf8')) as { version: string }
const websitePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string; repository?: string | { url?: string } }
if (EXTENSION_VERSION !== extensionPackage.version) throw new Error('Source manifest and extension package versions must agree.')
if (!isExtensionVersion(EXTENSION_VERSION)) throw new Error('Invalid extension version.')
const repository = normalizeRepository(process.env.GITHUB_REPOSITORY || process.env.TALVYN_GITHUB_REPOSITORY || (typeof websitePackage.repository === 'string' ? websitePackage.repository : websitePackage.repository?.url))
if (!repository) throw new Error('Configure the actual GitHub repository before generating local build metadata.')

export const releaseMetadata = {
  extensionVersion: EXTENSION_VERSION,
  websiteVersion: websitePackage.version,
  distribution: 'github',
  repository,
  publishedExtensionVersion: null,
  publicationStatus: 'not-published',
  ...EXTENSION_RELEASE_NOTES,
}
const target = path.join(root, 'public/extension-release.json')
fs.writeFileSync(target, `${JSON.stringify(releaseMetadata, null, 2)}\n`, 'utf8')
console.log(`Release metadata generated for local extension build v${EXTENSION_VERSION}; publication status: ${releaseMetadata.publicationStatus}.`)
