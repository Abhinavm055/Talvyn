# Talvyn Extension Setup & GitHub Release Distribution Guide

The **Talvyn Browser Extension** (Manifest V3) delivers intelligent job discovery, opportunity extraction, relevance scoring against user profiles, and reviewed universal autofill across supported ATS platforms.

Talvyn distributes production extensions directly through verified **GitHub Releases** as unpacked ZIP archives, eliminating unverified static downloads and third-party store dependencies.

---

## 1. Extension Identity & Security Design

- **Deterministic Extension ID**: Chrome and Brave calculate an extension's 32-character ID (`[a-p]{32}`) deterministically from the RSA/SPKI public key embedded in `manifest.json` (`"key"` field).
- **Public-Key Only**: Only the public key (`TALVYN_EXTENSION_PUBLIC_KEY` in canonical base64 DER/SPKI format) is used in build/packaging. **Never supply or embed a private key**.
- **Closed Identity & Origins**:
  - The production manifest restricts `externally_connectable` strictly to `https://talvyn.vercel.app/*` (localhost origins are permitted only in development builds).
  - Content Security Policy enforces `script-src 'self'; object-src 'self'` with zero remote script execution or `eval()`.
  - Backend API access is strictly bound via CORS and origin checks (`chrome-extension://<id>`).
- **Proof-Bound Pairing**:
  - Account connection uses a 5-minute single-use pairing challenge (`requestId` and SHA-256 verifier).
  - The secret verifier is retained exclusively in extension background memory and redeemed directly with `/api/auth/extension/pair`.
  - Website JavaScript never receives, stores, or proxies extension credentials or refresh tokens.

---

## 2. First-Time Installation (Chrome & Brave)

Follow these steps to install Talvyn for the first time:

1. **Download Release Archive**:
   - Navigate to the Talvyn dashboard **Extensions** page (`/extensions`) or the GitHub repository releases page:
     ```
     https://github.com/Abhinavm055/Talvyn/releases/latest
     ```
   - Download `talvyn-extension.zip` and the sidecar checksum file `talvyn-extension.zip.sha256`.

2. **Verify SHA-256 Integrity**:
   - In Windows PowerShell, compute the file hash:
     ```powershell
     Get-FileHash -Algorithm SHA256 -LiteralPath '.\talvyn-extension.zip'
     ```
   - Compare the output hash with the published SHA-256 checksum displayed on the release page.

3. **Extract to a Permanent Folder**:
   - Extract `talvyn-extension.zip` into a dedicated permanent directory you will keep on your machine (e.g. `C:\Tools\TalvynExtension` or `~/Applications/talvyn-extension`).
   - Ensure `manifest.json` is located directly in the root of that folder (not nested in an extra subfolder).
   - *Important*: Do not delete or move this folder after installation; Chromium browsers load unpacked extensions directly from their file location.

4. **Load in Browser**:
   - Open Google Chrome and navigate to `chrome://extensions/` (or `brave://extensions/` in Brave) in the browser address bar.
   - Toggle **Developer mode** to ON in the top-right corner.
   - Click the **Load unpacked** button in the top-left.
   - Select the permanent folder containing `manifest.json`.
   - Talvyn will appear in your extensions list. Pin the extension icon to your browser toolbar.

5. **Connect Your Talvyn Account**:
   - Click the Talvyn toolbar icon to open the popup.
   - Click **Connect Account**. The Talvyn website opens the secure authorization prompt (`/extension/connect`).
   - Review the account details and click **Approve Connection**.
   - Return to the popup or `/extensions` page and click **Retry Detection** to confirm the live connection.

---

## 3. Subsequent Manual Updates

When a new version is released:

1. **Check Availability**:
   - An update notification banner will appear on your Talvyn dashboard and `/extensions` page showing your installed version vs. the latest published version.
2. **Download & Verify**:
   - Download the new `talvyn-extension.zip` from the release link.
   - Verify its SHA-256 hash using `Get-FileHash`.
