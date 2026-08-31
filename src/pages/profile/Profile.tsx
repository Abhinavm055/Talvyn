import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Save,
  Upload,
  Pencil,
  Trash2,
  Camera,
  Briefcase,
  GraduationCap,
  Settings,
  CheckCircle2,
  Loader2,
  X,
  Plus,
} from 'lucide-react'
import { profileApi } from '../../api/profile'
import { useAuthStore } from '../../store/authStore'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { TagInput } from '../../components/ui/TagInput'
import { SmartCombobox } from '../../components/ui/SmartCombobox'
import { SmartMultiSelect } from '../../components/ui/SmartMultiSelect'
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
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'professional', label: 'Professional & Skills', icon: Briefcase },
  { id: 'education', label: 'Academic Background', icon: GraduationCap },
  { id: 'preferences', label: 'Career Preferences', icon: Settings },
]

export default function Profile() {
  const [activeTab, setActiveTab] = useState('personal')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
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
          email: profile.email || user?.email || '',
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
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const handleCropSave = async (file: File) => {
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const res = await profileApi.uploadAvatar(file)
      setUser({ ...user!, avatarUrl: res.avatarUrl, profile: { ...user?.profile, avatarUrl: res.avatarUrl } as any })
      qc.invalidateQueries({ queryKey: ['profile'] })
      setIsCropModalOpen(false)
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

  const currentAvatar = user?.avatarUrl || profile?.avatarUrl

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 text-[#11131A] dark:text-[#F5F7FF]">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white dark:bg-[#111522] p-1.5 rounded-2xl border border-[#E2E5EC] dark:border-[#252B3A] shadow-xs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer',
              activeTab === id
                ? 'bg-primary-50 dark:bg-violet-950/50 text-primary-700 dark:text-violet-200 border border-primary-200/60 dark:border-violet-500/30 shadow-xs font-semibold'
                : 'text-[#5E6678] dark:text-[#A8B0C2] hover:text-[#11131A] dark:hover:text-[#F5F7FF] hover:bg-[#F1F3F8] dark:hover:bg-[#151A29]'
            )}
          >
            <Icon className="w-4 h-4 text-primary-600 dark:text-violet-400" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        {/* CARD 1: Profile Information / Active Tab */}
        {activeTab === 'personal' && (
          <div className="bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl p-6 sm:p-8 shadow-card dark:shadow-card-dark space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-violet-950/70 border border-primary-100/60 dark:border-violet-800/40 text-primary-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Profile Information</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
                  Manage your personal information and how it appears across Talvyn.
                </p>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="space-y-5">
              {/* Row 1: Legal Full Name & Preferred Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Input
                  label="Legal Full Name"
                  placeholder="Full legal name"
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('legalFullName')}
                />
                <Input
                  label="Preferred Name"
                  placeholder="Nickname / Preferred Name"
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('preferredName')}
                />
              </div>

              {/* Row 2: First, Middle, Family Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <Input
                  label="First / Given Name"
                  placeholder="First name"
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('givenName')}
                />
                <Input
                  label="Middle Name"
                  placeholder="Middle name"
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('middleName')}
                />
                <Input
                  label="Family / Last Name"
                  placeholder="Family / Last name"
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('familyName')}
                />
              </div>

              {/* Row 3: Prefix / Initial */}
              <div>
                <Input
                  label="Prefix / Initial"
                  placeholder="e.g. Dr., Mr., Ms."
                  icon={<User className="w-4 h-4 text-violet-400" />}
                  {...register('prefix')}
                />
              </div>

              {/* Row 4: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  icon={<Mail className="w-4 h-4 text-violet-400" />}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Phone"
                  placeholder="+1 555 000 0000"
                  icon={<Phone className="w-4 h-4 text-violet-400" />}
                  {...register('phone')}
                />
              </div>

              {/* Row 5: Country & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
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
                      icon={<Globe className="w-4 h-4 text-violet-400" />}
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
                      loadOptions={async (q) => searchStates(q, watchedCountry || undefined)}
                      placeholder="Search state (e.g. Kerala, California)..."
                      icon={<MapPin className="w-4 h-4 text-violet-400" />}
                      allowCustom
                    />
                  )}
                />
              </div>

              {/* Row 6: City & Postal Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Controller
                  control={control}
                  name="city"
                  render={({ field }) => (
                    <SmartCombobox
                      label="City"
                      value={field.value}
                      onChange={field.onChange}
                      loadOptions={async (q) => searchCities(q, watchedCountry || undefined, watchedState || undefined)}
                      placeholder="Search city (e.g. Kochi, Bengaluru)..."
                      icon={<Building2 className="w-4 h-4 text-violet-400" />}
                      allowCustom
                    />
                  )}
                />
                <Input
                  label="Postal Code"
                  placeholder="ZIP / Postal code"
                  icon={<Mail className="w-4 h-4 text-violet-400" />}
                  {...register('postalCode')}
                />
              </div>

              {/* Street Address */}
              <div>
                <Input
                  label="Street Address"
                  placeholder="Street address / Apartment / Suite"
                  icon={<MapPin className="w-4 h-4 text-violet-400" />}
                  {...register('address')}
                />
              </div>
            </div>

            {/* Bottom Actions for Card 1 */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E2E5EC] dark:border-[#252B3A]">
              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    Changes saved successfully
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Professional Tab */}
        {activeTab === 'professional' && (
          <div className="bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl p-6 sm:p-8 shadow-card dark:shadow-card-dark space-y-6">
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-violet-950/70 border border-primary-100/60 dark:border-violet-800/40 text-primary-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Professional Experience & Skills</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
                  Define your core skillsets, domain experience, and portfolio links.
                </p>
              </div>
            </div>

            <div className="space-y-5">
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
              <Input
                label="Years of Experience"
                type="number"
                icon={<Briefcase className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                placeholder="0"
                {...register('experienceYears')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="LinkedIn URL"
                  placeholder="https://linkedin.com/in/username"
                  icon={<Globe className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('linkedinUrl')}
                />
                <Input
                  label="GitHub URL"
                  placeholder="https://github.com/username"
                  icon={<Globe className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('githubUrl')}
                />
              </div>
              <Input
                label="Portfolio / Website URL"
                placeholder="https://yourportfolio.com"
                icon={<Globe className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                {...register('portfolioUrl')}
              />
              <Controller
                control={control}
                name="otherLinks"
                render={({ field }) => (
                  <TagInput label="Other Professional Links" value={field.value} onChange={field.onChange} placeholder="Add URL and press Enter" />
                )}
              />
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-[#E2E5EC] dark:border-[#252B3A]">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Education Tab */}
        {activeTab === 'education' && (
          <div className="bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl p-6 sm:p-8 shadow-card dark:shadow-card-dark space-y-6">
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-violet-950/70 border border-primary-100/60 dark:border-violet-800/40 text-primary-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Academic Background</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
                  Add your university degrees, GPA, and major field of study.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <Controller
                control={control}
                name="institution"
                render={({ field }) => (
                  <SmartCombobox
                    label="Institution / University"
                    value={field.value}
                    onChange={field.onChange}
                    loadOptions={async (q) => institutionSearchService.searchInstitutions(q)}
                    placeholder="Search university or college (e.g. IIT, Stanford)..."
                    icon={<GraduationCap className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
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
                      options={searchDegrees('').map((d) => ({
                        value: d.value,
                        label: d.label,
                        category: d.category,
                      }))}
                      placeholder="Select degree (e.g. B.Tech, MBA, MCA)..."
                      icon={<GraduationCap className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
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
                      options={searchFieldsOfStudy('').map((f) => ({
                        value: f.value,
                        label: f.label,
                        category: f.category,
                      }))}
                      placeholder="Select field of study (e.g. Computer Science)..."
                      icon={<GraduationCap className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                      allowCustom
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="CGPA / Grade"
                  placeholder="e.g. 3.8/4.0 or 8.5/10"
                  icon={<GraduationCap className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('cgpa')}
                />
                <Input
                  label="Graduation Year"
                  type="number"
                  placeholder="2025"
                  icon={<GraduationCap className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('graduationYear')}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-[#E2E5EC] dark:border-[#252B3A]">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl p-6 sm:p-8 shadow-card dark:shadow-card-dark space-y-6">
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-violet-950/70 border border-primary-100/60 dark:border-violet-800/40 text-primary-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Career & Job Preferences</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
                  Configure your salary expectations, notice period, and preferred work models.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <Controller
                control={control}
                name="workAuthorization"
                render={({ field }) => (
                  <SmartCombobox
                    label="Work Authorization"
                    value={field.value}
                    onChange={field.onChange}
                    loadOptions={async (q) => searchWorkAuthorizations(q)}
                    placeholder="Select or enter work authorization status..."
                    icon={<Globe className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                    allowCustom
                  />
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Expected Salary"
                  placeholder="e.g. $80,000/yr or Negotiable"
                  icon={<Settings className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('expectedSalary')}
                />
                <Input
                  label="Notice Period"
                  placeholder="e.g. 2 weeks, Immediate, 1 month"
                  icon={<Settings className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
                  {...register('noticePeriod')}
                />
              </div>
              <Controller
                control={control}
                name="preferredLocations"
                render={({ field }) => (
                  <SmartMultiSelect
                    label="Preferred Locations"
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
                    icon={<Building2 className="w-4 h-4 text-[#858DA0] dark:text-violet-400" />}
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

            <div className="flex items-center justify-end pt-4 border-t border-[#E2E5EC] dark:border-[#252B3A]">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* CARD 2: Profile Photo Card */}
      <div className="bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl p-6 sm:p-8 shadow-card dark:shadow-card-dark space-y-6">
        {/* Header with Upload Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-violet-950/70 border border-primary-100/60 dark:border-violet-800/40 text-primary-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Profile Photo</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
                This photo will be displayed on your profile and across Talvyn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCropModalOpen(true)}
            disabled={avatarUploading}
            className="bg-white dark:bg-[#151A29] hover:bg-slate-50 dark:hover:bg-[#1C2234] border border-[#E2E5EC] dark:border-[#252B3A] text-slate-800 dark:text-[#F5F7FF] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-all duration-150 cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
          >
            {avatarUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-600 dark:text-violet-400" />
            ) : (
              <Upload className="w-4 h-4 text-primary-600 dark:text-violet-400" />
            )}
            <span>Upload New Photo</span>
          </button>
        </div>

        {/* Photo Display & Guidance */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
          {/* Avatar with Violet Edit Button */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-[#E2E5EC] dark:border-[#252B3A] bg-[#F1F3F8] dark:bg-[#151A29] flex items-center justify-center overflow-hidden shadow-md">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-slate-400 dark:text-[#737D94]" />
              )}
            </div>

            {/* Violet Edit Pencil Badge */}
            <button
              type="button"
              onClick={() => setIsCropModalOpen(true)}
              className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-primary-600 dark:bg-[#7C3AED] hover:bg-primary-700 dark:hover:bg-violet-500 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110"
              title="Crop / Change Photo"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Guidelines & Meta */}
          <div className="border-l border-[#E2E5EC] dark:border-[#252B3A] pl-5 sm:pl-6 py-1 space-y-1 text-left">
            <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F5F7FF] font-medium">
              Recommended: Square image (1:1)
            </p>
            <p className="text-xs text-slate-500 dark:text-[#A8B0C2]">
              Minimum 200x200px • JPG, PNG upto 5MB
            </p>
            {avatarError && <p className="text-xs text-red-500 dark:text-red-400 font-medium pt-1">{avatarError}</p>}
            {currentAvatar && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={avatarUploading}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove photo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
