import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Talvyn – Job Saver',
  version: '1.0.0',
  description: 'Save jobs from any website directly to your Talvyn dashboard.',

  // Service worker (background)
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // Popup
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Talvyn',
    default_icon: {
      '16':  'icons/icon16.svg',
      '32':  'icons/icon32.svg',
      '48':  'icons/icon48.svg',
      '128': 'icons/icon128.svg',
    },
  },

  // Icons
  icons: {
    '16':  'icons/icon16.svg',
    '32':  'icons/icon32.svg',
    '48':  'icons/icon48.svg',
    '128': 'icons/icon128.svg',
  },

  // Content scripts — injected into all pages, activates only when job detected
  content_scripts: [
    {
      matches: ['<all_urls>'],
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

  // Host permissions — must match the Talvyn API URL
  host_permissions: [
    'http://localhost:3001/*',
    'https://api.talvyn.com/*',   // production placeholder
  ],

  // Content security policy for MV3
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
})
