import { useState } from 'react'
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Zap,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export default function Extensions() {
  const { user } = useAuthStore()
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Direct static download link served by Vercel deployment
  const downloadUrl = '/downloads/talvyn-chrome-extension.zip'
  const chromeExtensionsUrl = 'chrome://extensions'

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(chromeExtensionsUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  const userEmail = user?.email || 'your-account@example.com'

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="flex items-start gap-4">
          <img
            src="/icons/icon48.svg"
            alt="Talvyn Extension"
            className="w-13 h-13 rounded-2xl shadow-md shadow-primary-600/15 shrink-0"
          />
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Talvyn for Chrome
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl leading-relaxed">
              Save jobs, autofill applications, and keep your job search automatically organized.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <a
              href={downloadUrl}
              download="talvyn-chrome-extension.zip"
              target="_self"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white transition-all shadow-sm shadow-primary-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Extension</span>
            </a>

            <a
              href="chrome://extensions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              <span>Open Chrome Extensions</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            ZIP download • No npm or coding required
          </span>
        </div>
      </div>

      {/* Account Connection Status Card */}
      <Card padding="lg" className="bg-gradient-to-br from-white to-slate-50/60 border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Connected Account
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Account Ready
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              <span className="text-primary-600">{userEmail}</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Your Talvyn profile and saved job data will sync with the extension after you sign in through the Talvyn Chrome extension.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50/70 border border-emerald-100 px-3 py-2 rounded-xl shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Encrypted Cloud Sync</span>
          </div>
        </div>
      </Card>

      {/* Feature Highlights */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">What the Extension Does</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md" className="space-y-2 hover:border-slate-300 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Smart Job Scanner</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analyzes job listings across LinkedIn, Indeed, Ashby, and Lever, matches requirements against your skills, and calculates instant relevance scores.
            </p>
          </Card>

          <Card padding="md" className="space-y-2 hover:border-slate-300 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Universal Autofill</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fills complex application forms in one click using your profile data while protecting any custom answers you have already entered.
            </p>
          </Card>

          <Card padding="md" className="space-y-2 hover:border-slate-300 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Automatic Tracking</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects completed submissions and automatically records applied status, timestamps, and stage milestones on your Talvyn dashboard.
            </p>
          </Card>
        </div>
      </div>

      {/* 6 Simple User Installation Steps */}
      <Card padding="lg" className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Install Talvyn for Chrome</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Follow these simple steps to add the extension to Google Chrome:
          </p>
        </div>

        <div className="space-y-5">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              1
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Click &ldquo;Download Extension&rdquo;</h3>
              <p className="text-xs text-slate-500">
                Download the Talvyn Chrome Extension ZIP file.
              </p>
              <a
                href={downloadUrl}
                download="talvyn-chrome-extension.zip"
                target="_self"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100/80 border border-primary-200/80 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download talvyn-chrome-extension.zip</span>
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              2
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Extract the ZIP</h3>
              <p className="text-xs text-slate-500">
                Extract <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px]">talvyn-chrome-extension.zip</code> to any folder on your computer.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              3
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Open Chrome Extensions</h3>
              <p className="text-xs text-slate-500">
                In your Google Chrome address bar, open:
              </p>
              <div className="flex items-center gap-2 flex-wrap max-w-md">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-800 font-semibold border border-slate-200 select-all">
                  chrome://extensions
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href="chrome://extensions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span>Open Chrome Extensions</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              4
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Enable Developer Mode</h3>
              <p className="text-xs text-slate-500">
                Turn on the <strong>Developer mode</strong> toggle in the top-right corner.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              5
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Load the Extension</h3>
              <p className="text-xs text-slate-500">
                Click <strong>&ldquo;Load unpacked&rdquo;</strong> and select the extracted Talvyn extension folder.
              </p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
              6
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Connect Your Account</h3>
              <p className="text-xs text-slate-500">
                Click the Talvyn extension icon in Chrome and sign in with your Talvyn account.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
