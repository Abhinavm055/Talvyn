import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileText,
  PenTool,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { jobsApi, ExtractedJobData } from '../../api/jobs'
import { JobStatus, JobType } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/utils'

const schema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company name is required'),
  jobUrl: z.string().optional(),
  sourceWebsite: z.string().optional(),
  location: z.string().optional(),
  jobType: z.string().optional(),
  salary: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  dateApplied: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'Select type…' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default function JobForm() {
  const { id } = useParams<{ id?: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  // For new jobs: tab selection between 'paste' and 'manual'
  const [entryMode, setEntryMode] = useState<'paste' | 'manual'>('paste')
  const [jdText, setJdText] = useState('')
  const [jdUrl, setJdUrl] = useState('')
  const [isAnalyzingJD, setIsAnalyzingJD] = useState(false)
  const [jdError, setJdError] = useState<string | null>(null)
  const [isAutofilled, setIsAutofilled] = useState(false)
  const [extractedDetails, setExtractedDetails] = useState<ExtractedJobData | null>(null)

  const { data: existingJob } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'SAVED' },
  })

  useEffect(() => {
    if (existingJob) {
      reset({
        title: existingJob.title,
        company: existingJob.company,
        jobUrl: existingJob.jobUrl || '',
        sourceWebsite: existingJob.sourceWebsite || '',
        location: existingJob.location || '',
        jobType: existingJob.jobType || '',
        salary: existingJob.salary || '',
        description: existingJob.description || '',
        status: existingJob.status,
        dateApplied: existingJob.dateApplied
          ? new Date(existingJob.dateApplied).toISOString().split('T')[0]
          : '',
      })
      setEntryMode('manual')
    }
  }, [existingJob, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      jobsApi.create({
        ...data,
        jobType: (data.jobType as JobType) || undefined,
        status: (data.status as JobStatus) || 'SAVED',
        dateApplied: data.dateApplied ? new Date(data.dateApplied).toISOString() : null,
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/jobs/${job.id}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      jobsApi.update(id!, {
        ...data,
        jobType: (data.jobType as JobType) || undefined,
        status: (data.status as JobStatus) || 'SAVED',
        dateApplied: data.dateApplied ? new Date(data.dateApplied).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/jobs/${id}`)
    },
  })

  const handleAnalyzeJD = async () => {
    const trimmed = jdText.trim()
    if (!trimmed) {
      setJdError('Please paste the job description text first.')
      return
    }

    if (trimmed.length < 15) {
      setJdError('Job description text is too short. Please paste the full listing details.')
      return
    }

    setJdError(null)
    setIsAnalyzingJD(true)

    try {
      const response = await jobsApi.extractJD(trimmed, jdUrl.trim() || undefined)
      const data = response.extractedJob

      setExtractedDetails(data)

      // Autofill existing Add Job form
      if (data.title) setValue('title', data.title)
      if (data.company) setValue('company', data.company)
      if (data.location) setValue('location', data.location)
      if (data.jobType) setValue('jobType', data.jobType)
      if (data.salary) setValue('salary', data.salary)
      if (data.jobUrl) setValue('jobUrl', data.jobUrl)
      if (data.sourceWebsite) setValue('sourceWebsite', data.sourceWebsite)
      if (data.description) setValue('description', data.description)

      setIsAutofilled(true)
      // Switch view to the populated Add Job form
      setEntryMode('manual')
    } catch (err: any) {
      console.error('JD analysis error:', err)
      setJdError(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to analyze job description. You can still fill the fields manually.'
      )
    } finally {
      setIsAnalyzingJD(false)
    }
  }

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const mutation = isEditing ? updateMutation : createMutation
  const mutationError = mutation.error as { response?: { data?: { error?: string } } } | null

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link
        to={isEditing ? `/jobs/${id}` : '/jobs'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-[#A8B0C2] hover:text-slate-800 dark:hover:text-[#F5F7FF] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isEditing ? 'Back to Job' : 'My Jobs'}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">
            {isEditing ? 'Edit Job' : 'Add Job'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2] mt-0.5">
            {isEditing
              ? 'Update opportunity details in your pipeline'
              : 'Add a new opportunity via job description autofill or enter details manually.'}
          </p>
        </div>

        {/* Mode Selector Toggle (for new job creation) */}
        {!isEditing && (
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#151A29] rounded-xl border border-slate-200 dark:border-[#252B3A] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setEntryMode('paste')}
              className={cn(
                'py-1.5 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5',
                entryMode === 'paste'
                  ? 'bg-white dark:bg-[#111522] text-primary-600 dark:text-violet-400 shadow-sm border border-slate-200/60 dark:border-[#252B3A]'
                  : 'text-slate-600 dark:text-[#A8B0C2] hover:text-slate-900 dark:hover:text-[#F5F7FF]'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Job Description</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className={cn(
                'py-1.5 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5',
                entryMode === 'manual'
                  ? 'bg-white dark:bg-[#111522] text-primary-600 dark:text-violet-400 shadow-sm border border-slate-200/60 dark:border-[#252B3A]'
                  : 'text-slate-600 dark:text-[#A8B0C2] hover:text-slate-900 dark:hover:text-[#F5F7FF]'
              )}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Add Manually</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── OPTION 1: PASTE JD FLOW ─── */}
      {!isEditing && entryMode === 'paste' && (
        <Card padding="lg" className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary-500 dark:text-violet-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FF]">
                Paste Job Description
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2]">
              Paste the text from any job listing (LinkedIn, Indeed, company careers page). Talvyn will extract the job title, company, location, type, salary, requirements, and responsibilities to populate the form.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">
              Job Description Text *
            </label>
            <textarea
              value={jdText}
              onChange={(e) => {
                setJdText(e.target.value)
                if (jdError) setJdError(null)
              }}
              rows={9}
              placeholder={`Paste the job description here...\n\ne.g.\nSoftware Engineer at ABC Technologies\nLocation: Bangalore (Hybrid)\nExperience: 2+ years\nRequirements:\n- Strong knowledge of React, TypeScript, and Node.js\n- Experience building RESTful APIs and databases...`}
              className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-300 dark:border-[#252B3A] bg-white dark:bg-[#111522] text-slate-900 dark:text-[#F5F7FF] placeholder:text-slate-400 dark:placeholder-[#737D94] resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent transition-colors font-mono text-xs sm:text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#F5F7FF]">
              Job Posting URL <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="https://company.com/careers/job-123"
              type="url"
            />
          </div>

          {jdError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs sm:text-sm text-red-600 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{jdError}</div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#252B3A]">
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0C2] hover:text-slate-800 dark:hover:text-[#F5F7FF] underline"
            >
              Skip and enter everything manually →
            </button>

            <Button
              type="button"
              variant="primary"
              loading={isAnalyzingJD}
              onClick={handleAnalyzeJD}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {isAnalyzingJD ? 'Analyzing Job Description...' : 'Analyze Job Description'}
            </Button>
          </div>
        </Card>
      )}

      {/* ─── OPTION 2: NORMAL ADD JOB FORM (OR POPULATED POST-ANALYSIS) ─── */}
      {(isEditing || entryMode === 'manual') && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Information Banner if Autofilled from JD */}
          {isAutofilled && (
            <div className="p-4 rounded-2xl bg-primary-50/70 dark:bg-[#151A29] border border-primary-100 dark:border-[#252B3A] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-violet-950/60 text-primary-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF] flex items-center gap-2">
                    <span>Autofilled from Job Description</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-600 dark:text-violet-300">
                      Extracted
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#A8B0C2] mt-0.5">
                    We've populated the form fields below from your pasted text. Review and freely edit any details before saving.
                  </div>

                  {/* Display extracted skills badges if present */}
                  {extractedDetails?.skills && extractedDetails.skills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mr-1">
                        Detected Skills:
                      </span>
                      {extractedDetails.skills.slice(0, 8).map((s) => (
                        <span
                          key={s}
                          className="text-[10.5px] px-2 py-0.5 rounded-md bg-white dark:bg-[#111522] border border-slate-200 dark:border-[#252B3A] text-slate-700 dark:text-slate-300 font-medium"
                        >
                          {s}
                        </span>
                      ))}
                      {extractedDetails.skills.length > 8 && (
                        <span className="text-[10.5px] text-slate-400 dark:text-[#737D94]">
                          +{extractedDetails.skills.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEntryMode('paste')
                  setIsAutofilled(false)
                }}
              >
                Re-paste JD
              </Button>
            </div>
          )}

          <Card padding="lg" className="space-y-5">
            {/* Required Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Job Title *"
                placeholder="e.g. Software Engineer"
                {...register('title')}
                error={errors.title?.message}
              />
              <Input
                label="Company Name *"
                placeholder="e.g. Acme Corp"
                {...register('company')}
                error={errors.company?.message}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Location"
                placeholder="e.g. Bengaluru, Bangalore, Remote, or Hybrid"
                {...register('location')}
              />
              <Select
                label="Job Type"
                options={JOB_TYPE_OPTIONS}
                {...register('jobType')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Application Status"
                options={STATUS_OPTIONS}
                {...register('status')}
              />
              <Input
                label="Salary / Compensation"
                placeholder="e.g. $120,000 - $140,000 or 15–20 LPA"
                {...register('salary')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Job Posting URL"
                type="url"
                placeholder="https://company.com/jobs/..."
                {...register('jobUrl')}
              />
              <Input
                label="Source Website"
                placeholder="e.g. LinkedIn, Indeed, Company Site"
                {...register('sourceWebsite')}
              />
            </div>

            <Input
              label="Date Applied"
              type="date"
              {...register('dateApplied')}
              hint="Leave blank if you haven't applied yet"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-900 dark:text-[#F5F7FF]">
                Job Description
              </label>
              <textarea
                {...register('description')}
                rows={8}
                placeholder="Paste or review the job description, responsibilities, and requirements here…"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#252B3A] bg-white dark:bg-[#111522] text-slate-900 dark:text-[#F5F7FF] placeholder:text-slate-400 dark:placeholder-[#737D94] resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent transition-colors"
              />
            </div>

            {mutationError && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200/70 dark:border-red-800/60 rounded-xl text-sm text-red-600 dark:text-red-300">
                {mutationError.response?.data?.error || 'Something went wrong. Please try again.'}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end pt-3 border-t border-slate-200 dark:border-[#252B3A]">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEditing ? `/jobs/${id}` : '/jobs')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || mutation.isPending}>
                {isEditing ? 'Save Changes' : 'Save Job'}
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}
