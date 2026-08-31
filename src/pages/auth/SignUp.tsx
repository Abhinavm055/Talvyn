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
  givenName: z.string().min(1, 'Please enter your first name'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function SignUp() {
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

  const handlePostSignUpRedirect = (user: { profile?: { onboardingCompleted?: boolean } | null }) => {
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
      const result = await authApi.register({
        email: data.email,
        password: data.password,
        givenName: data.givenName,
      })
      setAuth(result.token, result.user)
      handlePostSignUpRedirect(result.user)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || 'Registration failed. Please try again.')
    }
  }

  const handleGoogleSuccess = (result: { user: { profile?: { onboardingCompleted?: boolean } | null } }) => {
    handlePostSignUpRedirect(result.user)
  }


  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logotalvyn.png" alt="Talvyn" className="w-8 h-8 rounded-xl object-contain shadow-xs bg-white/20 p-0.5" />
          <span className="text-xl font-bold text-white">Talvyn</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Start your journey<br />to your next role.
          </h2>
          <p className="text-primary-100 text-lg">
            From Potential to Offer — manage every step of your job search in one place.
          </p>
        </div>
        <div className="flex gap-8">
          {[
            { label: 'Jobs Tracked', value: '50,000+' },
            { label: 'Offers Landed', value: '3,200+' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-primary-200 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Google Sign-Up */}
          <div className="mb-6">
            <GoogleSignInButton
              mode="signup"
              onSuccess={handleGoogleSuccess}
              onError={(err) => setError(err)}
            />

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-50 px-3 text-slate-400 font-medium tracking-wider">
                  Or register with email
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="First / Given Name"
              placeholder="What should we call you?"
              {...register('givenName')}
              error={errors.givenName?.message}
            />
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
                placeholder="Min. 8 characters"
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
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Create Account
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
