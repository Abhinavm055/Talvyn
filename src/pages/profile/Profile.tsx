import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Save,
  X,
  User,
  Briefcase,
  GraduationCap,
  Settings,
  Camera,
  Crop,
  Trash2,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { profileApi } from '../../api/profile'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { TagInput } from '../../components/ui/TagInput'
import { SmartCombobox } from '../../components/ui/SmartCombobox'
import { SmartMultiSelect } from '../../components/ui/SmartMultiSelect'
import { Card } from '../../components/ui/Card'
import { PhotoCropModal } from '../../components/profile/PhotoCropModal'
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
import { UserProfile } from '../../types'

const schema = z.object({
  legalFullName: z.string().nullable().optional(),
  givenName: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  familyName: z.string().nullable().optional(),
  prefix: z.string().nullable().optional(),
  preferredName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  preferredRoles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  experienceYears: z.coerce.number().int().min(0).nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  portfolioUrl: z.string().nullable().optional(),
  otherLinks: z.array(z.string()).default([]),
  institution: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  specialization: z.string().nullable().optional(),
  cgpa: z.string().nullable().optional(),
  graduationYear: z.coerce.number().int().nullable().optional(),
  workAuthorization: z.string().nullable().optional(),
  expectedSalary: z.string().nullable().optional(),
  noticePeriod: z.string().nullable().optional(),
  preferredLocations: z.array(z.string()).default([]),
  preferredJobTypes: z.array(z.string()).default([]),
  workStyle: z.string().default('ANY'),
  languages: z.array(z.string()).default([]),
})

