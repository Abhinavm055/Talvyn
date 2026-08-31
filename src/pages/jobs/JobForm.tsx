import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { JobStatus, JobType } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'

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

  const { data: existingJob } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
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

      <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF] mb-8">
        {isEditing ? 'Edit Job' : 'Add Job Manually'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card padding="lg" className="space-y-5">
          {/* Required */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Job Title *"
              placeholder="e.g. Marketing Manager"
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
              placeholder="e.g. New York, NY or Remote"
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
              placeholder="e.g. $70,000/yr or Negotiable"
              {...register('salary')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Job Posting URL"
              type="url"
              placeholder="https://…"
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
            <label className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF]">Job Description</label>
            <textarea
              {...register('description')}
              rows={8}
              placeholder="Paste the job description here…"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94] resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent hover:border-[#BFC6D4] dark:hover:border-[#353D50] transition-colors"
            />
          </div>

          {mutationError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200/70 dark:border-red-800/60 rounded-xl text-sm text-red-600 dark:text-red-300">
              {mutationError.response?.data?.error || 'Something went wrong. Please try again.'}
            </div>
          )}

          <div className="flex items-center gap-3 justify-end pt-2 border-t border-[#E2E5EC] dark:border-[#252B3A]">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditing ? `/jobs/${id}` : '/jobs')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {isEditing ? 'Save Changes' : 'Add Job'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
