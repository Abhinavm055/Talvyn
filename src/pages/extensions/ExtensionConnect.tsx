import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Puzzle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export default function ExtensionConnect() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuthStore()

  // Dynamic extension ID passed from extension popup or detected
  const queryExtId = searchParams.get('extId') || searchParams.get('extensionId') || ''
  const [extensionId, setExtensionId] = useState<string>(queryExtId)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (queryExtId) {
      setExtensionId(queryExtId)
    }
  }, [queryExtId])

  // If not logged in, automatically redirect to login with return path
  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      const returnUrl = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${returnUrl}`, { replace: true })
    }
  }, [isAuthenticated, token, user, location, navigate])

  // Auto-initiate connection when authenticated and extensionId is present
  useEffect(() => {
    if (isAuthenticated && token && user && extensionId && status === 'idle') {
      handleConnect()
    }
  }, [isAuthenticated, token, user, extensionId, status])

  if (!isAuthenticated || !token || !user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Redirecting to sign in...
          </p>
        </div>
      </div>
    )
  }

  const handleConnect = () => {
    setStatus('connecting')
    setErrorMessage('')

    if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime || !(window as any).chrome.runtime.sendMessage) {
      setStatus('error')
      setErrorMessage(
        'Chromium runtime messaging is not available in this browser window. Please ensure you are using Google Chrome, Brave, Edge, or a Chromium-based browser.'
      )
      return
    }

    if (!extensionId) {
      setStatus('error')
      setErrorMessage(
        'Talvyn Browser Extension not detected. Please open the Talvyn Browser Extension from your browser toolbar and click "Connect your Talvyn account".'
      )
      return
    }

    try {
      (window as any).chrome.runtime.sendMessage(
        extensionId,
        {
          type: 'TALVYN_CONNECT_EXTENSION',
          token,
          user,
        },
        (response: any) => {
          const lastError = (window as any).chrome.runtime.lastError
          if (lastError) {
            console.error('[Talvyn Connect] Chrome runtime error:', lastError)
            setStatus('error')
            setErrorMessage(
              'Talvyn Browser Extension not detected. Please make sure the extension is installed and enabled, then try again.'
            )
            return
          }

          if (response && response.success) {
            setStatus('success')
          } else {
            setStatus('error')
            setErrorMessage(response?.error || 'Failed to connect extension. Please try again.')
          }
        }
      )
    } catch (err: any) {
      console.error('[Talvyn Connect] Exception during connection:', err)
      setStatus('error')
      setErrorMessage(err?.message || 'An unexpected error occurred while connecting.')
    }
  }


  const handleCloseTab = () => {
    try {
      window.close()
    } catch {
      navigate('/dashboard')
    }
  }

  const displayName =
    user.profile?.preferredName ||
    user.profile?.givenName ||
    user.profile?.legalFullName ||
    user.email.split('@')[0]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col justify-center items-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <img
            src="/logotalvyn.png"
            alt="Talvyn Logo"
            className="w-10 h-10 rounded-xl object-contain shadow-xs bg-white dark:bg-slate-800 p-1"
          />
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Talvyn
          </span>
        </Link>
      </div>

      {/* Main Connection Card */}
      <Card padding="lg" className="max-w-lg w-full bg-white dark:bg-[#11121A] border-slate-200 dark:border-slate-800 shadow-md">
        {status === 'success' ? (
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Extension Connected!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your Talvyn Browser Extension is now connected to{' '}
                <strong className="text-slate-900 dark:text-slate-200 font-semibold">{user.email}</strong>.
                You can save jobs and autofill applications directly from any website.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Session stored securely in your browser extension storage.</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleCloseTab} className="flex-1">
                Close This Tab
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Title & Description */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs">
                <Puzzle className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Connect Talvyn Browser Extension
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                Authorize the Talvyn Browser Extension to synchronize saved jobs, profile data, and track applications with your account.
              </p>
            </div>

            {/* Current Account Profile Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold shrink-0 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Signed In
              </div>
            </div>

            {/* Error notice if any */}
            {status === 'error' && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
                <p className="text-[11px] text-red-600 dark:text-red-400/90 pl-6">
                  Tip: Make sure you opened this page from the installed Talvyn Browser Extension popup.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleConnect}
                loading={status === 'connecting'}
                disabled={status === 'connecting'}
                className="w-full py-3 text-sm font-semibold shadow-sm"
              >
                {status === 'connecting' ? 'Connecting Extension…' : 'Connect Extension'}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={status === 'connecting'}
                className="w-full text-slate-600 dark:text-slate-300"
              >
                Cancel
              </Button>
            </div>

            {/* Footer Trust Badge */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Manifest V3 • Direct Secure Messaging</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
