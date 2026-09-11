import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CheckCircle,
  UploadCloud,
  FileText,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileCheck,
} from 'lucide-react'
import { profileApi } from '../../api/profile'
import { resumesApi, ResumeUploadExtractResponse } from '../../api/resumes'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { TagInput, normalizeTags } from '../../components/ui/TagInput'
import { SmartCombobox } from '../../components/ui/SmartCombobox'
import { SmartMultiSelect } from '../../components/ui/SmartMultiSelect'
import { searchCountries } from '../../data/countries'
import { searchStates } from '../../data/states'
import { searchCities } from '../../data/cities'
import { searchWorkAuthorizations } from '../../data/workAuthorization'
import { searchDegrees } from '../../data/degrees'
import { searchFieldsOfStudy } from '../../data/fieldsOfStudy'
import { searchSkills } from '../../data/skills'
import { searchRoles } from '../../data/roles'
import { searchJobTypes } from '../../data/jobTypes'
import { searchLanguages } from '../../data/languages'
import { institutionSearchService } from '../../services/institutionSearch'
import { locationSearchService } from '../../services/locationSearch'
import { cn } from '../../lib/utils'

const STEPS = ['Personal', 'Professional', 'Education', 'Preferences']

const schema = z.object({
  // Personal
  legalFullName: z.string().optional(),
  givenName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  prefix: z.string().optional(),
  preferredName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  // Professional
  preferredRoles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  experienceYears: z.coerce.number().int().min(0).optional().nullable(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  otherLinks: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  // Education
  institution: z.string().optional(),
  degree: z.string().optional(),
  specialization: z.string().optional(),
  cgpa: z.string().optional(),
  graduationYear: z.coerce.number().int().optional().nullable(),
  // Application Prefs
  workAuthorization: z.string().optional(),
  expectedSalary: z.string().optional(),
  noticePeriod: z.string().optional(),
  preferredLocations: z.array(z.string()).default([]),
  preferredJobTypes: z.array(z.string()).default([]),
  workStyle: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'ANY']).default('ANY'),
})

type FormData = z.infer<typeof schema>

