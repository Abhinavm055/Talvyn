import { useCallback, useEffect, useRef, useState } from 'react'
import { extensionBridge, ExtensionStatus } from '../utils/extensionBridge'

export function useExtensionStatus() {
  const [status, setStatus] = useState<ExtensionStatus>({ state: 'checking', installed: false, message: 'Checking Talvyn in this browser…' })
  const [checking, setChecking] = useState(false)
  const requestSequence = useRef(0)
  const check = useCallback(async () => {
    const sequence = ++requestSequence.current
    setChecking(true)
    const result = await extensionBridge.detect()
    if (sequence !== requestSequence.current) return
    setStatus(result)
    setChecking(false)
  }, [])
  useEffect(() => {
    void check()
    const onFocus = () => { void check() }
    window.addEventListener('focus', onFocus)
    return () => { requestSequence.current++; window.removeEventListener('focus', onFocus) }
  }, [check])
  return { status, checking, retry: check }
}
