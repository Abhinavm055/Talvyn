import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  FolderArchive,
  FolderOpen,
  Puzzle,
  ToggleRight,
  Sparkles,
  Zap,
  ShieldCheck,
  KanbanSquare,
  ArrowRight,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useAuthStore } from '../../store/authStore'

// SVG browser badges
function ChromeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#EA4335" />
      <path d="M12 2A10 10 0 0 1 22 12L12 12Z" fill="#FBBC05" />
      <path d="M12 22A10 10 0 0 1 3.34 7.5L8.34 16.16L12 22Z" fill="#34A853" />
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="4" fill="#4285F4" />
    </svg>
  )
}

function BraveIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z"
        fill="#FF5500"
      />
      <path
        d="M12 5.5L6 8.5V11.5C6 15.2 8.56 18.66 12 19.5C15.44 18.66 18 15.2 18 11.5V8.5L12 5.5Z"
        fill="#FFFFFF"
        opacity="0.85"
      />
      <circle cx="12" cy="12.5" r="3" fill="#FF5500" />
    </svg>
  )
}

function EdgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M19.5 12C19.5 7.86 16.14 4.5 12 4.5C8.42 4.5 5.43 7.02 4.69 10.38C4.56 10.96 5.04 11.5 5.63 11.5H12C13.66 11.5 15 12.84 15 14.5C15 16.16 13.66 17.5 12 17.5C10.5 17.5 9.24 16.38 9.04 14.92C8.94 14.23 8.35 13.75 7.65 13.84C5.02 14.18 3 16.44 3 19.16C3 20.73 4.27 22 5.84 22C11.5 22 21 17.5 19.5 12Z"
        fill="#0078D7"
      />
      <path
        d="M12 4.5C16.14 4.5 19.5 7.86 19.5 12C19.5 14 18.5 16 17 17.5C16 15 14 13.5 12 13.5C9.5 13.5 7.5 15.5 7.5 18C7.5 19.5 8.5 21 10 21.8C6.5 21.5 4 18.5 4 15C4 10.5 7.5 7 12 4.5Z"
        fill="#00BCF2"
        opacity="0.9"
      />
    </svg>
  )
}