export default function Onboarding() {
  const [onboardingStage, setOnboardingStage] = useState<'upload' | 'form'>('upload')
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [extractedFields, setExtractedFields] = useState<string[]>([])
  const [uploadedResume, setUploadedResume] = useState<{ id?: string; name: string; size?: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  // Guard: If existing user already completed onboarding, redirect directly to dashboard
  useEffect(() => {
    if (user?.profile?.onboardingCompleted === true) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      givenName: user?.profile?.givenName || '',
      email: user?.email || '',
      country: user?.profile?.country || '',
      state: user?.profile?.state || '',
      city: user?.profile?.city || '',
      address: user?.profile?.address || '',
      postalCode: user?.profile?.postalCode || '',
      preferredRoles: normalizeTags(user?.profile?.preferredRoles),
      skills: normalizeTags(user?.profile?.skills),
      experienceYears: user?.profile?.experienceYears || null,
      linkedinUrl: user?.profile?.linkedinUrl || '',
      githubUrl: user?.profile?.githubUrl || '',
      portfolioUrl: user?.profile?.portfolioUrl || '',
      otherLinks: normalizeTags(user?.profile?.otherLinks),
      languages: normalizeTags(user?.profile?.languages),
      institution: user?.profile?.institution || '',
      degree: user?.profile?.degree || '',
      specialization: user?.profile?.specialization || '',
      workAuthorization: user?.profile?.workAuthorization || '',
      preferredLocations: normalizeTags(user?.profile?.preferredLocations),
      preferredJobTypes: normalizeTags(user?.profile?.preferredJobTypes),
      workStyle: user?.profile?.workStyle || 'ANY',
    },
  })

  const watchedCountry = watch('country')
  const watchedState = watch('state')

  const handleResumeFileSelected = async (file: File) => {
    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10 MB limit.')
      return
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      setUploadError('Invalid format. Only PDF, DOC, and DOCX files are allowed.')
      return
    }

    setUploadError(null)
    setIsAnalyzing(true)

    try {
      const response: ResumeUploadExtractResponse = await resumesApi.uploadAndExtract(file)
      const data = response.extracted

      // Pre-fill form fields with extracted data
      if (data.legalFullName) setValue('legalFullName', data.legalFullName)
      if (data.givenName) setValue('givenName', data.givenName)
      if (data.middleName) setValue('middleName', data.middleName)
      if (data.familyName) setValue('familyName', data.familyName)
      if (data.preferredName) setValue('preferredName', data.preferredName)
      if (data.email) setValue('email', data.email)
      if (data.phone) setValue('phone', data.phone)
      if (data.city) setValue('city', data.city)
      if (data.state) setValue('state', data.state)
      if (data.country) setValue('country', data.country)
      if (data.postalCode) setValue('postalCode', data.postalCode)
      if (data.skills && data.skills.length > 0) setValue('skills', data.skills)
      if (data.preferredRoles && data.preferredRoles.length > 0) setValue('preferredRoles', data.preferredRoles)
      if (data.languages && data.languages.length > 0) setValue('languages', data.languages)
      if (data.experienceYears !== null && data.experienceYears !== undefined) {
        setValue('experienceYears', data.experienceYears)
      }
      if (data.linkedinUrl) setValue('linkedinUrl', data.linkedinUrl)
      if (data.githubUrl) setValue('githubUrl', data.githubUrl)
      if (data.portfolioUrl) setValue('portfolioUrl', data.portfolioUrl)
      if (data.otherLinks && data.otherLinks.length > 0) setValue('otherLinks', data.otherLinks)
      if (data.institution) setValue('institution', data.institution)
      if (data.degree) setValue('degree', data.degree)
      if (data.specialization) setValue('specialization', data.specialization)
      if (data.cgpa) setValue('cgpa', data.cgpa)
      if (data.graduationYear) setValue('graduationYear', data.graduationYear)

      setExtractedFields(response.extractedFields || [])
      setUploadedResume({
        id: response.resume?.id,
        name: file.name,
        size: file.size,
      })
      setIsReviewMode(true)
      setOnboardingStage('form')
      setStep(0)
    } catch (err: any) {
      console.error('Resume extraction error:', err)
      const msg = err?.response?.data?.error || err?.message || 'Failed to analyze resume file.'
      setUploadError(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleResumeFileSelected(file)
    }
  }

  const handleRemoveResume = () => {
    setUploadedResume(null)
    setIsReviewMode(false)
    setExtractedFields([])
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const updatedProfile = await profileApi.update({
        ...data,
        onboardingCompleted: true,
      })
      setUser({ ...user!, profile: updatedProfile })
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to complete profile onboarding:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => navigate('/dashboard')

  const isFieldExtracted = (fieldName: string) => isReviewMode && extractedFields.includes(fieldName)

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-[#080A12] flex items-start justify-center pt-10 px-4 pb-16">
      <div className="w-full max-w-2xl">
        {/* Talvyn Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(80,84,234,0.35)]">
              <span className="text-white text-base font-bold">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7FF]">Talvyn</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7FF] mb-2">
            {onboardingStage === 'upload'
              ? 'Step 1 — Upload Resume'
              : isReviewMode
              ? 'Review your information'
              : 'Set up your profile'}
          </h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm max-w-md mx-auto">
            {onboardingStage === 'upload'
              ? 'Upload your resume to automatically extract your experience and skills. You can review and edit everything before saving.'
              : isReviewMode
              ? "We've pre-filled your profile with details extracted from your resume. Verify, adjust, or fill in any missing fields."
              : 'Complete your profile to get the most out of Talvyn. You can edit it anytime.'}
          </p>
        </div>

        {/* ─── STAGE 1: RESUME UPLOAD FIRST ─── */}
        {onboardingStage === 'upload' && (
          <div className="bg-white dark:bg-[#111522] rounded-2xl border border-slate-200 dark:border-[#252B3A] shadow-card dark:shadow-card-dark p-6 sm:p-10 transition-all">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleResumeFileSelected(f)
              }}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isAnalyzing && fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200',
                isDragOver
                  ? 'border-primary-500 bg-primary-500/5 dark:border-[#7C3AED] dark:bg-violet-950/20 scale-[1.01]'
                  : 'border-slate-300 dark:border-[#252B3A] hover:border-primary-500/70 dark:hover:border-[#7C3AED]/70 bg-slate-50/50 dark:bg-[#151A29]/40',
                isAnalyzing && 'pointer-events-none opacity-80'
              )}
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary-500 dark:text-violet-400 animate-spin" />
                    <Sparkles className="w-5 h-5 text-primary-400 dark:text-violet-300 absolute" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]">
                      Analyzing your resume...
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#A8B0C2]">
                      Extracting work experience, education, skills, and links
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-violet-950/50 text-primary-600 dark:text-violet-400 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(80,84,234,0.2)]">
                    <UploadCloud className="w-7 h-7 stroke-[1.8]" />
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#F5F7FF] mb-1">
                    Drag and drop your resume here
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#A8B0C2] mb-5 max-w-sm">
                    Supports <span className="font-semibold text-slate-700 dark:text-slate-300">PDF, DOC, DOCX</span> (up to 10 MB)
                  </p>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="shadow-sm pointer-events-none"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Browse Resume File
                  </Button>
                </>
              )}
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-xs sm:text-sm text-red-700 dark:text-red-300">
                  <div className="font-semibold mb-0.5">Resume extraction issue</div>
                  <div>{uploadError}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-red-600 dark:text-red-300 underline hover:no-underline"
                    >
                      Try another file
                    </button>
                    <span className="text-slate-300 dark:text-[#353D50]">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadError(null)
                        setOnboardingStage('form')
                        setIsReviewMode(false)
                      }}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 underline hover:no-underline"
                    >
                      Fill profile manually
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback to Manual Profile Entry */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-[#252B3A] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <span className="text-xs text-slate-400 dark:text-[#737D94]">
                Don't have a resume handy?
              </span>
              <button
                type="button"
                onClick={() => {
                  setOnboardingStage('form')
                  setIsReviewMode(false)
                }}
                className="text-xs sm:text-sm font-semibold text-primary-600 dark:text-violet-400 hover:text-primary-700 dark:hover:text-violet-300 inline-flex items-center gap-1 transition-colors"
              >
                <span>Skip and fill profile manually</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STAGE 2: FORM / REVIEW FLOW ─── */}
        {onboardingStage === 'form' && (
          <div>
            {/* Hidden Input for Replace Resume file */}
            <input
              ref={replaceFileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleResumeFileSelected(f)
              }}
            />

            {/* Extracted Resume Banner */}
            {isReviewMode && uploadedResume && (
              <div className="mb-6 p-4 rounded-2xl bg-primary-50/70 dark:bg-[#151A29] border border-primary-100 dark:border-[#252B3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-violet-950/60 text-primary-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F5F7FF] truncate">
                        {uploadedResume.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                        Analyzed
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#A8B0C2]">
                      Fields highlighted below with <Sparkles className="w-3 h-3 inline text-primary-500" /> were pre-filled from your resume.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => replaceFileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={handleRemoveResume}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between mb-8 px-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                      i < step && 'bg-primary-600 text-white',
                      i === step && 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-violet-950/60',
                      i > step && 'bg-white dark:bg-[#151A29] border-2 border-slate-200 dark:border-[#252B3A] text-slate-400 dark:text-[#737D94]'
                    )}
                  >
                    {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={cn('text-xs font-medium', i === step ? 'text-primary-700 dark:text-violet-400' : 'text-slate-400 dark:text-[#737D94]')}>{s}</span>
                </div>
              ))}
            </div>

            {/* Form Container */}
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="bg-white dark:bg-[#111522] rounded-2xl border border-slate-200 dark:border-[#252B3A] shadow-card dark:shadow-card-dark p-6 sm:p-8">

                {/* Step 0: Personal */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FF]">Personal Information</h2>
                      {isReviewMode && (
                        <span className="text-xs text-slate-400 dark:text-[#737D94]">Review & verify your details</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Legal Full Name</label>
                          {isFieldExtracted('legalFullName') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                              <Sparkles className="w-2.5 h-2.5" /> Extracted
                            </span>
                          ) : isReviewMode ? (
                            <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                          ) : null}
                        </div>
                        <Input placeholder="Full legal name" {...register('legalFullName')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Preferred Name</label>
                        </div>
                        <Input placeholder="What do people call you?" {...register('preferredName')} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Given / First Name</label>
                          {isFieldExtracted('givenName') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="First name" {...register('givenName')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Middle Name</label>
                        </div>
                        <Input placeholder="Optional" {...register('middleName')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Family / Last Name</label>
                          {isFieldExtracted('familyName') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="Last name" {...register('familyName')} />
                      </div>
                    </div>

                    <Input label="Prefix / Initial" placeholder="e.g. Dr., Mr., Ms." {...register('prefix')} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Email Address</label>
                          {isFieldExtracted('email') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                              <Sparkles className="w-2.5 h-2.5" /> Extracted
                            </span>
                          ) : isReviewMode ? (
                            <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                          ) : null}
                        </div>
                        <Input type="email" placeholder="your@email.com" {...register('email')} error={errors.email?.message} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Phone Number</label>
                          {isFieldExtracted('phone') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                              <Sparkles className="w-2.5 h-2.5" /> Extracted
                            </span>
                          ) : isReviewMode ? (
                            <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                          ) : null}
                        </div>
                        <Input type="tel" placeholder="+1 555 000 0000" {...register('phone')} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Controller
                        control={control}
                        name="country"
                        render={({ field }) => (
                          <SmartCombobox
                            label="Country"
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) => searchCountries(q)}
                            placeholder="Search country (e.g. India, United States)..."
                            allowCustom
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="state"
                        render={({ field }) => (
                          <SmartCombobox
                            label="State / Province"
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) => searchStates(q, watchedCountry)}
                            placeholder="Search state (e.g. Kerala, California)..."
                            allowCustom
                          />
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Controller
                        control={control}
                        name="city"
                        render={({ field }) => (
                          <SmartCombobox
                            label="City"
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) => searchCities(q, watchedCountry, watchedState)}
                            placeholder="Search city (e.g. Kochi, Bengaluru)..."
                            allowCustom
                            className="col-span-1 sm:col-span-2"
                          />
                        )}
                      />
                      <Input label="Postal Code" placeholder="ZIP / Postal" {...register('postalCode')} />
                    </div>

                    <Input label="Street Address" placeholder="123 Main St, Apt 4" {...register('address')} />
                  </div>
                )}

                {/* Step 1: Professional */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FF]">Professional Information</h2>
                      {isFieldExtracted('skills') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                          <Sparkles className="w-3 h-3" /> Extracted skills & roles
                        </span>
                      )}
                    </div>

                    <Controller
                      control={control}
                      name="preferredRoles"
                      render={({ field }) => (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Preferred Roles</label>
                            {isFieldExtracted('preferredRoles') ? (
                              <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted from resume</span>
                            ) : isReviewMode ? (
                              <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                            ) : null}
                          </div>
                          <SmartMultiSelect
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) =>
                              searchRoles(q).map((r) => ({
                                value: r.title,
                                label: r.title,
                                category: r.domain,
                              }))
                            }
                            placeholder="Search roles (e.g. Backend Developer, Data Analyst)..."
                          />
                        </div>
                      )}
                    />

                    <Controller
                      control={control}
                      name="skills"
                      render={({ field }) => (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Skills & Technologies</label>
                            {isFieldExtracted('skills') ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                                <Sparkles className="w-2.5 h-2.5" /> Extracted ({field.value.length} skills)
                              </span>
                            ) : isReviewMode ? (
                              <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                            ) : null}
                          </div>
                          <SmartMultiSelect
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) =>
                              searchSkills(q).map((s) => ({
                                value: s.name,
                                label: s.name,
                                category: s.category,
                              }))
                            }
                            placeholder="Search skills (e.g. React, Python, Docker)..."
                          />
                        </div>
                      )}
                    />

                    <Controller
                      control={control}
                      name="languages"
                      render={({ field }) => (
                        <SmartMultiSelect
                          label="Languages Known"
                          value={field.value}
                          onChange={field.onChange}
                          loadOptions={async (q) =>
                            searchLanguages(q).map((l) => ({
                              value: l.name,
                              label: l.name,
                              category: l.category,
                            }))
                          }
                          placeholder="Search languages (e.g. English, Malayalam, Hindi)..."
                        />
                      )}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Years of Experience</label>
                        {isFieldExtracted('experienceYears') && (
                          <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted from resume</span>
                        )}
                      </div>
                      <Input
                        type="number"
                        placeholder="0"
                        {...register('experienceYears')}
                        hint="Total years of professional experience"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">LinkedIn URL</label>
                          {isFieldExtracted('linkedinUrl') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="https://linkedin.com/in/yourname" {...register('linkedinUrl')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">GitHub URL</label>
                          {isFieldExtracted('githubUrl') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="https://github.com/yourusername" {...register('githubUrl')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Portfolio / Website</label>
                          {isFieldExtracted('portfolioUrl') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="https://yourportfolio.com" {...register('portfolioUrl')} />
                      </div>
                    </div>

                    <Controller
                      control={control}
                      name="otherLinks"
                      render={({ field }) => (
                        <TagInput
                          label="Other Professional Links"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Add URLs (GitHub, Dribbble, etc.)"
                        />
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Education */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FF]">Education Details</h2>
                      {isFieldExtracted('education') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300">
                          <Sparkles className="w-3 h-3" /> Extracted from resume
                        </span>
                      )}
                    </div>

                    <Controller
                      control={control}
                      name="institution"
                      render={({ field }) => (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">University / College</label>
                            {isFieldExtracted('institution') ? (
                              <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                            ) : isReviewMode ? (
                              <span className="text-[10px] text-slate-400 dark:text-[#737D94]">Not found in resume</span>
                            ) : null}
                          </div>
                          <SmartCombobox
                            value={field.value}
                            onChange={field.onChange}
                            loadOptions={async (q) => institutionSearchService.searchInstitutions(q)}
                            placeholder="Search university or college name (e.g. MG University, IIT, Anna University)..."
                            allowCustom
                          />
                        </div>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Controller
                        control={control}
                        name="degree"
                        render={({ field }) => (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Degree</label>
                              {isFieldExtracted('degree') && (
                                <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                              )}
                            </div>
                            <SmartCombobox
                              value={field.value}
                              onChange={field.onChange}
                              options={searchDegrees('').map((d) => ({
                                value: d.value,
                                label: d.label,
                                category: d.category,
                              }))}
                              placeholder="Select degree (e.g. B.Tech, MBA, MCA)..."
                              allowCustom
                            />
                          </div>
                        )}
                      />

                      <Controller
                        control={control}
                        name="specialization"
                        render={({ field }) => (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Field of Study</label>
                              {isFieldExtracted('specialization') && (
                                <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                              )}
                            </div>
                            <SmartCombobox
                              value={field.value}
                              onChange={field.onChange}
                              options={searchFieldsOfStudy('').map((f) => ({
                                value: f.value,
                                label: f.label,
                                category: f.category,
                              }))}
                              placeholder="e.g. Computer Science, Artificial Intelligence..."
                              allowCustom
                            />
                          </div>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">CGPA / Grade</label>
                          {isFieldExtracted('cgpa') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input placeholder="e.g. 3.8 / 4.0 or 8.5 / 10" {...register('cgpa')} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">Graduation Year</label>
                          {isFieldExtracted('graduationYear') && (
                            <span className="text-[10px] text-primary-600 dark:text-violet-400 font-medium">Extracted</span>
                          )}
                        </div>
                        <Input type="number" placeholder="2024" {...register('graduationYear')} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Preferences */}
                {step === 3 && (
                  <div className="space-y-5">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FF] mb-4">Application Preferences</h2>

                    <Controller
                      control={control}
                      name="workAuthorization"
                      render={({ field }) => (
                        <SmartCombobox
                          label="Work Authorization"
                          value={field.value}
                          onChange={field.onChange}
                          loadOptions={async (q) => searchWorkAuthorizations(q)}
                          placeholder="Select or enter work authorization status (e.g. Citizen, H1-B, PR)..."
                          allowCustom
                        />
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Expected Salary" placeholder="e.g. $80,000/year or Negotiable" {...register('expectedSalary')} />
                      <Input label="Notice Period" placeholder="e.g. 2 weeks, 1 month, Immediate" {...register('noticePeriod')} />
                    </div>

                    <Controller
                      control={control}
                      name="preferredLocations"
                      render={({ field }) => (
                        <SmartMultiSelect
                          label="Preferred Job Locations"
                          value={field.value}
                          onChange={field.onChange}
                          loadOptions={async (q) => locationSearchService.searchLocations(q)}
                          placeholder="Search locations (e.g. Bengaluru, Remote, Kochi)..."
                        />
                      )}
                    />

                    <Controller
                      control={control}
                      name="preferredJobTypes"
                      render={({ field }) => (
                        <SmartMultiSelect
                          label="Preferred Job Types"
                          value={field.value}
                          onChange={field.onChange}
                          options={searchJobTypes('').map((jt) => ({
                            value: jt.value,
                            label: jt.label,
                            sublabel: jt.description,
                          }))}
                          placeholder="Select job types (Full Time, Internship, Contract)..."
                        />
                      )}
                    />

                    <Controller
                      control={control}
                      name="workStyle"
                      render={({ field }) => (
                        <Select
                          label="Work Style Preference"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={[
                            { value: 'ANY', label: 'Open to All' },
                            { value: 'REMOTE', label: 'Remote' },
                            { value: 'HYBRID', label: 'Hybrid' },
                            { value: 'ONSITE', label: 'On-site' },
                          ]}
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Stepper Navigation Actions */}
              <div className="flex items-center justify-between mt-6">
                <div>
                  {step > 0 ? (
                    <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOnboardingStage('upload')}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Upload Resume
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm text-slate-400 dark:text-[#737D94]">
                    Step {step + 1} of {STEPS.length}
                  </span>
                  {step < STEPS.length - 1 ? (
                    <Button type="button" onClick={() => setStep(step + 1)}>
                      Continue
                    </Button>
                  ) : (
                    <Button type="submit" loading={saving} icon={<CheckCircle className="w-4 h-4" />}>
                      {isReviewMode ? 'Save & Continue to Talvyn' : 'Complete Profile'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
