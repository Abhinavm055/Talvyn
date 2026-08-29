# Talvyn Chrome Extension Setup & Distribution Guide

The **Talvyn Chrome Extension** brings automated opportunity discovery, job relevance scoring, universal application autofill, and automatic application submission tracking directly to your web browser.

---

## 1. Prerequisites

- **Google Chrome** (or any Chromium-based browser: Brave, Edge, Arc)
- Node.js (v18+) & npm
- Talvyn Web App & Backend API running locally:
  ```bash
  # Start Backend API (runs on http://localhost:3001)
  npm run dev:server

  # Start Web App (runs on http://localhost:5173)
  npm run dev:web
  ```

---

## 2. Building the Extension

To build the extension from source:

```bash
npm run build:extension
```

This compiles TypeScript, bundles content scripts and the extension popup using Vite + `@crxjs/vite-plugin`, and outputs production-ready files to:
```
c:\Users\malay\Projects\Talvyn\extension\dist
```

---

## 3. Installing in Chrome (Developer Mode)

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle in the top right corner.
3. Click the **Load unpacked** button in the top left.
4. Browse to and select the built extension folder:
   ```
   c:\Users\malay\Projects\Talvyn\extension\dist
   ```
5. Pin the **Talvyn** extension icon to your Chrome toolbar for quick access.

---

## 4. Connecting Your Talvyn Account

1. Click the **Talvyn** extension icon in your Chrome toolbar.
2. Sign in with either:
   - **Email & Password** (using your registered Talvyn credentials)
   - **Continue with Google**
3. Once authenticated:
   - The popup displays `✓ Connected` with your email and display name.
   - Your preferences, skills, and target roles are synced automatically from the backend.
   - You do **not** need to manually create or enter an API key.

---

## 5. Testing Synchronization & Features

### A. Automatic Job Discovery & Saving
1. Open any job post (e.g. on LinkedIn, Indeed, Greenhouse, Ashby, or Lever).
2. The floating Talvyn Job Card will appear with an instant **Relevance Score** calculated against your target roles and skills.
3. Click **Save Job**.
4. Navigate to your Talvyn Web App dashboard at `http://localhost:5173/jobs` or `http://localhost:5173/tracker` — the job appears instantly in your saved list.

### B. Universal Application Autofill & Progress Assistant
1. Open any job application form (e.g. `ashbyhq.com`, `greenhouse.io`, or `lever.co`).
2. The **Talvyn Application Assistant** panel floats on the page displaying your live completion percentage (e.g. `12 / 18 fields complete`) and recommended resume version.
3. Click **Autofill Remaining Fields** — standard personal, professional, and educational fields fill in one click without overwriting any custom text you already entered.
4. Sensitive or legal questions are highlighted with **User Action Required** badges for your manual review.

### C. Automatic Submission Tracking
1. Complete and manually submit the application.
2. Talvyn detects the success confirmation page and automatically updates the job status from **In Progress** to **Applied** with an `[Application Submitted]` timeline event.

---

## 6. Packaging for Distribution (Chrome Web Store / Zip)

To generate a clean production ZIP package:

```bash
npm run package:extension
```

- **Output Artifact**: `extension/dist-package/talvyn-chrome-extension.zip`
- **Security Guarantee**: Contains strictly compiled manifest, icons, and client scripts. Excludes all node_modules, source TypeScript files, and backend `.env` secrets.
