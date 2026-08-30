import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle } from 'lucide-react'
import { profileApi } from '../../api/profile'
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
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  // Guard: If existing user already completed onboarding, redirect directly to dashboard
  useEffect(() => {
    if (user?.profile?.onboardingCompleted === true) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
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
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => navigate('/dashboard')

  return (
    <div className="min-h-screen bg-surface-50 flex items-start justify-center pt-12 px-4 pb-16">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="text-lg font-bold text-slate-900">Talvyn</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Set up your profile</h1>
          <p className="text-slate-500 text-sm">Complete your profile to get the most out of Talvyn. You can edit it anytime.</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                  i < step && 'bg-primary-600 text-white',
                  i === step && 'bg-primary-600 text-white ring-4 ring-primary-100',
                  i > step && 'bg-white border-2 border-slate-200 text-slate-400'
                )}
              >
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn('text-xs font-medium', i === step ? 'text-primary-700' : 'text-slate-400')}>{s}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8">

            {/* Step 0: Personal */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-6">Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Legal Full Name" placeholder="Full legal name" {...register('legalFullName')} />
                  <Input label="Preferred Name" placeholder="What do people call you?" {...register('preferredName')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Given / First Name" placeholder="First name" {...register('givenName')} />
                  <Input label="Middle Name" placeholder="Optional" {...register('middleName')} />
                  <Input label="Family / Last Name" placeholder="Last name" {...register('familyName')} />
                </div>
                <Input label="Prefix / Initial" placeholder="e.g. Dr., Mr., Ms." {...register('prefix')} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Email Address" type="email" placeholder="your@email.com" {...register('email')} error={errors.email?.message} />
                  <Input label="Phone Number" type="tel" placeholder="+1 555 000 0000" {...register('phone')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-3 gap-4">
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
                        className="col-span-2"
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
                <h2 className="text-lg font-semibold text-slate-900 mb-6">Professional Information</h2>
                <Controller
                  control={control}
                  name="preferredRoles"
                  render={({ field }) => (
                    <SmartMultiSelect
                      label="Preferred Roles"
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
                  )}
                />
                <Controller
                  control={control}
                  name="skills"
                  render={({ field }) => (
                    <SmartMultiSelect
                      label="Skills & Technologies"
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
                <Input
                  label="Years of Experience"
                  type="number"
                  placeholder="0"
                  {...register('experienceYears')}
                  hint="Total years of professional experience"
                />
                <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/yourname" {...register('linkedinUrl')} />
                <Input label="Portfolio / Website URL" placeholder="https://yourportfolio.com" {...register('portfolioUrl')} />
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
                <h2 className="text-lg font-semibold text-slate-900 mb-6">Education Details</h2>
                
                <Controller
                  control={control}
                  name="institution"
                  render={({ field }) => (
                    <SmartCombobox
                      label="University / College"
                      value={field.value}
                      onChange={field.onChange}
                      loadOptions={async (q) => institutionSearchService.searchInstitutions(q)}
                      placeholder="Search university or college name (e.g. MG University, IIT, Anna University)..."
                      allowCustom
                    />
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    control={control}
                    name="degree"
                    render={({ field }) => (
                      <SmartCombobox
                        label="Degree"
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
                    )}
                  />

                  <Controller
                    control={control}
                    name="specialization"
                    render={({ field }) => (
                      <SmartCombobox
                        label="Field of Study / Specialization"
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
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="CGPA / Grade" placeholder="e.g. 3.8 / 4.0 or 8.5 / 10" {...register('cgpa')} />
                  <Input label="Graduation Year" type="number" placeholder="2024" {...register('graduationYear')} />
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-6">Application Preferences</h2>
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
                <div className="grid grid-cols-2 gap-4">
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <div>
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Step {step + 1} of {STEPS.length}</span>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => setStep(step + 1)}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={saving}>
                  Complete Profile
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
