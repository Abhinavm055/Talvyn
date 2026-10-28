/** Package only the complete, production extension build. Does not publish. */
import fs from 'node:fs'
import path from 'node:path'
import { EXTENSION_RELEASE_NOTES } from '../extension/src/releaseNotes'
import { assertBuildMatchesArchive, assertProductionManifest, CHECKSUM_NAME, createReleaseZip, NOTES_NAME, readBuildFiles, readReleaseZip, repositoryForRelease, sha256, ZIP_NAME } from './github-release-artifacts'

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'extension/dist')
const output = path.join(root, 'extension/dist-package')

function packageExtension(): void {
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) throw new Error('Build extension/dist with npm run build:extension before packaging.')
  const build = readBuildFiles(dist)
  const manifest = JSON.parse(build.get('manifest.json')!.toString('utf8'))
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'extension/package.json'), 'utf8')) as { version: string }
  if (manifest.version !== metadata.version) throw new Error('Built manifest and extension package versions must match.')
  assertProductionManifest(manifest, build)
  const repository = repositoryForRelease(root)
  const notes = [
    `# Talvyn extension v${manifest.version}`, '', EXTENSION_RELEASE_NOTES.title, '',
    ...EXTENSION_RELEASE_NOTES.changes.map((change) => `- ${change}`), '',
    `Compatibility: ${EXTENSION_RELEASE_NOTES.backendCompatibility}`, '',
    EXTENSION_RELEASE_NOTES.installInstructions, '',
    `Release page after owner-approved publication: https://github.com/${repository}/releases/tag/v${manifest.version}`, '',
    'This local archive does not establish that a GitHub release has been published.', '',
  ].join('\n')
  const contents = new Map(build)
  contents.set(NOTES_NAME, Buffer.from(notes, 'utf8'))
  const zip = createReleaseZip(contents)
  assertBuildMatchesArchive(build, readReleaseZip(zip))
  const digest = sha256(zip)
  fs.mkdirSync(output, { recursive: true })
  // A stale published receipt must never describe a newly rebuilt local artifact.
  const receipt = path.join(output, 'extension-release.json')
  if (fs.existsSync(receipt)) fs.unlinkSync(receipt)
  fs.writeFileSync(path.join(output, ZIP_NAME), zip)
  fs.writeFileSync(path.join(output, CHECKSUM_NAME), `${digest}  ${ZIP_NAME}\n`, 'utf8')
  fs.writeFileSync(path.join(output, NOTES_NAME), notes, 'utf8')
  console.log(`Packaged local extension v${manifest.version}: ${path.join(output, ZIP_NAME)} (${zip.length} bytes; ${contents.size} entries).`)
  console.log(`SHA-256: ${digest}`)
  console.log('ZIP integrity and complete build bytes verified. No release was published; real Chrome/Brave behavior remains a separate check.')
}

try { packageExtension() } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }
