/// <reference types="vite/client" />
import { useEffect, useState, useRef } from 'react'
import { authApi, AuthResponse } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: string | number
            }
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

/**
 * Validates whether a Google OAuth Client ID string is a validly formatted
 * Google Web Application Client ID and not a placeholder or empty string.
 */
export function isValidGoogleClientId(clientId?: string | null): boolean {
  if (!clientId || typeof clientId !== 'string') return false
  const trimmed = clientId.trim()
  if (!trimmed) return false

  const lower = trimmed.toLowerCase()
  // Reject placeholder values
  if (
    lower.includes('your_google') ||
    lower.includes('your-google') ||
    lower.includes('your_client') ||
    lower.includes('your-client') ||
    lower.includes('xxxxx') ||
    lower.includes('example') ||
    lower === 'your_google_client_id' ||
    lower === 'your_google_client_id.apps.googleusercontent.com' ||
    lower === 'placeholder'
  ) {
    return false
  }

  // Must end with .apps.googleusercontent.com and have valid client ID length
  return trimmed.endsWith('.apps.googleusercontent.com') && trimmed.length > 25
}

interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup'
  onSuccess: (response: AuthResponse) => void
  onError?: (errorMessage: string) => void
  className?: string
}

export function GoogleSignInButton({
  mode = 'signin',
  onSuccess,
  onError,
  className = '',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const setAuth = useAuthStore((s) => s.setAuth)
  const hiddenBtnContainerRef = useRef<HTMLDivElement>(null)

  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  const isConfigured = isValidGoogleClientId(rawClientId)

  useEffect(() => {
    if (!isConfigured) return

    // 1. Dynamically load Google Identity Services script if not already on page
    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script')
      script.id = 'google-gsi-client'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => initGoogleGsi()
      document.body.appendChild(script)
    } else if (window.google?.accounts?.id) {
      initGoogleGsi()
    }

    function initGoogleGsi() {
      if (!window.google?.accounts?.id || !isConfigured) return

      try {
        window.google.accounts.id.initialize({
          client_id: rawClientId,
          callback: handleGoogleCallback,
          cancel_on_tap_outside: true,
        })

        if (hiddenBtnContainerRef.current) {
          window.google.accounts.id.renderButton(hiddenBtnContainerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: mode === 'signup' ? 'signup_with' : 'continue_with',
            shape: 'rectangular',
            width: '100%',
          })
        }
      } catch (err) {
        console.warn('[Talvyn] Failed to initialize Google Sign-In:', err)
      }
    }
  }, [isConfigured, rawClientId, mode])

  const handleGoogleCallback = async (response: { credential: string }) => {
    if (!response.credential) {
      const err = 'Google sign-in was cancelled or failed.'
      setNoticeMessage(err)
      onError?.(err)
      return
    }

    setIsLoading(true)
    setNoticeMessage(null)

    try {
      const authRes = await authApi.googleLogin(response.credential)
      setAuth(authRes.token, authRes.user)
      onSuccess(authRes)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We could not verify your Google account. Please try again.'
      setNoticeMessage(msg)
      onError?.(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomButtonClick = () => {
    if (!isConfigured) {
      const msg =
        'Google Sign-In is not configured yet. Add VITE_GOOGLE_CLIENT_ID to your .env file and restart the development server.'
      setNoticeMessage(msg)
      onError?.(msg)
      return
    }

    // Trigger Google GIS Prompt or click native rendered button
    if (hiddenBtnContainerRef.current) {
      const nativeButton = hiddenBtnContainerRef.current.querySelector(
        'div[role="button"]'
      ) as HTMLElement | null
      if (nativeButton) {
        nativeButton.click()
        return
      }
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden container for native GIS renderer */}
      <div ref={hiddenBtnContainerRef} className="hidden" aria-hidden="true" />

      {/* Styled Talvyn Continue with Google Button */}
      <button
        type="button"
        onClick={handleCustomButtonClick}
        disabled={isLoading}
        title={!isConfigured ? 'Google Sign-In is not configured in .env' : undefined}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg border border-slate-300 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>
          {isLoading
            ? 'Signing in...'
            : mode === 'signup'
            ? 'Sign up with Google'
            : 'Continue with Google'}
        </span>
      </button>

      {noticeMessage && (
        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center flex items-center justify-between gap-2">
          <span>{noticeMessage}</span>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-amber-600 hover:text-amber-900 font-bold px-1"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
