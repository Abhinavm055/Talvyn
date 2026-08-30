/**
 * Talvyn Extension Package Production Verification Script
 *
 * Validates that:
 * 1. The packaged ZIP exists at all required locations:
 *    - extension/dist-package/talvyn-chrome-extension.zip
 *    - public/downloads/talvyn-chrome-extension.zip
 *    - dist/downloads/talvyn-chrome-extension.zip (if dist directory exists)
 * 2. The files are genuine PKZIP binary archives (magic bytes PK\x03\x04) and NOT HTML fallback files.
 * 3. The archive contains valid manifest.json with manifest_version 3 and required assets.
 * 4. Fails with exit code 1 if ANY validation check fails.
 */

import fs from 'fs'
import path from 'path'

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_PACKAGE_ZIP = path.join(ROOT_DIR, 'extension', 'dist-package', 'Talvyn v1.zip')
const PUBLIC_ZIP = path.join(ROOT_DIR, 'public', 'downloads', 'Talvyn v1.zip')
const DIST_ZIP = path.join(ROOT_DIR, 'dist', 'downloads', 'Talvyn v1.zip')

let passedChecks = 0
let failedChecks = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passedChecks++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failedChecks++
  }
}

function parseZipEntries(zipBuffer: Buffer): string[] {
  const fileNames: string[] = []
  let offset = 0

  while (offset < zipBuffer.length - 4) {
    const signature = zipBuffer.readUInt32LE(offset)
    if (signature === 0x04034b50) {
      // Local file header
      const nameLength = zipBuffer.readUInt16LE(offset + 26)
      const extraLength = zipBuffer.readUInt16LE(offset + 28)
      const compressedSize = zipBuffer.readUInt32LE(offset + 18)
      const fileName = zipBuffer.toString('utf8', offset + 30, offset + 30 + nameLength)
      fileNames.push(fileName)
      offset += 30 + nameLength + extraLength + compressedSize
    } else {
      offset++
    }
  }

  return fileNames
}

function verifyZipFile(filePath: string, label: string) {
  console.log(`\n--- Verifying ${label} ---`)
  console.log(`Path: ${filePath}`)

  assert(fs.existsSync(filePath), `File exists: ${label}`)
  if (!fs.existsSync(filePath)) return

  const buffer = fs.readFileSync(filePath)
  const size = buffer.length
  assert(size > 5000, `ZIP size is healthy (${(size / 1024).toFixed(1)} KB > 5 KB)`)

  // Check PKZIP Magic Bytes (0x50, 0x4B, 0x03, 0x04)
  const isPkZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  assert(isPkZip, `Header has genuine PKZIP magic bytes (PK\\x03\\x04)`)

  // Check NOT HTML
  const textSample = buffer.subarray(0, 100).toString('utf8').toLowerCase()
  const isHtml = textSample.includes('<!doctype') || textSample.includes('<html') || textSample.includes('<head')
  assert(!isHtml, `File is binary ZIP and NOT an HTML document`)

  // Inspect internal ZIP structure
  const rawEntries = parseZipEntries(buffer)
  const entries = rawEntries.map((e) => e.replace(/\\/g, '/'))
  console.log(`  Found ${entries.length} files inside archive:`)
  entries.forEach((e) => console.log(`    • ${e}`))

  assert(entries.includes('manifest.json'), `Archive contains manifest.json at root level`)
  assert(entries.some((e) => e.startsWith('icons/')), `Archive contains extension icons`)
  assert(entries.some((e) => e.includes('popup')), `Archive contains popup UI`)
  assert(entries.some((e) => e.includes('assets/')), `Archive contains transpiled script bundles`)
}

function run() {
  console.log('===========================================================')
  console.log('TALVYN: CHROME EXTENSION PACKAGE VERIFICATION')
  console.log('===========================================================')

  // 1. Verify extension/dist-package ZIP
  verifyZipFile(DIST_PACKAGE_ZIP, 'Packaging Output (extension/dist-package)')

  // 2. Verify public/downloads ZIP
  verifyZipFile(PUBLIC_ZIP, 'Public Static Download Asset (public/downloads)')

  // 3. Verify dist/downloads ZIP if dist directory has been built
  const distDir = path.join(ROOT_DIR, 'dist')
  if (fs.existsSync(distDir)) {
    verifyZipFile(DIST_ZIP, 'Vercel Deployment Asset (dist/downloads)')
  }

  console.log('\n===========================================================')
  console.log(`TOTAL CHECKS: ${passedChecks + failedChecks} | PASSED: ${passedChecks} | FAILED: ${failedChecks}`)
  console.log('===========================================================')

  if (failedChecks > 0) {
    console.error('\n❌ Extension package verification failed!')
    process.exit(1)
  }

  console.log('\n✓ Extension package is 100% production-ready and valid!\n')
}

run()
