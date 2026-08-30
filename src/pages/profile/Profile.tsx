import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Edit2, Save, X, User, Briefcase, GraduationCap, Settings, Camera, Trash2, Loader2 } from 'lucide-react'
import { profileApi } from '../../api/profile'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { TagInput, normalizeTags } from '../../components/ui/TagInput'
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
  languages: z.array(z.string()).default([]),
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
  workStyle: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'ANY']).default('ANY'),
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
          workAuthorization: profile.workAuthorization || '',
          expectedSalary: profile.expectedSalary || '',
          noticePeriod: profile.noticePeriod || '',
          linkedinUrl: profile.linkedinUrl || '',
          githubUrl: profile.githubUrl || '',
          portfolioUrl: profile.portfolioUrl || '',
          experienceYears: profile.experienceYears ?? null,
          graduationYear: profile.graduationYear ?? null,
          preferredRoles: normalizeTags(profile.preferredRoles),
          skills: normalizeTags(profile.skills),
          otherLinks: normalizeTags(profile.otherLinks),
          languages: normalizeTags(profile.languages),
          preferredLocations: normalizeTags(profile.preferredLocations),
          preferredJobTypes: normalizeTags(profile.preferredJobTypes),
          workStyle: profile.workStyle || 'ANY',
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
    const res = await profileApi.uploadAvatar(file)
    setUser({ ...user!, avatarUrl: res.avatarUrl, profile: { ...user?.profile, avatarUrl: res.avatarUrl } as any })
    qc.invalidateQueries({ queryKey: ['profile'] })
  }

  const handleAvatarDelete = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return

    setAvatarUploading(true)
    setAvatarError(null)

    try {
      await profileApi.deleteAvatar()
      setUser({ ...user!, avatarUrl: null })
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

  const displayName = profile?.legalFullName || profile?.givenName || user?.email?.split('@')[0] || 'User'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your personal, professional, and career preferences</p>
        </div>
        {!isEditing ? (
          <Button variant="outline" icon={<Edit2 />} onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" icon={<X />} onClick={handleCancel}>Cancel</Button>
            <Button icon={<Save />} onClick={handleSubmit((d) => mutation.mutate(d))} loading={mutation.isPending}>
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Avatar section */}
      <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-18 h-18 rounded-full object-cover border-2 border-primary-100 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-18 h-18 rounded-full bg-primary-100 flex items-center justify-center shrink-0 border-2 border-primary-50 shadow-sm">
                <span className="text-primary-700 text-2xl font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}

            {/* Avatar Upload Overlay */}
            <div
              onClick={() => setIsCropModalOpen(true)}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            >
              <div className="cursor-pointer p-2 text-white" title="Change / Crop photo">
                {avatarUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{displayName}</h2>
              <button
                type="button"
                onClick={() => setIsCropModalOpen(true)}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                {avatarUploading ? 'Uploading...' : 'Change Photo'}
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={avatarUploading}
                  className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-sm text-slate-500 mt-0.5">{user?.email}</p>

            {avatarError && <p className="text-xs text-red-500 mt-1 font-medium">{avatarError}</p>}

            {profile?.preferredRoles && profile.preferredRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.preferredRoles.slice(0, 3).map((role: string) => (
                  <span key={role} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-0.5 rounded-full font-medium border border-primary-100/60">
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Authentication Provider Badge */}
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Account Auth</span>
          {user?.authProvider === 'GOOGLE' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Signed in with Google
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
              Signed in with Email
            </span>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        {/* Personal */}
        {activeTab === 'personal' && (
          <Card padding="lg" className="space-y-5">
            <h3 className="text-base font-semibold text-slate-900 border-b pb-3 border-slate-100">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Legal Full Name" placeholder="Full legal name" disabled={!isEditing} {...register('legalFullName')} />
              <Input label="Preferred Name" placeholder="Nickname / Preferred Name" disabled={!isEditing} {...register('preferredName')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="First / Given Name" disabled={!isEditing} {...register('givenName')} />
              <Input label="Middle Name" disabled={!isEditing} {...register('middleName')} />
              <Input label="Family / Last Name" disabled={!isEditing} {...register('familyName')} />
            </div>
            <Input label="Prefix / Initial" placeholder="e.g. Dr., Mr., Ms." disabled={!isEditing} {...register('prefix')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" disabled={!isEditing} {...register('email')} error={errors.email?.message} />
              <Input label="Phone" disabled={!isEditing} {...register('phone')} placeholder="+1 555 000 0000" />
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
            <div className="grid grid-cols-3 gap-4">
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
                    className="col-span-2"
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
          <Card padding="lg" className="space-y-5">
            <h3 className="text-base font-semibold text-slate-900 border-b pb-3 border-slate-100">Professional Experience & Skills</h3>
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
            <div className="grid grid-cols-2 gap-4">
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
          <Card padding="lg" className="space-y-5">
            <h3 className="text-base font-semibold text-slate-900 border-b pb-3 border-slate-100">Academic Background</h3>
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <Input label="CGPA / Grade" placeholder="e.g. 3.8/4.0 or 8.5/10" disabled={!isEditing} {...register('cgpa')} />
              <Input label="Graduation Year" type="number" placeholder="2024" disabled={!isEditing} {...register('graduationYear')} />
            </div>
          </Card>
        )}

        {/* Preferences */}
        {activeTab === 'preferences' && (
          <Card padding="lg" className="space-y-5">
            <h3 className="text-base font-semibold text-slate-900 border-b pb-3 border-slate-100">Career & Job Preferences</h3>
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
            <div className="grid grid-cols-2 gap-4">
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
        initialImageUrl={user?.avatarUrl || profile?.avatarUrl || undefined}
      />
    </div>
  )
}
