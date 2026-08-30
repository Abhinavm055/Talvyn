import { useState, useEffect, useCallback } from 'react'
import {
  Puzzle,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Zap,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils'

type ExtensionStatus = 'checking' | 'not_detected' | 'installed_not_connected' | 'connected'

export default function Extensions() {
  const { user, token } = useAuthStore()
  const [status, setStatus] = useState<ExtensionStatus>('checking')
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectionSuccessMsg, setConnectionSuccessMsg] = useState<string | null>(null)

  // Direct download link pointing to the static bundle hosted on Vercel
  const downloadUrl = '/downloads/talvyn-chrome-extension.zip'

  // Ping the Chrome Extension content script to check status
  const checkExtensionStatus = useCallback(() => {
    setStatus('checking')
    window.postMessage({ type: 'TALVYN_PING_EXTENSION' }, '*')

    const timer = window.setTimeout(() => {
      setStatus((prev) => (prev === 'checking' ? 'not_detected' : prev))
    }, 600)

    return () => clearTimeout(timer)
  }, [])

  // Listen for extension handshake responses
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'TALVYN_PONG_EXTENSION') {
        if (data.connected && data.email) {
          setConnectedEmail(data.email)
          if (data.email === user?.email) {
            setStatus('connected')
          } else {
            setStatus('installed_not_connected')
          }
        } else {
          setConnectedEmail(null)
          setStatus('installed_not_connected')
        }
      }

      if (data.type === 'TALVYN_CONNECT_SUCCESS') {
        setStatus('connected')
        setConnectedEmail(data.email || user?.email || null)
        setConnecting(false)
        setConnectionSuccessMsg('Extension successfully connected to your Talvyn account!')
        setTimeout(() => setConnectionSuccessMsg(null), 5000)
      }

      if (data.type === 'TALVYN_DISCONNECT_SUCCESS') {
        setStatus('installed_not_connected')
        setConnectedEmail(null)
      }
    }

    window.addEventListener('message', handleMessage)
    const cleanup = checkExtensionStatus()

    return () => {
      window.removeEventListener('message', handleMessage)
      cleanup()
    }
  }, [user, checkExtensionStatus])

  // One-click Connect Extension handler
  const handleConnectExtension = () => {
    if (!token || !user) return
    setConnecting(true)
    setConnectionSuccessMsg(null)

    // Broadcast secure session to extension
    window.postMessage(
      {
        type: 'TALVYN_CONNECT_EXTENSION',
        token,
        user,
      },
      '*'
    )

    // Fallback if extension did not acknowledge
    setTimeout(() => {
      setConnecting(false)
      window.postMessage({ type: 'TALVYN_PING_EXTENSION' }, '*')
    }, 1500)
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
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-600/20 shrink-0">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Talvyn Chrome Extension</h1>
            <p className="text-slate-500 text-sm">
              Save jobs with 1 click, autofill application forms, and track submissions automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={downloadUrl}
            download="talvyn-chrome-extension.zip"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-all shadow-sm shadow-primary-600/20 active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Download Extension</span>
          </a>
        </div>
      </div>

      {/* Success Notification */}
      {connectionSuccessMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{connectionSuccessMsg}</span>
        </div>
      )}

      {/* Extension Connection Status Card */}
      <Card padding="lg" className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Connection Status</span>

              {status === 'checking' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Checking Extension...
                </span>
              )}

              {status === 'connected' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Connected
                </span>
              )}

              {status === 'installed_not_connected' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Extension Installed · Not Connected
                </span>
              )}

              {status === 'not_detected' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Extension Not Detected
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              {status === 'connected' ? (
                <>
                  Active for <span className="text-primary-600">{connectedEmail || user?.email}</span>
                </>
              ) : status === 'installed_not_connected' ? (
                'Extension is ready to connect'
              ) : (
                'Get started with the Talvyn Chrome Extension'
              )}
            </h2>

            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              {status === 'connected'
                ? `The extension is connected to your Talvyn account. Saved jobs and submitted applications from LinkedIn, Indeed, Ashby, and Lever will automatically sync under ${displayName}.`
                : status === 'installed_not_connected'
                ? 'The extension is installed in your browser. Click Connect Extension below to pair it with your logged-in account in one click.'
                : 'Follow the 7 simple steps below to add the extension to your Chrome browser, then connect your account.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {status === 'connected' ? (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className={connecting ? 'animate-spin' : ''} />}
                onClick={handleConnectExtension}
                loading={connecting}
              >
                Reconnect
              </Button>
            ) : status === 'installed_not_connected' ? (
              <Button
                size="md"
                icon={<Sparkles />}
                onClick={handleConnectExtension}
                loading={connecting}
              >
                Connect Extension
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={checkExtensionStatus}
              >
                Check Again
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Feature Highlights */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">What the Extension Does</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Smart Job Scanner</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects listings across career portals, matches requirements against your skills, and computes instant relevance scores.
            </p>
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Universal Autofill</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fills complex application forms in one click using your profile data without overwriting your custom inputs.
            </p>
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Automatic Tracking</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects completed job submissions and automatically records applied status and milestones on your timeline.
            </p>
          </Card>
        </div>
      </div>

      {/* 7-Step Simple User Installation Guide */}
      <Card padding="lg" className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">How to Install (7 Simple Steps)</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Follow these quick instructions to install and start using the extension in Google Chrome.
          </p>
        </div>

        <div className="space-y-5">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Download the extension ZIP</h3>
              <p className="text-xs text-slate-500">
                Click the <strong>Download Extension</strong> button above to download <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px]">talvyn-chrome-extension.zip</code>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Extract the ZIP</h3>
              <p className="text-xs text-slate-500">
                Right-click the downloaded ZIP file and extract or unzip it into a folder on your computer.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Open chrome://extensions</h3>
              <p className="text-xs text-slate-500">
                In your Google Chrome address bar, type <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px]">chrome://extensions</code> and press Enter.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Turn on Developer mode</h3>
              <p className="text-xs text-slate-500">
                Toggle on the <strong>Developer mode</strong> switch in the top-right corner of the Extensions page.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              5
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Click &quot;Load unpacked&quot;</h3>
              <p className="text-xs text-slate-500">
                Click the <strong>Load unpacked</strong> button in the top-left toolbar.
              </p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              6
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Select the extracted extension folder</h3>
              <p className="text-xs text-slate-500">
                Browse to and select the folder you extracted in Step 2.
              </p>
            </div>
          </div>

          {/* Step 7 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              7
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Open Talvyn and connect the extension</h3>
              <p className="text-xs text-slate-500">
                Return to this Talvyn page and click <strong>Connect Extension</strong>. Your account will pair instantly!
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
