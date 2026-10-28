import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Puzzle, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { initializeAuth } from '../../api/initializeAuth'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { extensionBridge, ExtensionAccount, isPairingRequestId } from '../../utils/extensionBridge'

function errorMessage(error: unknown): string {
  const apiError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
  return apiError || (error instanceof Error ? error.message : 'Connection failed. Please retry.')
}

export default function ExtensionConnect() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isInitialized, initializationError, logout } = useAuthStore()
  const requestedId = searchParams.get('requestId') || ''
  const [status, setStatus] = useState<'checking' | 'ready' | 'connecting' | 'success' | 'error'>('checking')
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [connectedAccount, setConnectedAccount] = useState<ExtensionAccount | undefined>()
  const [keepConnected, setKeepConnected] = useState(false)
  const [approveAccountSwitch, setApproveAccountSwitch] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (isInitialized && !initializationError && !isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true })
    }
  }, [isInitialized, initializationError, isAuthenticated, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    let cancelled = false
    setStatus('checking')
    setError('')
    setRequestId('')
    setKeepConnected(false)
    setApproveAccountSwitch(false)
    const prepare = async () => {
      try {
        const installed = await extensionBridge.detect()
        if (!installed.installed || installed.state === 'unavailable' || installed.state === 'reconnecting') throw new Error(installed.message)
        if (cancelled) return
        setConnectedAccount(installed.user)
        if (installed.state === 'connected' && installed.user?.id === user.id) {
          setStatus('success')
          return
        }
        if (requestedId && !isPairingRequestId(requestedId)) throw new Error('This connection link is invalid. Start a new connection.')
        const pending = requestedId
          ? await extensionBridge.verifyPairing(requestedId)
          : await extensionBridge.startConnection()
        // Prove the request belongs to this installed worker before approval.
        await extensionBridge.verifyPairing(pending.requestId)
        const pairing = await authApi.getExtensionPairing(pending.requestId)
        if (pairing.requestId !== pending.requestId || pairing.extensionId !== extensionBridge.extensionId || !Number.isFinite(Date.parse(pairing.expiresAt)) || Date.parse(pairing.expiresAt) <= Date.now()) throw new Error('This connection request is invalid or expired. Start a new connection.')
        if (!cancelled) {
          setRequestId(pairing.requestId)
          setExpiresAt(pairing.expiresAt)
          setStatus('ready')
        }
      } catch (caught) {
        if (!cancelled) { setStatus('error'); setError(errorMessage(caught)) }
      }
    }
    void prepare()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id, requestedId, attempt])

  const switchingAccount = !!connectedAccount && connectedAccount.id !== user?.id
  const handleConnect = async () => {
    if (!user || !requestId || !keepConnected || (switchingAccount && !approveAccountSwitch)) return
    setStatus('connecting')
    setError('')
    try {
      await extensionBridge.verifyPairing(requestId)
      const pairing = await authApi.getExtensionPairing(requestId)
      if (pairing.extensionId !== extensionBridge.extensionId || pairing.requestId !== requestId || !Number.isFinite(Date.parse(pairing.expiresAt)) || Date.parse(pairing.expiresAt) <= Date.now()) throw new Error('Connection request expired. Start a new connection.')
      const currentUser = await authApi.me()
      if (currentUser.id !== user.id) {
        useAuthStore.getState().setAuth(currentUser)
        throw new Error('Your website account changed. Review the updated account and approve again.')
      }
      const approved = await authApi.approveExtensionPairing(requestId, user.id)
      if (!approved.success) throw new Error('The connection could not be approved. Please retry.')
      await extensionBridge.verifyPairing(requestId)
      const connected = await extensionBridge.completeConnection(requestId)
      if (connected.id !== user.id) throw new Error('The extension connected to a different account. Check the extension and retry.')
      setConnectedAccount(connected)
      setStatus('success')
      setSearchParams({}, { replace: true })
    } catch (caught) { setStatus('error'); setError(errorMessage(caught)) }
  }

  const retry = () => {
    setSearchParams({}, { replace: true })
    setAttempt((value) => value + 1)
  }
  const changeAccount = async () => {
    try {
      await authApi.logout()
      logout()
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
    } catch (caught) { setError(errorMessage(caught)); setStatus('error') }
  }

  if (!isInitialized || !user) return (
    <div className="min-h-screen bg-[#F7F8FC] dark:bg-[#080A12] flex items-center justify-center p-4 text-center">
      <div className="space-y-4"><p className="text-sm text-slate-500 dark:text-[#A8B0C2]">{initializationError || 'Verifying your session…'}</p>{initializationError && <Button onClick={() => void initializeAuth()}>Retry</Button>}</div>
    </div>
  )

  const displayName = user.profile?.preferredName || user.profile?.givenName || user.profile?.legalFullName || user.email.split('@')[0]
  return (
    <div className="min-h-screen bg-[#F7F8FC] dark:bg-[#080A12] flex flex-col justify-center items-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="mb-6 text-center"><Link to="/" className="inline-flex items-center gap-2.5"><img src="/logotalvyn.png" alt="Talvyn" className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] p-1" /><span className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">Talvyn</span></Link></div>
      <Card padding="lg" className="max-w-lg w-full bg-white dark:bg-[#111522] border-[#E2E5EC] dark:border-[#252B3A] shadow-modal dark:shadow-modal-dark">
        {status === 'success' ? (
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8" /></div>
            <div className="space-y-2"><h2 className="text-xl font-bold text-slate-900 dark:text-[#F5F7FF]">Extension Connected</h2><p className="text-sm text-slate-600 dark:text-[#A8B0C2] leading-relaxed">Talvyn is connected to <strong>{connectedAccount?.email || user.email}</strong>. You can analyze job pages, save jobs, and review profile autofill. Website logout leaves this independent extension session connected. Use the extension popup to disconnect, or sign out of all devices from your profile.</p></div>
            <Button onClick={() => navigate('/dashboard')} className="w-full">Go to Dashboard</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2"><div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto"><Puzzle className="w-6 h-6" /></div><h2 className="text-xl font-bold text-slate-900 dark:text-[#F5F7FF]">Connect Talvyn Browser Extension</h2><p className="text-sm text-slate-500 dark:text-[#A8B0C2]">Authorize the installed extension to synchronize your saved jobs, profile, and application tracker.</p></div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#151A29] border border-slate-200/80 dark:border-[#252B3A] flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold shrink-0">{user.email.charAt(0).toUpperCase()}</div><div className="min-w-0"><div className="text-sm font-bold text-slate-900 dark:text-[#F5F7FF] truncate">{displayName}</div><div className="text-xs text-slate-500 dark:text-[#A8B0C2] truncate">{user.email}</div></div><button onClick={() => void changeAccount()} disabled={status === 'connecting'} className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 shrink-0">Change account</button></div>
            {status === 'checking' && <p role="status" className="text-sm text-slate-500 dark:text-[#A8B0C2] text-center">Checking the installed extension and connection request…</p>}
            {error && <div role="alert" className="flex items-start gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
            {!extensionBridge.extensionId && <p className="text-xs text-amber-700 dark:text-amber-300">The project owner must configure the trusted extension public key before production account connection is available. Locally loaded development builds use their own configured ID.</p>}
            {switchingAccount && <label className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900 p-3 text-xs text-slate-700 dark:text-slate-300"><input type="checkbox" checked={approveAccountSwitch} onChange={(event) => setApproveAccountSwitch(event.target.checked)} disabled={status === 'connecting'} className="mt-0.5 accent-indigo-600" /><span>Replace the extension's current connection to <strong>{connectedAccount?.email}</strong> with <strong>{user.email}</strong>. The previous extension session will be revoked.</span></label>}
            <label className="flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-3 text-xs text-slate-700 dark:text-slate-300"><input type="checkbox" checked={keepConnected} onChange={(event) => setKeepConnected(event.target.checked)} disabled={status === 'connecting' || status === 'checking'} className="mt-0.5 accent-indigo-600" /><span><strong className="block text-slate-900 dark:text-white">Keep the extension connected when I sign out of this website</strong>This grants an independent session with rotating credentials. Disconnecting the extension or signing out of all devices revokes it.</span></label>
            {expiresAt && status === 'ready' && <p className="text-[11px] text-slate-400 dark:text-[#737D94]">This approval request expires at {new Date(expiresAt).toLocaleTimeString()}.</p>}
            <div className="space-y-3"><Button onClick={() => void handleConnect()} loading={status === 'connecting'} disabled={status !== 'ready' || !keepConnected || (switchingAccount && !approveAccountSwitch)} className="w-full">{status === 'connecting' ? 'Connecting Extension…' : 'Connect and Keep Connected'}</Button>{status === 'error' && <Button onClick={retry} variant="outline" className="w-full">Retry with a new connection request</Button>}{status === 'error' && <Link to="/extensions" className="block text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">Installation and manual update instructions</Link>}<Button variant="outline" onClick={() => navigate('/extensions')} disabled={status === 'connecting'} className="w-full">Cancel</Button></div>
            <div className="pt-3 border-t border-[#E2E5EC] dark:border-[#252B3A] flex justify-center gap-2 text-[11px] text-slate-400 dark:text-[#737D94]"><ShieldCheck className="w-3.5 h-3.5" /><span>Verified browser request • No extension credentials shared with this page</span></div>
          </div>
        )}
      </Card>
    </div>
  )
}
