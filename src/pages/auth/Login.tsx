import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const rawRedirect = searchParams.get('redirect') || searchParams.get('returnTo')
  let redirectParam = rawRedirect
  if (redirectParam) {
    try {
      if (redirectParam.startsWith('%2F') || redirectParam.startsWith('%2f')) {
        redirectParam = decodeURIComponent(redirectParam)
      }
    } catch {}
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const handlePostLoginRedirect = (user: { profile?: { onboardingCompleted?: boolean } | null }) => {
    if (redirectParam && redirectParam.startsWith('/')) {
      navigate(redirectParam)
      return
    }
    if (user.profile?.onboardingCompleted === true) {
      navigate('/dashboard')
    } else {
      navigate('/onboarding')
    }
  }

  const onSubmit = async (data: FormData) => {
    setError('')
    try {
      const result = await authApi.login(data)
      setAuth(result.token, result.user)
      handlePostLoginRedirect(result.user)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || 'Invalid email or password.')
    }
  }

  const handleGoogleSuccess = (result: { user: { profile?: { onboardingCompleted?: boolean } | null } }) => {
    handlePostLoginRedirect(result.user)
  }

  return (
    <div className="dark min-h-screen bg-[#06070D] text-[#F3F4F8] font-sans antialiased selection:bg-[#5054EA]/40 selection:text-white flex relative overflow-x-hidden">
      {/* ─── LEFT SHOWCASE PANEL (Desktop) ─── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 lg:p-16 relative border-r border-white/[0.08] overflow-hidden bg-[#06070D]">
        {/* Ambient Cosmic Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] bg-[radial-gradient(ellipse_at_center,rgba(80,84,234,0.18),transparent_70%)] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.12),transparent_70%)] blur-[90px] pointer-events-none" />

        {/* Brand Logo Header */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none relative z-10 w-fit">
          <img
            src="/logo-talvyn.png"
            alt="Talvyn"
            className="w-9 h-9 object-contain drop-shadow-[0_0_16px_rgba(80,84,234,0.45)] transition-transform duration-200 group-hover:scale-105"
          />
          <span className="text-2xl font-bold tracking-tight text-white group-hover:text-slate-200 transition-colors">
            Talvyn
          </span>
        </Link>

        {/* Hero Content */}
        <div className="relative z-10 max-w-lg my-auto py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8B8DF8] mb-4">
            WELCOME BACK
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4 tracking-tight">
            Your career search,<br />
            <span className="text-[#8B8DF8]">accelerated.</span>
          </h2>
          <p className="text-slate-400 text-base lg:text-lg leading-relaxed">
            Pick up right where you left off. Track applications, calculate readiness, and move closer to your next offer.
          </p>
        </div>

        <div className="relative z-10" />
      </div>

      {/* ─── RIGHT AUTH FORM PANEL ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10 bg-[#06070D]">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(80,84,234,0.12),transparent_70%)] blur-[90px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Back to Home Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>

          {/* Mobile Brand Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <img
              src="/logo-talvyn.png"
              alt="Talvyn"
              className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(80,84,234,0.45)]"
            />
            <span className="text-xl font-bold text-white">Talvyn</span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
              Sign in to Talvyn
            </h1>
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-[#8B8DF8] hover:text-[#A5A7FC] font-medium transition-colors"
              >
                Sign up free
              </Link>
            </p>
          </div>

          {/* Google Sign-In */}
          <div className="mb-6">
            <GoogleSignInButton
              mode="signin"
              onSuccess={handleGoogleSuccess}
              onError={(err) => setError(err)}
            />

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-[#06070D] px-3 text-slate-500 font-medium">
                  Or continue with email
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className="w-full h-11 px-3.5 text-sm rounded-xl border border-white/[0.1] bg-[#0C0D1A] text-white placeholder:text-slate-500 hover:border-white/[0.2] focus:border-[#5054EA] focus:outline-none focus:ring-2 focus:ring-[#5054EA]/25 transition-all"
              />
              {errors.email?.message && (
                <p className="text-xs text-red-400 mt-0.5">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  {...register('password')}
                  className="w-full h-11 pl-3.5 pr-10 text-sm rounded-xl border border-white/[0.1] bg-[#0C0D1A] text-white placeholder:text-slate-500 hover:border-white/[0.2] focus:border-[#5054EA] focus:outline-none focus:ring-2 focus:ring-[#5054EA]/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password?.message && (
                <p className="text-xs text-red-400 mt-0.5">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#5054EA] hover:bg-[#4347D4] text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(80,84,234,0.35)] hover:shadow-[0_0_26px_rgba(80,84,234,0.55)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
