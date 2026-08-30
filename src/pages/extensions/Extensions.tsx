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
  Camera,
  Crop,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { profileApi } from '../../api/profile'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PhotoCropModal } from '../../components/profile/PhotoCropModal'
import { cn } from '../../lib/utils'

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
  const { user, setUser } = useAuthStore()
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)

  // Direct static download link served by Vercel deployment
  const downloadUrl = '/downloads/talvyn-v1.zip'

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2500)
  }

  const handleOpenExtensions = () => {
    // Attempt standard browser extensions tab
    window.open('chrome://extensions', '_blank')
  }

  const handleAvatarSave = async (file: File) => {
    const res = await profileApi.uploadAvatar(file)
    if (res.success && user) {
      setUser({
        ...user,
        profile: {
          ...user.profile,
          avatarUrl: res.avatarUrl,
        } as any,
      })
    }
  }

  const displayName =
    user?.profile?.preferredName ||
    user?.profile?.givenName ||
    user?.profile?.legalFullName ||
    user?.email?.split('@')[0] ||
    'M ABHINAV'

  const userEmail = user?.email || '23cs055@drngpit.ac.in'
  const avatarUrl = user?.profile?.avatarUrl

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Extension
        </h1>
      </div>

      {/* Hero Showcase Card */}
      <Card padding="lg" className="border-slate-200/90 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Logo Showcase (Left) */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-800/60 dark:to-indigo-950/30 rounded-3xl p-4 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800/80 shadow-inner">
            <img
              src="/logotalvyn.png"
              alt="Talvyn Logo"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>

          {/* Hero Content (Right) */}
          <div className="space-y-4 flex-1 text-center lg:text-left">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Talvyn for
              </h2>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 dark:from-primary-400 dark:via-indigo-400 dark:to-purple-400 tracking-tight mt-0.5">
                All Chromium Browsers
              </h2>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
              Save jobs, autofill applications, and keep your job search automatically organized.
            </p>

            {/* Chromium Badges */}
            <div className="flex items-center justify-center lg:justify-start gap-2.5 flex-wrap pt-1">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <ChromeIcon className="w-4 h-4" />
                <BraveIcon className="w-4 h-4" />
                <EdgeIcon className="w-4 h-4" />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Works on Chrome, Brave, Edge, and any Chromium-based browser.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                <a
                  href={downloadUrl}
                  download="talvyn-v1.zip"
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white transition-all shadow-md shadow-primary-600/20 group"
                >
                  <Download className="w-5 h-5 text-white/90 group-hover:-translate-y-0.5 transition-transform" />
                  <div className="text-left leading-tight">
                    <div className="font-bold text-sm">Download Extension</div>
                    <div className="text-[11px] text-white/80 font-normal">talvyn-v1.zip (ZIP)</div>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={handleOpenExtensions}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors shadow-2xs"
                >
                  <span>Open Extensions</span>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                ZIP download • No npm or coding required
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* How to Install Section (6 Steps Horizontal Grid) */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">How to Install</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Step 1 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                1
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Download Extension
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Download <span className="font-mono text-slate-700 dark:text-slate-300">talvyn-v1.zip</span>
              </p>
            </div>
          </Card>

          {/* Step 2 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                2
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FolderArchive className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Extract the ZIP
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Extract the ZIP to any folder
              </p>
            </div>
          </Card>

          {/* Step 3 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                3
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Puzzle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Open Extensions
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Open extensions in your browser
              </p>
              <div className="space-y-1 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyUrl('chrome://extensions')}
                  className="w-full text-left font-mono text-[9px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-1.5 py-1 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate transition-colors flex items-center justify-between"
                  title="Click to copy chrome://extensions"
                >
                  <span className="truncate">chrome://extensions</span>
                  {copiedUrl === 'chrome://extensions' ? <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyUrl('brave://extensions')}
                  className="w-full text-left font-mono text-[9px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-1.5 py-1 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate transition-colors flex items-center justify-between"
                  title="Click to copy brave://extensions"
                >
                  <span className="truncate">brave://extensions</span>
                  {copiedUrl === 'brave://extensions' ? <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                </button>
              </div>
            </div>
          </Card>

          {/* Step 4 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                4
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ToggleRight className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Enable Developer Mode
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Turn on the Developer mode toggle
              </p>
            </div>
          </Card>

          {/* Step 5 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                5
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Load Unpacked
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Click &ldquo;Load unpacked&rdquo; and select the extracted folder
              </p>
            </div>
          </Card>

          {/* Step 6 */}
          <Card padding="md" className="flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                6
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                Connect Account
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Open Talvyn extension and sign in with your account
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Connected Account Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connected Account</h3>

        <Card padding="lg" className="border-slate-200/90 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Avatar + Info */}
            <div className="flex items-center gap-5">
              {/* Profile Avatar with Camera Trigger */}
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 dark:from-primary-950 dark:to-indigo-950 flex items-center justify-center ring-2 ring-primary-200 dark:ring-primary-900 shadow-sm">
                    <span className="text-primary-700 dark:text-primary-300 text-2xl font-bold uppercase">
                      {displayName.charAt(0)}
                    </span>
                  </div>
                )}

                {/* Camera Overlay Icon */}
                <button
                  type="button"
                  onClick={() => setIsCropModalOpen(true)}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 transition-all hover:scale-105"
                  title="Upload / Crop Profile Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* User Details */}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    {displayName}
                  </h4>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Account Ready
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {userEmail}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                  Your Talvyn profile and saved job data will sync with the extension.
                </p>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="secondary"
                size="sm"
                icon={<Crop className="w-3.5 h-3.5" />}
                onClick={() => setIsCropModalOpen(true)}
              >
                Crop Photo
              </Button>

              <Link to="/profile">
                <Button variant="secondary" size="sm">
                  <span>Manage Profile</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Recommended: Square image</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Encrypted cloud synchronization active
            </span>
          </div>
        </Card>
      </div>

      {/* Photo Crop Modal */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        onSave={handleAvatarSave}
        initialImageUrl={avatarUrl || undefined}
      />
    </div>
  )
}
