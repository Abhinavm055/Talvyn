/**
 * Talvyn Chrome Extension Production Packaging Script
 *
 * Creates a standard, cross-platform ZIP archive from `extension/dist` containing
 * manifest.json, compiled background service worker, popup, icons, and content scripts.
 *
 * Places the archive in:
 * 1. extension/dist-package/talvyn-chrome-extension.zip (Local packaging directory)
 * 2. public/downloads/talvyn-chrome-extension.zip (Static asset directory for Vite/Vercel)
 *
 * Uses a pure Node.js PKZIP implementation with zero external CLI dependencies,
 * guaranteeing identical behavior on Windows, macOS, Linux, Vercel, and CI/CD.
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'extension', 'dist')
const OUT_DIR = path.join(ROOT_DIR, 'extension', 'dist-package')
const OUT_ZIP = path.join(OUT_DIR, 'talvyn-chrome-extension.zip')
const PUBLIC_DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads')
const PUBLIC_ZIP = path.join(PUBLIC_DOWNLOADS_DIR, 'talvyn-chrome-extension.zip')

interface ZipEntry {
  relativePath: string
  uncompressedData: Buffer
  compressedData: Buffer
  crc32: number
  uncompressedSize: number
  compressedSize: number
  offset: number
  modTime: number
  modDate: number
}

function getDosDateTime(date: Date): { modTime: number; modDate: number } {
  const modTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2) & 0x1f))
  const modDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f)
  return { modTime, modDate }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles)
    } else {
      arrayOfFiles.push(fullPath)
    }
  }
  return arrayOfFiles
}

function createZipArchive(sourceDir: string, outputFile: string): void {
  const allFiles = getAllFiles(sourceDir)
  const entries: ZipEntry[] = []
  const buffers: Buffer[] = []
  let currentOffset = 0

  const now = new Date()
  const { modTime, modDate } = getDosDateTime(now)

  // 1. Process each file into Local File Header + Compressed Data
  for (const filePath of allFiles) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, '/')
    const uncompressedData = fs.readFileSync(filePath)
    const uncompressedSize = uncompressedData.length
    const crc = zlib.crc32(uncompressedData)
    const compressedData = zlib.deflateRawSync(uncompressedData, { level: 9 })
    const compressedSize = compressedData.length

    const nameBuffer = Buffer.from(relativePath, 'utf8')
    const localHeader = Buffer.alloc(30)

    // Local file header signature (0x04034b50)
    localHeader.writeUInt32LE(0x04034b50, 0)
    // Version needed to extract (2.0)
    localHeader.writeUInt16LE(20, 4)
    // General purpose bit flag (UTF-8 filename flag: bit 11 = 0x0800)
    localHeader.writeUInt16LE(0x0800, 6)
    // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(8, 8)
    // File mod time & date
    localHeader.writeUInt16LE(modTime, 10)
    localHeader.writeUInt16LE(modDate, 12)
    // CRC-32
    localHeader.writeUInt32LE(crc, 14)
    // Compressed size
    localHeader.writeUInt32LE(compressedSize, 18)
    // Uncompressed size
    localHeader.writeUInt32LE(uncompressedSize, 22)
    // Filename length
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    // Extra field length
    localHeader.writeUInt16LE(0, 28)

    entries.push({
      relativePath,
      uncompressedData,
      compressedData,
      crc32: crc,
      uncompressedSize,
      compressedSize,
      offset: currentOffset,
      modTime,
      modDate,
    })

    buffers.push(localHeader)
    buffers.push(nameBuffer)
    buffers.push(compressedData)

    currentOffset += localHeader.length + nameBuffer.length + compressedData.length
  }

  // 2. Central Directory
  const centralDirStartOffset = currentOffset
  let centralDirSize = 0

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.relativePath, 'utf8')
    const centralHeader = Buffer.alloc(46)

    // Central directory header signature (0x02014b50)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    // Version made by (UNIX 3.0 / DOS)
    centralHeader.writeUInt16LE(20, 4)
    // Version needed to extract (2.0)
    centralHeader.writeUInt16LE(20, 6)
    // General purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(0x0800, 8)
    // Compression method (8 = Deflate)
    centralHeader.writeUInt16LE(8, 10)
    // File mod time & date
    centralHeader.writeUInt16LE(entry.modTime, 12)
    centralHeader.writeUInt16LE(entry.modDate, 14)
    // CRC-32
    centralHeader.writeUInt32LE(entry.crc32, 16)
    // Compressed size
    centralHeader.writeUInt32LE(entry.compressedSize, 20)
    // Uncompressed size
    centralHeader.writeUInt32LE(entry.uncompressedSize, 24)
    // Filename length
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    // Extra field length
    centralHeader.writeUInt16LE(0, 30)
    // File comment length
    centralHeader.writeUInt16LE(0, 32)
    // Disk number start
    centralHeader.writeUInt16LE(0, 34)
    // External file attributes (regular file rw-r--r--: 0100644 in upper 16 bits)
    centralHeader.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38)
    // Relative offset of local header
    centralHeader.writeUInt32LE(entry.offset, 42)

    buffers.push(centralHeader)
    buffers.push(nameBuffer)

    centralDirSize += centralHeader.length + nameBuffer.length
  }

  // 3. End of Central Directory Record
  const eocd = Buffer.alloc(22)
  // End of central directory signature (0x06054b50)
  eocd.writeUInt32LE(0x06054b50, 0)
  // Disk number
  eocd.writeUInt16LE(0, 4)
  // Disk with central directory
  eocd.writeUInt16LE(0, 6)
  // Total entries on this disk
  eocd.writeUInt16LE(entries.length, 8)
  // Total entries in central directory
  eocd.writeUInt16LE(entries.length, 10)
  // Size of central directory
  eocd.writeUInt32LE(centralDirSize, 12)
  // Offset of central directory with respect to starting disk number
  eocd.writeUInt32LE(centralDirStartOffset, 16)
  // Comment length
  eocd.writeUInt16LE(0, 20)

  buffers.push(eocd)

  // Write final ZIP buffer to disk
  const finalZipBuffer = Buffer.concat(buffers)
  fs.writeFileSync(outputFile, finalZipBuffer)
}

function packageExtension() {
  console.log('===========================================================')
  console.log('TALVYN: PACKAGING CHROME EXTENSION FOR PRODUCTION')
  console.log('===========================================================\n')

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Error: Extension dist directory not found at: ${DIST_DIR}`)
    console.error('Please run "npm run build:extension" first.')
    process.exit(1)
  }

  const manifestPath = path.join(DIST_DIR, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: manifest.json not found in ${DIST_DIR}`)
    process.exit(1)
  }

  // Ensure output directories exist
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }
  if (!fs.existsSync(PUBLIC_DOWNLOADS_DIR)) {
    fs.mkdirSync(PUBLIC_DOWNLOADS_DIR, { recursive: true })
  }

  console.log(`Packaging from: ${DIST_DIR}`)
  console.log(`Target archive: ${OUT_ZIP}`)

  try {
    createZipArchive(DIST_DIR, OUT_ZIP)

    if (fs.existsSync(OUT_ZIP)) {
      // Copy to public/downloads for static hosting on Vercel
      fs.copyFileSync(OUT_ZIP, PUBLIC_ZIP)

      const stats = fs.statSync(OUT_ZIP)
      console.log(`\n✓ Successfully created production ZIP: talvyn-chrome-extension.zip`)
      console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`)
      console.log(`  Artifact 1: ${OUT_ZIP}`)
      console.log(`  Artifact 2: ${PUBLIC_ZIP}\n`)
    } else {
      throw new Error('Package file was not created.')
    }
  } catch (err) {
    console.error('Packaging failed:', err)
    process.exit(1)
  }
}

packageExtension()
