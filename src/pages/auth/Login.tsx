import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

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

  const redirectParam = searchParams.get('redirect') || searchParams.get('returnTo')

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
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logotalvyn.png" alt="Talvyn" className="w-8 h-8 rounded-xl object-contain shadow-xs bg-white/10 p-0.5" />
          <span className="text-xl font-bold text-white">Talvyn</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Welcome back.<br />Your search continues.
          </h2>
          <p className="text-slate-400 text-lg">
            Pick up right where you left off. Your jobs, applications, and notes are waiting.
          </p>
        </div>
        <p className="text-slate-600 text-sm">From Potential to Offer.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in to Talvyn</h1>
            <p className="text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-600 font-medium hover:underline">
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
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-50 px-3 text-slate-400 font-medium tracking-wider">
                  Or continue with email
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                {...register('password')}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
