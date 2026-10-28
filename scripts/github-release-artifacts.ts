/** Local release tooling. No network requests or publication side effects. */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { isExtensionVersion, normalizeRepository } from '../server/contracts/extensionRelease'

export const ZIP_NAME = 'talvyn-extension.zip'
export const CHECKSUM_NAME = `${ZIP_NAME}.sha256`
export const NOTES_NAME = 'RELEASE-NOTES.md'

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function sha256(data: Uint8Array): string { return createHash('sha256').update(data).digest('hex') }

export function repositoryForRelease(root: string, configured = process.env.GITHUB_REPOSITORY): string {
  if (configured?.trim()) {
    const repository = normalizeRepository(configured.trim())
    if (!repository) throw new Error('GITHUB_REPOSITORY must identify an actual GitHub owner/repository.')
    return repository
  }
  let remote = ''
  try { remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* package metadata is a local checkout fallback */ }
  if (remote) {
    const repository = normalizeRepository(remote)
    if (!repository) throw new Error('The origin remote must be a supported GitHub repository URL.')
    return repository
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { repository?: string | { url?: string } }
  const repository = normalizeRepository(typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url || '')
  if (!repository) throw new Error('No GitHub repository is configured in origin, GITHUB_REPOSITORY, or package.json.')
  return repository
}

export function validateReleaseTag(tag: string, version: string): void {
  if (!isExtensionVersion(version) || tag !== `v${version}`) throw new Error('The approved tag must exactly match the extension manifest version (v<version>).')
}

export function allowedReleasePath(name: string): boolean {
  if (name.includes('\\') || name.startsWith('/') || name.toLowerCase().includes('.env') || name.split('/').some((part) => !part || part.startsWith('.'))) return false
  return name === 'manifest.json' || name === 'service-worker-loader.js' || name === 'src/popup/index.html' || name === NOTES_NAME
    || /^assets\/[A-Za-z0-9_.-]+\.(?:js|css|png|svg|jpe?g|webp|woff2?)$/.test(name)
    || /^icons\/[A-Za-z0-9_.-]+\.(?:png|svg)$/.test(name)
}

export function readBuildFiles(directory: string): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()
  const walk = (current: string) => {
    for (const file of fs.readdirSync(current).sort()) {
      const full = path.join(current, file)
      const stat = fs.lstatSync(full)
      if (stat.isSymbolicLink()) throw new Error('Release builds must not contain symbolic links.')
      if (stat.isDirectory()) walk(full)
      else {
        const name = path.relative(directory, full).replace(/\\/g, '/')
        if (!stat.isFile() || !allowedReleasePath(name) || name === NOTES_NAME) throw new Error(`Unexpected release build file: ${name}`)
        entries.set(name, fs.readFileSync(full))
      }
    }
  }
  walk(directory)
  return entries
}