3. **Backup Existing Folder**:
   - Make a copy or backup of your existing extension folder to a separate location.
4. **Replace Files**:
   - Close active job application tabs and the Talvyn extension popup.
   - Delete the old files inside your permanent extension folder.
   - Extract the new archive files directly into that same folder path. Keep the parent folder path unchanged.
5. **Reload in Browser**:
   - Go to `chrome://extensions/` (or `brave://extensions/`).
   - Click the **Reload** (circular arrow) button on the existing Talvyn extension card.
   - **Do NOT** click "Remove" and do not click "Load unpacked" again. Reloading preserves your browser extension ID, stored preferences, and active pairing session.
6. **Verify**:
   - Open the Talvyn popup to verify the updated version number. Refresh open job tabs to load the updated content scripts.

---

## 4. GitHub Actions Release Automation Setup

Extension validation and release publication are defined in `.github/workflows/extension-release.yml`.

### Required Configuration in GitHub Repository:

1. **Repository Variables** (`Settings` → `Secrets and variables` → `Actions` → `Variables` tab):
   - `TALVYN_RELEASES_ENABLED`: Set to `'true'` to permit release publication. If unset or `'false'`, tag builds will run validation and packaging tests without publishing.
   - `TALVYN_EXTENSION_PUBLIC_KEY`: The canonical base64-encoded DER/SPKI public key for the extension. This ensures the packaged `manifest.json` `"key"` field matches across releases and derives the approved extension ID.

2. **Protected Environment** (`Settings` → `Environments`):
   - Create an environment named `extension-release`.
   - Add **Required reviewers** (select project owner/leads).
   - This prevents tag pushes from publishing without explicit owner confirmation in the GitHub UI.

3. **Repository Permissions**:
   - The workflow uses least-privilege permissions: `contents: read` by default, and `contents: write` scoped strictly to the `publish` job.

### Triggering a Verified Release:

1. Ensure `extension/package.json`, `package.json`, and `extension/src/manifest.ts` specify the same version number (e.g. `1.3.0`).
2. Update release notes in `extension/src/releaseNotes.ts`.
3. Create and push a matching Git version tag:
   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```
4. The GitHub Actions workflow executes:
   - **Validate Job**: Runs database migrations on a clean CI PostgreSQL service, executes security and regression suites, compiles web and server builds, packages `talvyn-extension.zip`, computes the SHA-256 checksum sidecar, and verifies build completeness and checksum match.
   - **Publish Job**: Runs only on matching `v*` tags when `TALVYN_RELEASES_ENABLED == 'true'` and after owner approval in `extension-release` environment. It validates package receipts, creates the GitHub release, uploads `talvyn-extension.zip` and `.sha256`, generates and uploads verified `extension-release.json`, and downloads published bytes to confirm byte-for-byte fidelity.

---

## 5. Local Development Workflow

For contributors developing the extension locally:

1. **Install dependencies**:
   ```bash
   npm install
   npm run prisma:generate
   ```
2. **Start Backend & Web App**:
   ```bash
   npm run dev
   ```
3. **Build Extension in Development Mode**:
   ```bash
   npm run build:extension:dev
   ```
   Or run the live watch builder:
   ```bash
   npm run dev:extension
   ```
4. **Load Unpacked in Browser**:
   - Navigate to `chrome://extensions/` and choose **Load unpacked**.
   - Select `C:\Users\malay\Projects\Talvyn\extension\dist`.
   - Copy the generated 32-character extension ID and set it in your local `.env`:
     ```
     TALVYN_DEV_EXTENSION_IDS="<your-32-char-extension-id>"
     VITE_TALVYN_EXTENSION_ID="<your-32-char-extension-id>"
     ```
5. **Run Package Verification**:
   ```bash
   npm run package:extension
   npm run verify:extension-package
   ```
6. **Run Test Suites**:
   ```bash
   npm run test:security
   npm run test:regression
   ```
