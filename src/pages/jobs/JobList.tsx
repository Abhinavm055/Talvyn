import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Briefcase, ArrowRight, MapPin, Building2 } from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { JobStatus } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Card } from '../../components/ui/Card'
import { timeAgo } from '../../lib/utils'

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Jobs' },
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

export default function JobList() {
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState('ALL')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { status: activeStatus, search }],
    queryFn: () =>
      jobsApi.list({
        status: activeStatus !== 'ALL' ? activeStatus : undefined,
        search: search || undefined,
      }),
  })

  const jobs = data?.jobs || []

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">My Jobs</h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm mt-1">
            {data?.total ?? 0} job{(data?.total ?? 0) !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#737D94]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, or location…"
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent hover:border-[#BFC6D4] dark:hover:border-[#353D50] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <Filter className="w-4 h-4 text-slate-400 dark:text-[#737D94] shrink-0" />
          <span className="text-sm text-slate-500 dark:text-[#A8B0C2] shrink-0">Filter:</span>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {ALL_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setActiveStatus(s.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeStatus === s.value
                ? 'bg-primary-600 dark:bg-[#7C3AED] text-white font-semibold shadow-xs'
                : 'bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] text-slate-600 dark:text-[#A8B0C2] hover:bg-[#F1F3F8] dark:hover:bg-[#151A29] hover:text-slate-900 dark:hover:text-[#F5F7FF]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Job grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-white dark:bg-[#111522] rounded-2xl border border-[#E2E5EC] dark:border-[#252B3A] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card padding="lg" className="text-center py-16">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-[#737D94] mx-auto mb-3" />
          <p className="text-slate-700 dark:text-[#F5F7FF] font-semibold text-base">
            {search || activeStatus !== 'ALL'
              ? 'No jobs match your filters'
              : 'No jobs saved yet'}
          </p>
          <p className="text-slate-400 dark:text-[#737D94] text-xs mt-1 mb-5">
            {search || activeStatus !== 'ALL'
              ? 'Try adjusting your search or filter'
              : 'Add your first job opportunity to get started'}
          </p>
          {!search && activeStatus === 'ALL' && (
            <Button onClick={() => navigate('/jobs/new')} size="sm" icon={<Plus />}>
              Add Your First Job
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`}>
              <Card hover padding="md" className="h-full flex flex-col">
                {/* Top */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#151A29] border border-slate-200/60 dark:border-[#252B3A] flex items-center justify-center shrink-0">
                    <span className="text-slate-600 dark:text-[#A8B0C2] text-sm font-semibold">
                      {job.company.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <StatusBadge status={job.status as JobStatus} />
                </div>

                {/* Title & company */}
                <h3 className="font-semibold text-slate-900 dark:text-[#F5F7FF] text-sm leading-snug mb-1 line-clamp-2">
                  {job.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#A8B0C2] mb-3">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-[#858DA0] dark:text-[#737D94]" />
                  <span>{job.company}</span>
                </div>

                {/* Meta */}
                <div className="mt-auto space-y-1 pt-2 border-t border-[#F1F3F8] dark:border-[#252B3A]/50">
                  {job.location && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#737D94]">
                      <MapPin className="w-3 h-3 text-[#858DA0] dark:text-[#737D94]" />
                      <span>{job.location}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-[#737D94]">{timeAgo(job.createdAt)}</span>
                    {job._count && job._count.notes > 0 && (
                      <span className="text-xs text-slate-400 dark:text-[#737D94]">{job._count.notes} note{job._count.notes !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
