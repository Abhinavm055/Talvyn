import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  CheckCircle2,
  Puzzle,
  Sparkles,
  Zap,
  ShieldCheck,
  KanbanSquare,
  ArrowRight,
  RotateCw,
  Download,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  FolderArchive,
  ArrowUpRight,
  AlertCircle,
  FolderCheck,
  Terminal,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useExtensionStatus } from '../../hooks/useExtensionStatus'
import { releaseClient } from '../../api/extensionRelease'
import type { ReleaseAvailability, PublishedExtensionRelease } from '../../types/release'
import { compareExtensionVersions } from '../../utils/compareVersions'

export type ReleaseState =
  | { state: 'loading' }
  | { state: 'unavailable'; error?: string }
  | { state: 'ready'; availability: ReleaseAvailability }

export function releaseVersionMessage(installedVersion: string | undefined, publishedVersion: string): string {
  if (!installedVersion) return 'Install this release using the steps below. The installed version is not available in this browser.'
  const comparison = compareExtensionVersions(installedVersion, publishedVersion)
  if (comparison === -1) return 'New version available. Download the ZIP and update the existing extension folder manually.'
  if (comparison === 0) return 'Latest version already installed. No update is needed.'
  if (comparison === 1) return 'Your installed version is newer than the latest published release. No downgrade is recommended.'
  return 'Version comparison is unavailable. Check the version on the existing extension card before changing files.'
}

const UPDATE_STEPS = [
  'Download the latest published ZIP from the trusted release link. Compare its SHA-256 with the value shown for that release before updating.',
  'Extract the ZIP into a temporary folder. Confirm manifest.json is at its root and its version is the release you selected.',
  'Back up or retain all contents of your existing extension folder in a separate backup folder, and record the original parent folder path.',
  'Close extension popups and application or job tabs that might be using the extension.',
  'After checking the backup, move the old contents out of the original extension folder and copy all new extracted contents into that same folder. Keep the original parent folder path unchanged. Replace the contents; do not blindly merge old and new files.',
  'Type chrome://extensions/ into Chrome’s address bar (or brave://extensions/ in Brave).',
  'Click Reload on the existing Talvyn extension card. Do not click Remove or Load unpacked again for a routine update.',
  'Reopen job tabs and the Talvyn popup, verify the installed version, then return here and choose Retry Detection. Expired or revoked sessions still require reconnection.',
]

const FIRST_INSTALL_STEPS = [
  'Once a release is published, download talvyn-extension.zip from the trusted GitHub release linked above. Verify its SHA-256 before opening the archive.',
  'Extract into a temporary folder, then place the complete extracted contents in a permanent folder you will keep. Record that folder path. manifest.json must be directly inside it.',
  'Open chrome://extensions/ in Chrome (or brave://extensions/ in Brave) by typing the address into the browser address bar. Enable Developer mode.',
  'Choose Load unpacked once and select the permanent folder containing manifest.json. Keep the folder; Chrome reads the extension from it.',
  'Open the Talvyn popup and choose Connect. Return to Talvyn, review the account and connection consent, and approve the independent extension session. Retry Detection on this page.',
]

/** Reference instructions preserved for test compatibility and offline review. */
export function ManualExtensionInstructions() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card id="first-install" padding="lg" className="space-y-4 scroll-mt-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF]">First-time installation</h3>
        <ol className="list-decimal pl-5 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
          {FIRST_INSTALL_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </Card>
      <Card id="manual-update" padding="lg" className="space-y-4 scroll-mt-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF]">Update your existing installation</h3>
        <ol className="list-decimal pl-5 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
          {UPDATE_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </Card>
      <p className="lg:col-span-2 rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/25 p-4 text-xs text-amber-900 dark:text-amber-100">
        Keep the same parent folder and existing extension card to retain browser storage and connection identity during a routine update. Do not remove Talvyn, load a different copy, or delete your browser profile. A changed extension ID may require reconnection and operator configuration. Downloads and Reload are manual; this website cannot install or automatically update the extension.
      </p>
    </div>
  )
}

// SVG browser badges
function ChromeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#EA4335" />
      <path d="M12 2A10 10 0 0 1 22 12L12 12Z" fill="#FBBC05" />
      <path d="M12 22A10 10 0 0 1 3.34 7.5L8.34 16.16L12 22Z" fill="#34A853" />
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
      <circle cx="12" cy="4" r="4" fill="#4285F4" />
    </svg>
  )
}

function BraveIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z" fill="#FF5500" />
      <path d="M12 5.5L6 8.5V11.5C6 15.2 8.56 18.66 12 19.5C15.44 18.66 18 15.2 18 11.5V8.5L12 5.5Z" fill="#FFFFFF" opacity="0.85" />
      <circle cx="12" cy="12.5" r="3" fill="#FF5500" />
    </svg>
  )
}

function EdgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M19.5 12C19.5 7.86 16.14 4.5 12 4.5C8.42 4.5 5.43 7.02 4.69 10.38C4.56 10.96 5.04 11.5 5.63 11.5H12C13.66 11.5 15 12.84 15 14.5C15 16.16 13.66 17.5 12 17.5C10.5 17.5 9.24 16.38 9.04 14.92C8.94 14.23 8.35 13.75 7.65 13.84C5.02 14.18 3 16.44 3 19.16C3 20.73 4.27 22 5.84 22C11.5 22 21 17.5 19.5 12Z" fill="#0078D7" />
      <path d="M12 4.5C16.14 4.5 19.5 7.86 19.5 12C19.5 14 18.5 16 17 17.5C16 15 14 13.5 12 13.5C9.5 13.5 7.5 15.5 7.5 18C7.5 19.5 8.5 21 10 21.8C6.5 21.5 4 18.5 4 15C4 10.5 7.5 7 12 4.5Z" fill="#00BCF2" opacity="0.9" />
    </svg>
  )
}

interface WizardProps {
  published: PublishedExtensionRelease | null
  releaseState: ReleaseState
  status: ReturnType<typeof useExtensionStatus>['status']
  checking: boolean
  retryDetection: () => void
  onDownloadClick: () => void
}