type FormData = z.infer<typeof schema>

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'professional', label: 'Professional', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'preferences', label: 'Preferences', icon: Settings },
]

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  })

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: profile
      ? {
          legalFullName: profile.legalFullName || '',
          givenName: profile.givenName || '',
          middleName: profile.middleName || '',
          familyName: profile.familyName || '',
          prefix: profile.prefix || '',
          preferredName: profile.preferredName || '',
          email: profile.email || '',
          phone: profile.phone || '',
          country: profile.country || '',
          state: profile.state || '',
          city: profile.city || '',
          address: profile.address || '',
          postalCode: profile.postalCode || '',
          institution: profile.institution || '',
          degree: profile.degree || '',
          specialization: profile.specialization || '',
          cgpa: profile.cgpa || '',
          graduationYear: profile.graduationYear || undefined,
          preferredRoles: profile.preferredRoles || [],
          skills: profile.skills || [],
          experienceYears: profile.experienceYears || undefined,
          linkedinUrl: profile.linkedinUrl || '',
          githubUrl: profile.githubUrl || '',
          portfolioUrl: profile.portfolioUrl || '',
          otherLinks: profile.otherLinks || [],
          workAuthorization: profile.workAuthorization || '',
          expectedSalary: profile.expectedSalary || '',
          noticePeriod: profile.noticePeriod || '',
          preferredLocations: profile.preferredLocations || [],
          preferredJobTypes: profile.preferredJobTypes || [],
          workStyle: profile.workStyle || 'ANY',
          languages: profile.languages || [],
        }
      : undefined,
  })

  const watchedCountry = watch('country')
  const watchedState = watch('state')

  const mutation = useMutation({
    mutationFn: (data: FormData) => profileApi.update(data as unknown as Partial<UserProfile>),
    onSuccess: (updatedProfile) => {
      qc.setQueryData(['profile'], updatedProfile)
      setUser({ ...user!, profile: updatedProfile })
      setIsEditing(false)
    },
  })

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image size exceeds 5 MB limit')
      return
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type.toLowerCase())) {
      setAvatarError('Supported image formats: PNG, JPG, JPEG, WEBP')
      return
    }

    setAvatarUploading(true)
    setAvatarError(null)

    try {
      const res = await profileApi.uploadAvatar(file)
      setUser({ ...user!, avatarUrl: res.avatarUrl, profile: { ...user?.profile, avatarUrl: res.avatarUrl } as any })
      qc.invalidateQueries({ queryKey: ['profile'] })
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || 'Failed to upload photo')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCropSave = async (file: File) => {
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const res = await profileApi.uploadAvatar(file)
      setUser({ ...user!, avatarUrl: res.avatarUrl, profile: { ...user?.profile, avatarUrl: res.avatarUrl } as any })
      qc.invalidateQueries({ queryKey: ['profile'] })
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || 'Failed to upload photo')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleAvatarDelete = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return

    setAvatarUploading(true)
    setAvatarError(null)

    try {
      await profileApi.deleteAvatar()
      setUser({ ...user!, avatarUrl: null, profile: { ...user?.profile, avatarUrl: null } as any })
      qc.invalidateQueries({ queryKey: ['profile'] })
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || 'Failed to remove photo')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
  }

  const displayName =
    profile?.legalFullName ||
    profile?.givenName ||
    profile?.preferredName ||
    user?.email?.split('@')[0] ||
    'User'

  const currentAvatar = user?.avatarUrl || profile?.avatarUrl

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">My Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Manage your personal background, professional experience, and career preferences.
          </p>
        </div>
        {!isEditing ? (
          <Button variant="outline" icon={<Edit2 className="w-4 h-4" />} onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" icon={<X className="w-4 h-4" />} onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              icon={<Save className="w-4 h-4" />}
              onClick={handleSubmit((d) => mutation.mutate(d))}
              loading={mutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Profile Photo & Identity Card */}
      <Card padding="lg" className="border-slate-200/90 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Avatar + Info */}
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 dark:from-primary-950 dark:to-indigo-950 flex items-center justify-center ring-2 ring-primary-200 dark:ring-primary-900 shadow-sm">
                  <span className="text-primary-700 dark:text-primary-300 text-2xl font-bold uppercase">
                    {displayName.charAt(0)}
                  </span>
                </div>
              )}

              {/* Camera Hover Overlay */}
              <div
                onClick={() => setIsCropModalOpen(true)}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                title="Change / Crop photo"
              >
                {avatarUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  {displayName}
                </h2>
                {profile?.onboardingCompleted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Profile Complete
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user?.email}</p>

              {avatarError && <p className="text-xs text-red-500 font-medium">{avatarError}</p>}

              {profile?.preferredRoles && profile.preferredRoles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.preferredRoles.slice(0, 3).map((role: string) => (
                    <span
                      key={role}
                      className="text-[11px] bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-md font-medium border border-primary-100/60 dark:border-primary-900/60"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Photo Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              icon={<Crop className="w-3.5 h-3.5" />}
              onClick={() => setIsCropModalOpen(true)}
              disabled={avatarUploading}
            >
              {currentAvatar ? 'Crop / Change Photo' : 'Upload Photo'}
            </Button>

            {currentAvatar && (
              <button
                type="button"
                onClick={handleAvatarDelete}
                disabled={avatarUploading}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 flex-wrap gap-2">
          <span>Square 1:1 image recommended (PNG, JPG, WEBP up to 5 MB).</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Synchronized across all extensions and devices
          </span>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit border border-slate-200/60 dark:border-slate-700/60">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        {/* Personal */}
        {activeTab === 'personal' && (
          <Card padding="lg" className="space-y-5 border-slate-200/90 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Legal Full Name" placeholder="Full legal name" disabled={!isEditing} {...register('legalFullName')} />
              <Input label="Preferred Name" placeholder="Nickname / Preferred Name" disabled={!isEditing} {...register('preferredName')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="First / Given Name" disabled={!isEditing} {...register('givenName')} />
              <Input label="Middle Name" disabled={!isEditing} {...register('middleName')} />
              <Input label="Family / Last Name" disabled={!isEditing} {...register('familyName')} />
            </div>
            <Input label="Prefix / Initial" placeholder="e.g. Dr., Mr., Ms." disabled={!isEditing} {...register('prefix')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" disabled={!isEditing} {...register('email')} error={errors.email?.message} />
              <Input label="Phone" disabled={!isEditing} {...register('phone')} placeholder="+1 555 000 0000" />
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
                    loadOptions={async (q) => searchStates(q, watchedCountry || undefined)}
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
                    disabled={!isEditing}
                    loadOptions={async (q) => searchCities(q, watchedCountry || undefined, watchedState || undefined)}
                    placeholder="Search city (e.g. Kochi, Bengaluru)..."
                    allowCustom
                    className="sm:col-span-2"
                  />
                )}
              />
              <Input label="Postal Code" disabled={!isEditing} {...register('postalCode')} placeholder="ZIP / Postal code" />
            </div>
            <Input label="Street Address" disabled={!isEditing} {...register('address')} placeholder="Street address" />
          </Card>
        )}

        {/* Professional */}
        {activeTab === 'professional' && (
          <Card padding="lg" className="space-y-5 border-slate-200/90 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
              Professional Experience & Skills
            </h3>
            <Controller
              control={control}
              name="preferredRoles"
              render={({ field }) => (
                <SmartMultiSelect
                  label="Preferred Roles"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!isEditing}
                  loadOptions={async (q) =>
                    searchRoles(q).map((r) => ({
                      value: r.title,
                      label: r.title,
                      category: r.domain,
                    }))
                  }
                  placeholder="Search and select roles (e.g. Software Engineer, Product Manager)..."
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
                  disabled={!isEditing}
                  loadOptions={async (q) =>
                    searchSkills(q).map((s) => ({
                      value: s.name,
                      label: s.name,
                      category: s.category,
                    }))
                  }
                  placeholder="Search and select skills (e.g. React, Python, PostgreSQL)..."
                />
              )}
            />
            <Controller
              control={control}
              name="languages"
              render={({ field }) => (
                <SmartMultiSelect
                  label="Languages"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!isEditing}
                  loadOptions={async (q) =>
                    searchLanguages(q).map((l) => ({
                      value: l.name,
                      label: l.nativeName ? `${l.name} (${l.nativeName})` : l.name,
                      category: l.category,
                    }))
                  }
                  placeholder="Search and select languages (e.g. English, Malayalam, Hindi)..."
                />
              )}
            />
            <Input label="Years of Experience" type="number" disabled={!isEditing} {...register('experienceYears')} placeholder="0" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="LinkedIn URL" disabled={!isEditing} {...register('linkedinUrl')} placeholder="https://linkedin.com/in/username" />
              <Input label="GitHub URL" disabled={!isEditing} {...register('githubUrl')} placeholder="https://github.com/username" />
            </div>
            <Input label="Portfolio / Website URL" disabled={!isEditing} {...register('portfolioUrl')} placeholder="https://yourportfolio.com" />
            <Controller
              control={control}
              name="otherLinks"
              render={({ field }) => (
                <TagInput label="Other Professional Links" value={field.value} onChange={field.onChange} placeholder="Add URL and press Enter" />
              )}
            />
          </Card>
        )}

        {/* Education */}
        {activeTab === 'education' && (
          <Card padding="lg" className="space-y-5 border-slate-200/90 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
              Academic Background
            </h3>
            <Controller
              control={control}
              name="institution"
              render={({ field }) => (
                <SmartCombobox
                  label="Institution / University"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!isEditing}
                  loadOptions={async (q) => institutionSearchService.searchInstitutions(q)}
                  placeholder="Search university or college (e.g. MG University, IIT, Anna University)..."
                  allowCustom
                />
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller
                control={control}
                name="degree"
                render={({ field }) => (
                  <SmartCombobox
                    label="Degree"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!isEditing}
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
                    label="Field of Study / Major"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!isEditing}
                    options={searchFieldsOfStudy('').map((f) => ({
                      value: f.value,
                      label: f.label,
                      category: f.category,
                    }))}
                    placeholder="Select field of study (e.g. Computer Science, Finance)..."
                    allowCustom
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="CGPA / Grade" placeholder="e.g. 3.8/4.0 or 8.5/10" disabled={!isEditing} {...register('cgpa')} />
              <Input label="Graduation Year" type="number" placeholder="2024" disabled={!isEditing} {...register('graduationYear')} />
            </div>
          </Card>
        )}

        {/* Preferences */}
        {activeTab === 'preferences' && (
          <Card padding="lg" className="space-y-5 border-slate-200/90 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
              Career & Job Preferences
            </h3>
            <Controller
              control={control}
              name="workAuthorization"
              render={({ field }) => (
                <SmartCombobox
                  label="Work Authorization"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!isEditing}
                  loadOptions={async (q) => searchWorkAuthorizations(q)}
                  placeholder="Select or enter work authorization status (e.g. Citizen, H1-B, PR)..."
                  allowCustom
                />
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Expected Salary" placeholder="e.g. $80,000/yr or Negotiable" disabled={!isEditing} {...register('expectedSalary')} />
              <Input label="Notice Period" placeholder="e.g. 2 weeks, Immediate, 1 month" disabled={!isEditing} {...register('noticePeriod')} />
            </div>
            <Controller
              control={control}
              name="preferredLocations"
              render={({ field }) => (
                <SmartMultiSelect
                  label="Preferred Locations"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!isEditing}
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
                  disabled={!isEditing}
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
                  disabled={!isEditing}
                  options={[
                    { value: 'ANY', label: 'Open to All' },
                    { value: 'REMOTE', label: 'Remote' },
                    { value: 'HYBRID', label: 'Hybrid' },
                    { value: 'ONSITE', label: 'On-site' },
                  ]}
                />
              )}
            />
          </Card>
        )}
      </form>

      {/* Photo Crop Modal */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        onSave={handleCropSave}
        initialImageUrl={currentAvatar || undefined}
      />
    </div>
  )
}
