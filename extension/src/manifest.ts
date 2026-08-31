import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Talvyn Browser Extension',
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
    default_title: 'Talvyn Browser Extension',
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

  // Allow production and local Talvyn web app to communicate with extension
  externally_connectable: {
    matches: [
      'https://talvyn.vercel.app/*',
      'http://localhost:5173/*',
      'http://localhost:3000/*',
      'http://127.0.0.1:5173/*',
      'http://localhost:3001/*',
    ],
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

  // Host permissions — must match the Talvyn API and frontend URLs
  host_permissions: [
    'http://localhost:3001/*',
    'https://talvyn-backend-7ucf.onrender.com/*',
    'https://talvyn.vercel.app/*',
  ],

  // Web accessible resources
  web_accessible_resources: [
    {
      resources: ['icons/*', 'assets/*'],
      matches: ['<all_urls>'],
    },
  ],

  // Content security policy for MV3
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
})