export function InstallationWizard({
  published,
  releaseState,
  status,
  checking,
  retryDetection,
  onDownloadClick,
}: WizardProps) {
  const [activeStep, setActiveStep] = useState(1)
  const [copiedBrowserUrl, setCopiedBrowserUrl] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)

  const copyToClipboard = async (text: string, type: 'url' | 'hash') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
      if (type === 'url') {
        setCopiedBrowserUrl(text)
        setTimeout(() => setCopiedBrowserUrl(null), 2500)
      } else {
        setCopiedHash(true)
        setTimeout(() => setCopiedHash(false), 2500)
      }
    } catch {
      /* ignore clipboard permission errors */
    }
  }

  const steps = [
    { num: 1, title: 'Download' },
    { num: 2, title: 'Extract' },
    { num: 3, title: 'Load in Browser' },
    { num: 4, title: 'Connect' },
    { num: 5, title: 'Complete' },
  ]

  return (
    <Card padding="lg" className="border-[#E2E5EC] dark:border-[#252B3A] shadow-sm space-y-6">
      {/* Wizard Header & Stepper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">
              Guided Installation Wizard
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A8B0C2]">
              Step-by-step instructions to load the unpacked extension in Chrome or Brave.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200/60 dark:border-primary-900/60">
            Step {activeStep} of 5: {steps[activeStep - 1].title}
          </span>
        </div>

        {/* Interactive Step Progress Pills */}
        <div className="grid grid-cols-5 gap-1 sm:gap-2 pt-1" role="tablist" aria-label="Installation steps">
          {steps.map((step) => {
            const isCurrent = activeStep === step.num
            const isPast = activeStep > step.num
            return (
              <button
                key={step.num}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={`Step ${step.num}: ${step.title}`}
                onClick={() => setActiveStep(step.num)}
                className={`py-2 px-1.5 sm:px-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  isCurrent
                    ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                    : isPast
                    ? 'bg-slate-100 dark:bg-[#151A29] text-slate-800 dark:text-[#F5F7FF] border-slate-200 dark:border-[#252B3A] hover:border-primary-400'
                    : 'bg-transparent text-slate-400 dark:text-[#737D94] border-transparent hover:bg-slate-50 dark:hover:bg-[#151A29]/50'
                }`}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold">
                  {isPast ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : step.num}
                </div>
                <span className="text-[10px] sm:text-xs font-medium truncate w-full hidden sm:block">
                  {step.title}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Content Container */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-50/70 dark:bg-[#151A29]/60 border border-slate-200/80 dark:border-[#252B3A] min-h-[280px] flex flex-col justify-between space-y-6">
        {/* STEP 1: DOWNLOAD */}
        {activeStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Step 1: Download the Extension Archive
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2] leading-relaxed">
                Talvyn distributes production extensions as a verified standalone ZIP archive hosted on GitHub Releases.
              </p>
            </div>

            {published ? (
              <div className="p-4 rounded-xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-[#F5F7FF] text-sm">talvyn-extension.zip</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        v{published.version} Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#A8B0C2] mt-0.5">
                      Official GitHub release archive for Chrome, Brave, and Chromium.
                    </p>
                  </div>
                  <a
                    href={published.downloadUrl}
                    onClick={onDownloadClick}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Download Talvyn for Chrome
                  </a>
                </div>

                {/* Checksum quick verify */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#252B3A] space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-500 dark:text-[#A8B0C2]">SHA-256 Checksum:</span>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(published.sha256, 'hash')}
                      className="inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedHash ? 'Copied hash' : 'Copy hash'}
                    </button>
                  </div>
                  <code className="block p-2 rounded-lg bg-slate-100 dark:bg-[#151A29] font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all">
                    {published.sha256}
                  </code>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs sm:text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  The Talvyn extension download is not available yet.
                </p>
                <p className="text-xs leading-relaxed">
                  The first public release has not been published or cannot currently be verified. Releases are published as verified GitHub Release archives.
                  {releaseClient.releasesUrl && (
                    <> You can check the repository at{' '}
                      <a href={releaseClient.releasesUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        GitHub Releases
                      </a>.
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2]">
                  Project owners can test locally using <code>npm run package:extension</code> and loading <code>extension/dist</code> unpacked.
                </p>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-[#A8B0C2]">
              After saving <code>talvyn-extension.zip</code> to your computer, proceed to the extraction step.
            </p>
          </div>
        )}

        {/* STEP 2: EXTRACT */}
        {activeStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Step 2: Extract to a Permanent Folder
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2] leading-relaxed">
                Extract the downloaded ZIP into a folder that will permanently stay on your computer.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    Create or choose a permanent folder, for example:
                    <code className="block my-1 p-2 rounded-lg bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] font-mono text-xs text-indigo-600 dark:text-indigo-400 select-all">
                      C:\Tools\TalvynExtension
                    </code>
                  </li>
                  <li>
                    Extract all files from <code>talvyn-extension.zip</code> directly into this directory.
                  </li>
                  <li>
                    <strong>Critical:</strong> Verify that <code>manifest.json</code> is located directly inside the root of your chosen folder.
                  </li>
                  <li className="text-amber-800 dark:text-amber-200 font-medium">
                    Do not keep files inside an extra nested folder (e.g. <code>C:\Tools\TalvynExtension\talvyn-extension\...</code>).
                  </li>
                </ol>
              </div>

              {/* Visual folder layout */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FolderCheck className="w-4 h-4 text-emerald-500" />
                  Correct Folder Structure
                </span>
                <pre className="font-mono text-[11px] leading-relaxed text-slate-600 dark:text-[#A8B0C2] bg-slate-50 dark:bg-[#151A29] p-2.5 rounded-lg overflow-x-auto">
{`📁 C:\\Tools\\TalvynExtension\\
   ├── 📄 manifest.json   <-- Directly at root!
   ├── 📄 service-worker-loader.js
   ├── 📁 icons\\
   └── 📁 assets\\`}
                </pre>
                <p className="text-[11px] text-slate-400 dark:text-[#737D94]">
                  Keep this folder permanent. Chromium loads unpacked files directly from this disk path.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: LOAD UNPACKED */}
        {activeStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                <Puzzle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Step 3: Load into Chrome or Brave
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2] leading-relaxed">
                Chromium browsers cannot automatically install local unpacked extensions from website links. Open extension settings manually:
              </p>
            </div>

            {/* Browser Navigation Helper Buttons */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                1. Open your browser extensions page:
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copyToClipboard('chrome://extensions/', 'url')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#151A29] hover:bg-slate-200 dark:hover:bg-[#1E2436] text-slate-800 dark:text-[#F5F7FF] text-xs font-medium border border-slate-200 dark:border-[#252B3A] transition-all"
                >
                  <ChromeIcon className="w-4 h-4" />
                  <span>Copy chrome://extensions/</span>
                  {copiedBrowserUrl === 'chrome://extensions/' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => void copyToClipboard('brave://extensions/', 'url')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#151A29] hover:bg-slate-200 dark:hover:bg-[#1E2436] text-slate-800 dark:text-[#F5F7FF] text-xs font-medium border border-slate-200 dark:border-[#252B3A] transition-all"
                >
                  <BraveIcon className="w-4 h-4" />
                  <span>Copy brave://extensions/</span>
                  {copiedBrowserUrl === 'brave://extensions/' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                {copiedBrowserUrl && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                    Copied! Paste into your browser address bar.
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-[#252B3A] space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary-600 shrink-0">2.</span>
                  <span>Enable <strong>Developer mode</strong> using the toggle in the top-right corner.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary-600 shrink-0">3.</span>
                  <span>Click <strong>Load unpacked</strong> once in the top-left toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary-600 shrink-0">4.</span>
                  <span>Select your permanent folder (the one containing <code>manifest.json</code>).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary-600 shrink-0">5.</span>
                  <span>Pin the Talvyn icon to your browser toolbar for quick access.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CONNECT ACCOUNT */}
        {activeStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                <Puzzle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Step 4: Authorize Account Connection
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2] leading-relaxed">
                Link the installed extension to your Talvyn account to synchronize saved jobs, profile preferences, and application tracking.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] space-y-3">
              <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
                <p>
                  1. Click the <strong>Talvyn icon</strong> in your browser toolbar to open the extension popup.
                </p>
                <p>
                  2. In the popup, click <strong>Connect Account</strong>, or open the authorization prompt directly:
                </p>
                <div className="pt-1">
                  <Link
                    to="/extension/connect"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs sm:text-sm border border-indigo-200 dark:border-indigo-800 transition-all"
                  >
                    <Puzzle className="w-4 h-4" />
                    Open Extension Connection Page
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p>
                  3. Confirm your account details on the connection page and approve pairing. The extension will store independent, rotating session credentials.
                </p>
              </div>

              {status.state === 'configuration-required' && (
                <div role="alert" className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                  <p className="font-semibold">Operator Configuration Required</p>
                  <p>The project owner must configure the trusted extension public key in production environment variables before production account connection is available.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: COMPLETE */}
        {activeStep === 5 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF]">
                Setup Guide Complete
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2] max-w-md mx-auto">
                Your browser extension is configured to capture job listings and autofill job applications.
              </p>
            </div>

            {/* Live Detection Summary Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#A8B0C2]">Live Browser Status:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {status.state === 'connected' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Connected to {status.user?.email}
                      </span>
                    ) : status.installed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <Puzzle className="w-4 h-4" /> Installed (v{status.version || 'unknown'}) · {status.message}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#A8B0C2]">
                        {status.message}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={retryDetection}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252B3A] bg-slate-50 dark:bg-[#151A29] text-xs font-semibold text-slate-700 dark:text-[#F5F7FF] disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking…' : 'Retry Detection'}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-[#737D94] border-t border-slate-100 dark:border-[#252B3A] pt-2">
                Note: This wizard does not falsely mark your extension as connected. Real browser communication is required.
              </p>
            </div>

            {/* Action Links */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/tracker"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
              >
                <KanbanSquare className="w-4 h-4" />
                Go to Application Tracker
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252B3A] bg-white dark:bg-[#111522] text-slate-700 dark:text-[#F5F7FF] font-semibold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-[#151A29] transition-all"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-[#252B3A] flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveStep((step) => Math.max(1, step - 1))}
            disabled={activeStep === 1}
            className="text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Back
          </Button>

          {activeStep < 5 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveStep((step) => Math.min(5, step + 1))}
              className="text-xs"
            >
              <span>{activeStep === 1 ? 'Continue to Step 2' : 'I\'ve completed this step'}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveStep(1)}
              className="text-xs"
            >
              Restart Guide
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function Extensions() {
  const { status, checking, retry } = useExtensionStatus()
  const canConnect = status.installed && (status.state === 'disconnected' || status.state === 'reconnect-required' || status.state === 'connected')
  const [releaseState, setReleaseState] = useState<ReleaseState>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [downloadOpened, setDownloadOpened] = useState(false)
  const [downloadProblem, setDownloadProblem] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const releaseSequence = useRef(0)

  useEffect(() => {
    const sequence = ++releaseSequence.current
    const controller = new AbortController()
    setReleaseState({ state: 'loading' })
    setDownloadOpened(false)
    setDownloadProblem(false)
    releaseClient.load({ signal: controller.signal })
      .then((availability) => {
        if (sequence === releaseSequence.current) setReleaseState({ state: 'ready', availability })
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : undefined
        if (sequence === releaseSequence.current) setReleaseState({ state: 'unavailable', error })
      })
    return () => {
      releaseSequence.current++
      controller.abort()
    }
  }, [attempt])

  const published = releaseState.state === 'ready' && releaseState.availability.status === 'published' ? releaseState.availability.release : null

  const copyHash = async (hash: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(hash)
      }
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">
          Talvyn Browser Extension
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2] mt-1">
          Universal job capture, smart autofill, and automatic application tracker for Chromium browsers.
        </p>
      </div>

      {/* Prominent Primary Showcase & Download Hero Card */}
      <Card padding="lg" className="border-[#E2E5EC] dark:border-[#252B3A] shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
          {/* Logo Container */}
          <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-[#151A29] dark:via-[#111522] dark:to-indigo-950/40 rounded-2xl p-4 flex items-center justify-center shrink-0 border border-slate-200/70 dark:border-[#252B3A] shadow-xs">
            <img
              src="/logotalvyn.png"
              alt="Talvyn Logo"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>

          {/* Hero Content */}
          <div className="space-y-4 flex-1 text-center md:text-left min-w-0">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">
                Talvyn for{' '}
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 dark:from-primary-400 dark:via-indigo-400 dark:to-purple-400">
                  Chromium Browsers
                </span>
              </h2>
              <p className="text-slate-600 dark:text-[#A8B0C2] text-xs sm:text-sm md:text-base leading-relaxed mt-1.5 max-w-2xl">
                Save jobs with one click, autofill applications accurately with your profile data, and keep your entire career search synchronized in real time.
              </p>
            </div>

            {/* Chromium Badges */}
            <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151A29] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-[#252B3A] shadow-2xs">
                <ChromeIcon className="w-3.5 h-3.5" />
                <BraveIcon className="w-3.5 h-3.5" />
                <EdgeIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-500 dark:text-[#A8B0C2] font-medium">
                Built for Google Chrome and Brave; other Chromium browsers supported.
              </span>
            </div>

            {/* Prominent Primary Download Action Area */}
            <div className="pt-2 space-y-3">
              {published ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                    <a
                      href={published.downloadUrl}
                      onClick={() => { setDownloadOpened(true); setDownloadProblem(false) }}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Download Talvyn Extension"
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-indigo-500/20 transition-all"
                    >
                      <Download className="w-5 h-5" />
                      Download Talvyn Extension (.zip)
                    </a>

                    <span className="text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#151A29] text-slate-700 dark:text-[#F5F7FF] border border-slate-200/80 dark:border-[#252B3A]">
                      Version {published.version}
                    </span>

                    <Link
                      to="/releases"
                      className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
                    >
                      View release notes
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Checksum Snippet with Copy Button */}
                  <div className="rounded-xl bg-slate-50 dark:bg-[#151A29] border border-slate-200/70 dark:border-[#252B3A] p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        SHA-256 Checksum (verify before replacing files):
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyHash(published.sha256)}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedHash ? 'Copied' : 'Copy Checksum'}
                      </button>
                    </div>
                    <code className="block overflow-x-auto text-[11px] font-mono text-slate-600 dark:text-slate-300 select-all" aria-label="Published ZIP SHA-256">
                      {published.sha256}
                    </code>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#A8B0C2]">
                      <Terminal className="w-3.5 h-3.5 shrink-0" />
                      <code>Get-FileHash -Algorithm SHA256 -LiteralPath '.\talvyn-extension.zip'</code>
                    </div>
                  </div>
                </div>
              ) : releaseState.state === 'loading' ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151A29] border border-slate-200/60 dark:border-[#252B3A] text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2] flex items-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin text-primary-600" />
                  Checking for published releases…
                </div>
              ) : releaseState.state === 'unavailable' ? (
                <div role="alert" className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-800 dark:text-red-200 space-y-2">
                  <p className="font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    Release metadata unavailable
                  </p>
                  <p className="text-xs">
                    {releaseState.error ? `${releaseState.error} ` : ''}The latest published version and download could not be verified. Your existing installation can keep using its current files.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setAttempt((value) => value + 1)}
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Retry release check
                    </button>
                    {releaseClient.releasesUrl && (
                      <>
                        <span className="text-slate-400 dark:text-[#737D94]">·</span>
                        <a
                          href={releaseClient.releasesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View GitHub Releases
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Not published */
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151A29] border border-slate-200/80 dark:border-[#252B3A] space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
                  <p className="font-bold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    The Talvyn extension download is not available yet.
                  </p>
                  <p className="text-xs leading-relaxed">
                    The first public release has not been published or cannot currently be verified. Releases are published as verified GitHub Release archives.
                    No GitHub release has been published yet. A public download will appear after the owner publishes a verified release.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    {releaseClient.releasesUrl && (
                      <a
                        href={releaseClient.releasesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Visit Talvyn GitHub Releases
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-slate-400 dark:text-[#737D94]">·</span>
                    <span>Local developer build: <code>npm run package:extension</code> with <code>extension/dist</code></span>
                  </div>
                </div>
              )}

              {/* Download Feedback Messages */}
              {downloadOpened && (
                <p role="status" className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3 text-xs text-indigo-800 dark:text-indigo-200">
                  Download opened. Your browser controls download progress; this website cannot confirm completion. Save and verify the ZIP, then follow the installation wizard below.
                </p>
              )}
              {downloadProblem && (
                <p role="alert" className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-200">
                  If the download failed or the checksum differs, do not replace your existing files. Delete the incomplete download, retry from the trusted release, and compare the full SHA-256 again. Keep your existing installation or restore its backed-up contents at the original path and Reload if an update failed.
                </p>
              )}

              {/* Status and Secondary Buttons Row */}
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap pt-1">
                {canConnect && (
                  <Link
                    to="/extension/connect"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800"
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                    {status.state === 'connected' ? 'Manage Connection' : 'Connect Extension'}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void retry()}
                  disabled={checking}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#252B3A] bg-white dark:bg-[#151A29] text-slate-700 dark:text-[#F5F7FF] font-semibold text-xs disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking…' : 'Retry Detection'}
                </button>
              </div>

              {/* Connection Status Text */}
              <p role="status" className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                {status.state === 'connected' && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1 text-emerald-500" />}
                {status.message}
                {status.version ? ` Installed version: ${status.version}.` : ''}
              </p>

              {status.state === 'configuration-required' && (
                <div role="alert" className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/25 text-xs text-amber-900 dark:text-amber-100 space-y-1 text-left">
                  <p className="font-semibold">Operator Configuration Required</p>
                  <p>{status.message}</p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-[#737D94]">
                GitHub-hosted ZIP · Install unpacked once · Update the same folder and click Reload
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Guided Installation Wizard */}
      <InstallationWizard
        published={published}
        releaseState={releaseState}
        status={status}
        checking={checking}
        retryDetection={() => void retry()}
        onDownloadClick={() => { setDownloadOpened(true); setDownloadProblem(false) }}
      />

      {/* Published Release Metadata Card */}
      <Card padding="lg" className="space-y-4" aria-label="Extension release information">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF]">Published Release Details</h3>
          {published && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#151A29] text-slate-600 dark:text-[#A8B0C2]">
              Published: {published.publishedAt}
            </span>
          )}
        </div>

        {releaseState.state === 'loading' && (
          <p role="status" className="text-sm text-slate-500 dark:text-[#A8B0C2]">Loading release metadata…</p>
        )}

        {releaseState.state === 'unavailable' && (
          <div role="alert" className="space-y-2 text-sm text-slate-600 dark:text-[#A8B0C2]">
            <p>Release metadata unavailable. The latest published version and download could not be verified. Your existing installation can keep using its current files.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Retry release check
            </button>
          </div>
        )}

        {releaseState.state === 'ready' && releaseState.availability.status === 'not-published' && (
          <div className="space-y-2 text-sm text-slate-600 dark:text-[#A8B0C2]">
            <p>No GitHub release has been published yet. A public download will appear after the owner publishes a verified release.</p>
            <p>The project owner can currently build locally with <code>npm run package:extension</code> and load <code>extension/dist</code> unpacked. Local builds require trusted connection configuration.</p>
          </div>
        )}

        {published && (
          <div className="space-y-4 text-sm text-slate-600 dark:text-[#A8B0C2]">
            <div>
              <p className="font-semibold text-slate-900 dark:text-[#F5F7FF]">Latest published version: v{published.version}</p>
              <p>Published: {published.publishedAt}</p>
              <p role="status" className="mt-2 text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                {releaseVersionMessage(status.version, published.version)}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 dark:text-[#F5F7FF]">{published.title}</h4>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs sm:text-sm">
                {published.changes.map((change, index) => <li key={`${index}-${change}`}>{change}</li>)}
              </ul>
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <a href={published.releaseNotesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center text-indigo-600 dark:text-indigo-400 hover:underline">
                GitHub release notes<ExternalLink className="h-3 w-3" />
              </a>
              <Link to="/releases" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Release details
              </Link>
              <button type="button" onClick={() => setDownloadProblem((value) => !value)} aria-expanded={downloadProblem} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Download or verification problem?
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs pt-2 border-t border-slate-100 dark:border-[#252B3A]">
          <p className="text-slate-500 dark:text-[#A8B0C2]">
            Website’s local extension build: v{releaseClient.localBuildVersion}. This is not proof of publication.
          </p>
          {releaseClient.releasesUrl && (
            <a href={releaseClient.releasesUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Previous GitHub releases
            </a>
          )}
          <a href="#extension-troubleshooting" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Troubleshooting
          </a>
        </div>
      </Card>

      {/* Manual Update Instructions Section */}
      <Card id="manual-update" padding="lg" className="space-y-4 scroll-mt-6 border-[#E2E5EC] dark:border-[#252B3A]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF]">
            Update your existing installation
          </h3>
          {status.version && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#151A29] text-slate-600 dark:text-[#A8B0C2]">
              Installed: v{status.version}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
          When a new release is available, update your existing permanent folder directly to retain your extension ID and active session:
        </p>
        <ol className="list-decimal pl-5 space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
          {UPDATE_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/25 p-4 text-xs text-amber-900 dark:text-amber-100">
          <strong>Important update rule:</strong> Keep the original parent folder path unchanged. Click Reload on the existing Talvyn extension card. Do not click Remove or Load unpacked again. Do not remove Talvyn, load a different copy, or delete your browser profile. A routine update preserves your connection and local storage.
        </div>
      </Card>

      {/* Troubleshooting Section */}
      <Card id="extension-troubleshooting" padding="lg" className="space-y-3 scroll-mt-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F7FF]">Troubleshooting</h3>
        <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A8B0C2]">
          <li>If Load unpacked reports a missing manifest, select the folder with <code>manifest.json</code> directly inside it; do not select the ZIP or its outer temporary folder.</li>
          <li>If detection fails, check the existing Talvyn card is enabled, Reload it, refresh Talvyn and your job tabs, open the popup, then Retry Detection. A connection configuration error needs the project operator; do not change trusted IDs at random.</li>
          <li>A routine update keeps the same extension card and parent path. A different copy or extension ID may require reconnection. Website logout leaves the independent extension session connected; disconnect in the popup or sign out of all devices from your profile.</li>
          <li>If your browser or organization disables Developer mode or unpacked extensions, ask the browser administrator. Do not delete your browser profile.</li>
          <li>For a rollback, use a trusted previous release and its checksum or your verified backup, replace the contents at the same original path, then Reload. Review compatibility notes first; a rollback may need reconnection.</li>
        </ul>
      </Card>

      {/* Feature Highlights Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Smart Job Extraction</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Instantly captures job title, company, salary, location, and description across supported LinkedIn, Indeed, Unstop, Ashby, Greenhouse, Lever, Workday, and career pages. Availability depends on page content.
          </p>
        </Card>

        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Universal Autofill</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Suggests verified profile values for supported application fields while preserving manually entered answers. Review every field before submitting.
          </p>
        </Card>

        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <KanbanSquare className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Automatic Tracking</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Recognizes supported submission confirmations and updates your application tracker with timestamps and notes. You can also update status manually.
          </p>
        </Card>
      </div>

      {/* Security & Reliability Banner */}
      <div className="p-4 rounded-2xl bg-[#F1F3F8] dark:bg-[#0D101A] border border-[#E2E5EC] dark:border-[#252B3A] flex items-center justify-between gap-4 flex-wrap text-xs text-slate-500 dark:text-[#A8B0C2]">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Job analysis works without a paid AI service. Saved jobs and profile data synchronize with your Talvyn account.
        </span>
        <span className="font-mono text-[11px] text-slate-400 dark:text-[#737D94]">
          Manifest V3 • Review every autofilled application
        </span>
        <Link to="/privacy" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          Privacy information
        </Link>
      </div>
    </div>
  )
}
