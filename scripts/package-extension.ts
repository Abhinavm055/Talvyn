/**
 * Talvyn Chrome Extension Packaging Script
 *
 * Bundles the built production files from `extension/dist` into a clean ZIP archive
 * ready for manual distribution or Chrome Web Store upload.
 *
 * Ensures NO source files, NO node_modules, and NO environment secrets are included.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'extension', 'dist')
const OUT_DIR = path.join(ROOT_DIR, 'extension', 'dist-package')
const OUT_ZIP = path.join(OUT_DIR, 'talvyn-chrome-extension.zip')

function packageExtension() {
  console.log('===========================================================')
  console.log('TALVYN: PACKAGING CHROME EXTENSION FOR DISTRIBUTION')
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

  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  // Remove previous package if exists
  if (fs.existsSync(OUT_ZIP)) {
    fs.unlinkSync(OUT_ZIP)
  }

  console.log(`Packaging from: ${DIST_DIR}`)
  console.log(`Target archive: ${OUT_ZIP}`)

  try {
    if (process.platform === 'win32') {
      // Use PowerShell Compress-Archive on Windows
      const cmd = `powershell -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${OUT_ZIP}' -Force"`
      execSync(cmd, { stdio: 'inherit' })
    } else {
      // Use zip utility on Unix
      const cmd = `cd "${DIST_DIR}" && zip -r "${OUT_ZIP}" ./*`
      execSync(cmd, { stdio: 'inherit' })
    }

    if (fs.existsSync(OUT_ZIP)) {
      const stats = fs.statSync(OUT_ZIP)
      console.log(`\n✓ Successfully created package: talvyn-chrome-extension.zip`)
      console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`)
      console.log(`  Location: ${OUT_ZIP}\n`)
    } else {
      throw new Error('Package file was not created.')
    }
  } catch (err) {
    console.error('Packaging failed:', err)
    process.exit(1)
  }
}

packageExtension()
