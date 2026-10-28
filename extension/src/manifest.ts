import { defineManifest } from '@crxjs/vite-plugin'
import { loadEnv } from 'vite'
import path from 'node:path'
import { resolveManifestExtensionIdentity } from '../../server/services/extensionIdentity'

export const EXTENSION_VERSION = '1.3.0'
export default defineManifest(({ mode }) => {
  const env = { ...loadEnv(mode, path.resolve(__dirname, '../..'), ''), ...process.env }
  const identity = resolveManifestExtensionIdentity(mode, env)
  return {
  manifest_version: 3,
  minimum_chrome_version: '102',
  ...(identity ? { key: identity.publicKey } : {}),
  name: 'Talvyn Browser Extension',
  version: EXTENSION_VERSION,
  description: 'Capture job postings, compare them with your profile, and review application autofill in Talvyn.',

  // Service worker (background)
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // Toolbar Action click handler — communicates directly with active tab to trigger intelligence window
  action: {
    default_title: 'Talvyn Browser Extension',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16':  'icons/icon16.png',
      '32':  'icons/icon32.png',
      '48':  'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },

  // Icons
  icons: {
    '16':  'icons/icon16.png',
    '32':  'icons/icon32.png',
    '48':  'icons/icon48.png',
    '128': 'icons/icon128.png',
  },

  // Local origins belong only to an explicit development build.
  externally_connectable: {
    matches: mode === 'development'
      ? ['http://localhost:5173/*', 'http://127.0.0.1:5173/*']
      : ['https://talvyn.vercel.app/*'],
  },

  // Content scripts — injected into all pages, activates only when job detected
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],

  // Permissions
  permissions: [
    'storage',      // Store auth token and user prefs
    'activeTab',    // Read the current tab's URL and title
    'scripting',    // Programmatic script injection if needed
  ],

  // Host permissions — must match the Talvyn API and frontend URLs
  host_permissions: mode === 'development'
    ? ['http://localhost:3001/*']
    : ['https://talvyn-backend-7ucf.onrender.com/*'],
  // Requested only when the user enables their own local model.
  optional_host_permissions: ['http://localhost/*', 'http://127.0.0.1/*', 'https://localhost/*', 'https://127.0.0.1/*'],

  // Web accessible resources
  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['http://*/*', 'https://*/*'],
    },
  ],

  // Content security policy for MV3
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
  }
})