/** Standard ZIP with fixed timestamps and sorted names: identical bytes for identical inputs. */
export function createReleaseZip(files: ReadonlyMap<string, Buffer>): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const lowerNames = new Set<string>()
  if (!files.size || files.size > 65535) throw new Error('Invalid ZIP entry count.')
  for (const [name, data] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!allowedReleasePath(name) || lowerNames.has(name.toLowerCase())) throw new Error(`Unsafe or duplicate ZIP path: ${name}`)
    lowerNames.add(name.toLowerCase())
    const filename = Buffer.from(name, 'utf8')
    const compressed = zlib.deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(33, 12) // 1980-01-01; no build-machine timezone or clock dependence.
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(filename.length, 26)
    locals.push(local, filename, compressed)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50, 0)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x800, 8)
    record.writeUInt16LE(8, 10)
    record.writeUInt16LE(33, 14)
    record.writeUInt32LE(crc, 16)
    record.writeUInt32LE(compressed.length, 20)
    record.writeUInt32LE(data.length, 24)
    record.writeUInt16LE(filename.length, 28)
    record.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38)
    record.writeUInt32LE(offset, 42)
    central.push(record, filename)
    offset += local.length + filename.length + compressed.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.size, 8)
  end.writeUInt16LE(files.size, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

/** Validate central/local agreement, every decompressed length/CRC, paths and all offsets. */
export function readReleaseZip(zip: Buffer): Map<string, Buffer> {
  const fail = (message: string): never => { throw new Error(`Invalid extension ZIP: ${message}`) }
  if (zip.length < 22) return fail('truncated archive')
  const end = zip.length - 22
  if (zip.readUInt32LE(end) !== 0x06054b50 || zip.readUInt16LE(end + 20) !== 0) return fail('missing end record or unexpected trailer')
  if (zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0) return fail('multi-disk archive')
  const count = zip.readUInt16LE(end + 10)
  const centralSize = zip.readUInt32LE(end + 12)
  const centralStart = zip.readUInt32LE(end + 16)
  if (!count || zip.readUInt16LE(end + 8) !== count || centralStart + centralSize !== end) return fail('invalid directory bounds')
  const files = new Map<string, Buffer>()
  const lowerNames = new Set<string>()
  let cursor = centralStart
  let expectedLocalOffset = 0
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) return fail('truncated directory')
    const flags = zip.readUInt16LE(cursor + 8)
    const method = zip.readUInt16LE(cursor + 10)
    const crc = zip.readUInt32LE(cursor + 16)
    const compressedSize = zip.readUInt32LE(cursor + 20)
    const size = zip.readUInt32LE(cursor + 24)
    const nameLength = zip.readUInt16LE(cursor + 28)
    const extraLength = zip.readUInt16LE(cursor + 30)
    const commentLength = zip.readUInt16LE(cursor + 32)
    const localOffset = zip.readUInt32LE(cursor + 42)
    const next = cursor + 46 + nameLength + extraLength + commentLength
    if (next > end || flags !== 0x800 || method !== 8 || extraLength || commentLength || zip.readUInt16LE(cursor + 34)) return fail('unsupported directory entry')
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    if (!allowedReleasePath(name) || lowerNames.has(name.toLowerCase())) return fail('unsafe or duplicate path')
    if (size > 20 * 1024 * 1024 || localOffset !== expectedLocalOffset || localOffset + 30 > centralStart) return fail('invalid local bounds')
    if (zip.readUInt32LE(localOffset) !== 0x04034b50 || zip.readUInt16LE(localOffset + 6) !== flags || zip.readUInt16LE(localOffset + 8) !== method
      || zip.readUInt32LE(localOffset + 14) !== crc || zip.readUInt32LE(localOffset + 18) !== compressedSize || zip.readUInt32LE(localOffset + 22) !== size
      || zip.readUInt16LE(localOffset + 26) !== nameLength || zip.readUInt16LE(localOffset + 28) !== 0) return fail('local/directory header mismatch')
    const start = localOffset + 30 + nameLength
    const stop = start + compressedSize
    if (stop > centralStart || zip.toString('utf8', localOffset + 30, start) !== name) return fail('local filename or data bounds mismatch')
    const data = zlib.inflateRawSync(zip.subarray(start, stop), { maxOutputLength: Math.max(size, 1) })
    if (data.length !== size || crc32(data) !== crc) return fail('decompressed length or CRC mismatch')
    files.set(name, data)
    lowerNames.add(name.toLowerCase())
    expectedLocalOffset = stop
    cursor = next
  }
  if (cursor !== end || expectedLocalOffset !== centralStart) return fail('unexpected bytes outside entries')
  return files
}

export function assertBuildMatchesArchive(build: ReadonlyMap<string, Buffer>, archive: ReadonlyMap<string, Buffer>): void {
  if (archive.size !== build.size + 1 || !archive.has(NOTES_NAME)) throw new Error('ZIP must contain the complete build and only generated release notes.')
  for (const [name, data] of build) if (!archive.get(name)?.equals(data)) throw new Error(`ZIP does not match the complete current build: ${name}`)
}

export function assertProductionManifest(manifest: Record<string, any>, files: ReadonlyMap<string, Buffer>): void {
  if (manifest.manifest_version !== 3 || !isExtensionVersion(manifest.version)) throw new Error('A valid MV3 versioned manifest is required.')
  const references = [manifest.background?.service_worker, manifest.action?.default_popup, ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((script: { js?: string[]; css?: string[] }) => [...script.js || [], ...script.css || []])].filter(Boolean)
  if (!references.length || !references.every((name) => typeof name === 'string' && files.has(name))) throw new Error('Every manifest runtime script, popup, stylesheet and icon must exist in the ZIP.')
  for (const group of manifest.web_accessible_resources || []) for (const resource of group.resources || []) {
    if (typeof resource !== 'string' || (resource.endsWith('/*') ? ![...files.keys()].some((name) => name.startsWith(resource.slice(0, -1))) : !files.has(resource))) throw new Error('Web accessible resources must resolve inside the ZIP.')
  }
  const origins = manifest.externally_connectable?.matches
  if (!Array.isArray(origins) || !origins.length || origins.some((origin: unknown) => typeof origin !== 'string' || !/^https:\/\/[^/*]+\/\*$/.test(origin) || /localhost|127\.0\.0\.1/.test(origin))) throw new Error('Production external messaging requires exact HTTPS website hosts.')
  if (!Array.isArray(manifest.host_permissions) || manifest.host_permissions.some((origin: unknown) => typeof origin !== 'string' || !origin.startsWith('https://') || /localhost|127\.0\.0\.1/.test(origin))) throw new Error('Production required API access must exclude development hosts.')
  if (manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'") throw new Error('The extension must restrict executable code to its package.')
}
