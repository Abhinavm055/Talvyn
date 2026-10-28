/**
 * Release copy for the extension package built from this repository.
 * The version is taken from the built manifest when packaging.
 */
export const EXTENSION_RELEASE_NOTES = {
  releaseDate: '2026-10-24',
  title: 'GitHub downloads, verified release metadata, and safe manual updates',
  changes: [
    'Fill only reviewed profile values; leave signatures, declarations and unknown answers for manual entry.',
    'Recheck connected account, form changes and native control identity before filling; show filled, skipped and failed results.',
    'Preserve edits and cleared answers, including answers present before the preview; leave native Apply/Register activation to the user.',
    'Exclude explicit nonrequirements from additional skill guidance and reuse compiled canonical skill matchers.',
    'Download published production ZIPs and checksums from GitHub Releases; show an honest no-release state until publication.',
    'Approve extension connections without exposing session credentials to website scripts.',
    'Keep independent extension sessions with rotating refresh, revocation, and account-switch controls.',
    'Preserve extracted job evidence and deterministic matching; leave unknown application answers empty.',
    'Offer explicitly enabled local Ollama suggestions with deterministic fallback.',
    'Compare the browser-reported installed version with validated published GitHub metadata; update unpacked builds manually in the same folder.',
  ],
  backendCompatibility: 'Requires the existing extension-session and pairing migrations, approval API, owner-configured stable public extension key, trusted production origins and same-origin website API proxy. The website release reader requires the compatible /api/releases/extension endpoint. Deploy private-resume access control before release. No new migration is required for GitHub distribution.',
  installInstructions: 'Install from the actual published GitHub Release ZIP: verify its SHA-256, extract into a permanent folder, open chrome://extensions or brave://extensions, enable Developer mode and Load unpacked. For manual updates retain a backup, verify and extract into a temporary folder, close extension popups and application tabs, replace all contents inside the existing parent folder without changing its path, then click Reload on the existing extension and reopen job tabs. Do not Remove, load a different copy, delete the browser profile or blindly merge files. Verify the installed version afterward. Downloads and website refreshes never install or update the extension automatically.',
} as const
