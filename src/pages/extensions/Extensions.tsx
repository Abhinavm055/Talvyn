import { useState } from 'react'
import {
  Puzzle,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils'

export default function Extensions() {
  const { user } = useAuthStore()
  const [copiedFolder, setCopiedFolder] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

  // Real project path for unpacked extension dist
  const distPath = 'c:\\Users\\malay\\Projects\\Talvyn\\extension\\dist'
  const packageCmd = 'npm run package:extension'

  const handleCopyFolder = () => {
    navigator.clipboard.writeText(distPath)
    setCopiedFolder(true)
    setTimeout(() => setCopiedFolder(false), 2000)
  }

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(packageCmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const displayName =
    user?.profile?.preferredName ||
    user?.profile?.givenName ||
    user?.profile?.legalFullName ||
    user?.email?.split('@')[0] ||
    'User'

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100/80 shadow-2xs">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chrome Extension</h1>
              <p className="text-slate-500 text-sm">
                Supercharge your job search with 1-click job saving, smart autofill, and automatic tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={copiedCmd ? <Check className="text-emerald-600" /> : <Terminal />}
            onClick={handleCopyCmd}
            title="Copy package command"
          >
            {copiedCmd ? 'Command Copied!' : 'Package ZIP'}
          </Button>
          <a
            href="chrome://extensions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm"
          >
            <span>Open Chrome Extensions</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Account Connection Status Banner */}
      <Card padding="lg" className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Integration</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Talvyn API Ready
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Connected Account: <span className="text-primary-600">{user?.email}</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              When signed in through the extension, jobs you save or apply to on LinkedIn, Indeed, Ashby, and Lever will automatically sync with your Talvyn dashboard under{' '}
              <strong>{displayName}</strong>.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs min-w-[240px]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sync Endpoints</div>
            <div className="space-y-1 font-mono text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>API Base:</span>
                <span className="text-emerald-700 font-bold">http://localhost:3001</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auth Provider:</span>
                <span className="text-slate-800">{user?.authProvider || 'EMAIL'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Resumes Synced:</span>
                <span className="text-primary-700 font-bold">Live Profile</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* How it Works / Feature Highlights */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">How Talvyn for Chrome Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Smart Job Scanner</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects listings across career portals, matches requirements against your skills and roles, and computes instant relevance scores.
            </p>
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Universal Application Autofill</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fills complex application fields in one click without overwriting custom input. Flags high-risk questions for user review.
            </p>
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Automatic Tracking & Timeline</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects successful application submissions and updates your status from In Progress to Applied with timeline milestones.
            </p>
          </Card>
        </div>
      </div>

      {/* Step-by-Step Installation Instructions (Developer Mode / Unpacked) */}
      <Card padding="lg" className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Install Talvyn for Chrome (Developer Mode)</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Follow these simple steps to load the extension into your Chrome browser.
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Build or Package the Extension</h3>
              <p className="text-xs text-slate-500">
                Run the build command in your terminal to generate the latest production bundle:
              </p>
              <div className="flex items-center gap-2 bg-slate-900 text-slate-100 p-2.5 rounded-lg text-xs font-mono max-w-lg">
                <span className="text-slate-400 select-none">$</span>
                <span className="flex-1">npm run build:extension</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Open Chrome Extension Manager</h3>
              <p className="text-xs text-slate-500">
                In your Google Chrome address bar, navigate to:
              </p>
              <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-800 font-semibold border border-slate-200">
                chrome://extensions
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Enable Developer Mode</h3>
              <p className="text-xs text-slate-500">
                Turn on the <strong>Developer mode</strong> toggle located in the top-right corner of the Extensions page.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Click &quot;Load unpacked&quot; and Select the Folder</h3>
              <p className="text-xs text-slate-500">
                Click the <strong>Load unpacked</strong> button in the top-left toolbar, and select this folder from your project:
              </p>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl max-w-xl">
                <span className="font-mono text-xs text-slate-800 truncate select-all">{distPath}</span>
                <button
                  type="button"
                  onClick={handleCopyFolder}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0 transition-colors shadow-2xs"
                >
                  {copiedFolder ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFolder ? 'Copied' : 'Copy Path'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              5
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Sign in to Connect</h3>
              <p className="text-xs text-slate-500">
                Pin the Talvyn icon to your Chrome toolbar, click it, and sign in with your account credentials. You are ready to start applying!
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Production Packaging & Distribution */}
      <Card padding="lg" className="border-dashed border-slate-300 bg-slate-50/50 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary-600" />
              Production Distribution & Web Store Package
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate a clean, optimized ZIP archive for publishing to the Chrome Web Store or sharing with your team.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={copiedCmd ? <Check /> : <Terminal />}
            onClick={handleCopyCmd}
          >
            {copiedCmd ? 'Copied to Clipboard' : 'Copy npm script'}
          </Button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="font-mono text-slate-900 font-semibold">
            Artifact generated at: <span className="text-primary-600 font-normal">extension/dist-package/talvyn-chrome-extension.zip</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            The packaging script strictly bundles only production manifests, icons, and transpiled scripts. All backend secrets, environment variables, and source files are excluded automatically.
          </p>
        </div>
      </Card>
    </div>
  )
}