export default function Extensions() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const { user, isAuthenticated } = useAuthStore()

  // Direct static download link served by Vercel deployment
  const downloadUrl = '/downloads/talvyn%20v1.zip'

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2500)
  }

  const handleOpenExtensions = () => {
    window.open('chrome://extensions', '_blank')
  }


  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">
          Talvyn Browser Extension
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2] mt-1">
          Universal job capture, smart autofill, and automatic application tracker for Chromium browsers.
        </p>
      </div>

      {/* Balanced Two-Column Hero Showcase Card */}
      <Card padding="lg" className="border-[#E2E5EC] dark:border-[#252B3A]">
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
          <div className="space-y-3.5 flex-1 text-center md:text-left min-w-0">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">
                Talvyn for{' '}
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 dark:from-primary-400 dark:via-indigo-400 dark:to-purple-400">
                  Chromium Browsers
                </span>
              </h2>
            </div>

            <p className="text-slate-600 dark:text-[#A8B0C2] text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl">
              Save jobs with one click, autofill applications accurately with your profile data, and keep your entire career search synchronized in real time.
            </p>

            {/* Chromium Badges */}
            <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap pt-0.5">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151A29] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-[#252B3A] shadow-2xs">
                <ChromeIcon className="w-3.5 h-3.5" />
                <BraveIcon className="w-3.5 h-3.5" />
                <EdgeIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-500 dark:text-[#A8B0C2] font-medium">
                Works on Google Chrome, Brave, Microsoft Edge, and any Chromium-based browser.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                <a
                  href={downloadUrl}
                  download="talvyn v1.zip"
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white transition-all shadow-sm shadow-primary-600/20 group"
                >
                  <Download className="w-4.5 h-4.5 text-white/90 group-hover:-translate-y-0.5 transition-transform" />
                  <div className="text-left leading-tight">
                    <div className="font-bold text-xs sm:text-sm">Download Talvyn v1</div>
                    <div className="text-[10px] text-white/80 font-normal">talvyn v1.zip</div>
                  </div>
                </a>

                <Link
                  to="/extension/connect"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs sm:text-sm border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
                >
                  <Puzzle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Connect Extension</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                </Link>

                <button
                  type="button"
                  onClick={handleOpenExtensions}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252B3A] bg-white dark:bg-[#151A29] hover:bg-slate-50 dark:hover:bg-[#1E2538] text-slate-700 dark:text-[#F5F7FF] font-semibold text-xs sm:text-sm transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Open Extensions</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-[#737D94]" />
                </button>
              </div>

              <div className="text-[11px] text-slate-400 dark:text-[#737D94] font-medium">
                ZIP download • Instant 1-click connection for authenticated users
              </div>
            </div>

          </div>
        </div>
      </Card>

      {/* How to Install Section (6 Steps Horizontal Grid) */}
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F7FF]">How to Install</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Step 1 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                1
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <Download className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Download Extension
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Download <span className="font-mono text-slate-700 dark:text-[#F5F7FF]/90">Talvyn v1.zip</span>
              </p>
            </div>
          </Card>

          {/* Step 2 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                2
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FolderArchive className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Extract the ZIP
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Extract the ZIP to any folder on your device
              </p>
            </div>
          </Card>

          {/* Step 3 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                3
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Puzzle className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Open Extensions
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Open extensions in your browser
              </p>
              <div className="space-y-1 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyUrl('chrome://extensions')}
                  className="w-full text-left font-mono text-[9px] bg-slate-100 dark:bg-[#151A29] hover:bg-slate-200 dark:hover:bg-[#1E2538] px-1.5 py-1 rounded text-slate-700 dark:text-[#A8B0C2] border border-slate-200 dark:border-[#252B3A] truncate transition-colors flex items-center justify-between cursor-pointer"
                  title="Click to copy chrome://extensions"
                >
                  <span className="truncate">chrome://extensions</span>
                  {copiedUrl === 'chrome://extensions' ? <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyUrl('brave://extensions')}
                  className="w-full text-left font-mono text-[9px] bg-slate-100 dark:bg-[#151A29] hover:bg-slate-200 dark:hover:bg-[#1E2538] px-1.5 py-1 rounded text-slate-700 dark:text-[#A8B0C2] border border-slate-200 dark:border-[#252B3A] truncate transition-colors flex items-center justify-between cursor-pointer"
                  title="Click to copy brave://extensions"
                >
                  <span className="truncate">brave://extensions</span>
                  {copiedUrl === 'brave://extensions' ? <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyUrl('edge://extensions')}
                  className="w-full text-left font-mono text-[9px] bg-slate-100 dark:bg-[#151A29] hover:bg-slate-200 dark:hover:bg-[#1E2538] px-1.5 py-1 rounded text-slate-700 dark:text-[#A8B0C2] border border-slate-200 dark:border-[#252B3A] truncate transition-colors flex items-center justify-between cursor-pointer"
                  title="Click to copy edge://extensions"
                >
                  <span className="truncate">edge://extensions</span>
                  {copiedUrl === 'edge://extensions' ? <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                </button>
              </div>
            </div>
          </Card>

          {/* Step 4 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                4
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ToggleRight className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Enable Developer Mode
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Turn on Developer mode toggle in top-right
              </p>
            </div>
          </Card>

          {/* Step 5 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                5
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FolderOpen className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Load Unpacked
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Click &ldquo;Load unpacked&rdquo; and select the extracted folder
              </p>
            </div>
          </Card>

          {/* Step 6 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A]">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                6
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F5F7FF] leading-snug">
                Connect Account
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
                Open Talvyn extension and sign in with your account
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Feature Highlights Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Smart Job Extraction</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Instantly captures job title, company, salary, location, and description across LinkedIn, Indeed, Ashby, Greenhouse, Lever, and 20+ ATS platforms.
          </p>
        </Card>

        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Universal Autofill</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Fills complex application forms in seconds using your Talvyn profile while preserving manually entered answers and critical terms.
          </p>
        </Card>

        <Card padding="md" className="border-[#E2E5EC] dark:border-[#252B3A] space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <KanbanSquare className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#F5F7FF]">Automatic Tracking</h4>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] leading-relaxed">
            Detects completed submissions automatically and transitions job cards across your career tracker pipeline with timestamps and notes.
          </p>
        </Card>
      </div>

      {/* Security & Reliability Banner */}
      <div className="p-4 rounded-2xl bg-[#F1F3F8] dark:bg-[#0D101A] border border-[#E2E5EC] dark:border-[#252B3A] flex items-center justify-between gap-4 flex-wrap text-xs text-slate-500 dark:text-[#A8B0C2]">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Privacy First: Works locally with your authenticated Talvyn account. No tracking or telemetry.
        </span>
        <span className="font-mono text-[11px] text-slate-400 dark:text-[#737D94]">
          Manifest V3 • Production Build
        </span>
      </div>
    </div>
  )
}
