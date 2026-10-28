import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Briefcase, MapPin, Building2 } from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { JobStatus } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Card } from '../../components/ui/Card'
import { timeAgo } from '../../lib/utils'
import { SavedSearches } from '../../components/jobs/SavedSearches'
import { useAuthStore } from '../../store/authStore'
import { DEFAULT_JOB_SEARCH_FILTERS, JOB_SEARCH_TYPES, filtersToJobQuery } from '../../../server/contracts/jobSearch'
import type { JobSearchFilters } from '../../../server/contracts/jobSearch'

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Jobs' },
  { value: 'SAVED', label: 'Saved' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'IN_PROGRESS', label: 'In progress' },
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
  const userId = useAuthStore((state) => state.user?.id)
  const sessionRevision = useAuthStore((state) => state.sessionRevision)
  return <JobListContent key={`${userId}:${sessionRevision}`} userId={userId} sessionRevision={sessionRevision} />
}

function JobListContent({ userId, sessionRevision }: { userId?: string; sessionRevision: number }) {
  const [filters, setFilters] = useState<JobSearchFilters>({ ...DEFAULT_JOB_SEARCH_FILTERS })
  const [page, setPage] = useState(1)
  const search = filters.search
  const activeStatus = filters.status
  const filtered = Object.keys(filtersToJobQuery(filters)).length > 0
  const changeFilters = (next: JobSearchFilters) => { setFilters(next); setPage(1) }
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs', userId, sessionRevision, filtersToJobQuery(filters), page],
    queryFn: ({ signal }) => jobsApi.list({ ...filtersToJobQuery(filters), page, limit: 50 }, signal),
    enabled: Boolean(userId),
  })

  const jobs = data?.jobs || []
  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / 50))) setPage(Math.max(1, Math.ceil(data.total / 50)))
  }, [data?.total, page])

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">My Jobs</h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm mt-1">
            {isError ? 'Unable to load your jobs' : data ? `${data.total} saved job${data.total !== 1 ? 's' : ''}${filtered ? ' match your filters' : ''}` : 'Loading your saved jobs…'}
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
            onChange={(e) => changeFilters({ ...filters, search: e.target.value })}
            aria-label="Search saved jobs"
            maxLength={200}
            placeholder="Search by title, company, or location…"
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent hover:border-[#BFC6D4] dark:hover:border-[#353D50] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <Filter className="w-4 h-4 text-slate-400 dark:text-[#737D94] shrink-0" />
          <span className="text-sm text-slate-500 dark:text-[#A8B0C2] shrink-0">Filter:</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Input label="Company" id="job-filter-company" value={filters.company} maxLength={120} onChange={(event) => changeFilters({ ...filters, company: event.target.value })} placeholder="Any company" />
        <Input label="Location" id="job-filter-location" value={filters.location} maxLength={120} onChange={(event) => changeFilters({ ...filters, location: event.target.value })} placeholder="Any location" />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-900 dark:text-[#F5F7FF]">Job type
          <select aria-label="Job type" value={filters.jobType} onChange={(event) => changeFilters({ ...filters, jobType: event.target.value as JobSearchFilters['jobType'] })} className="h-11 rounded-xl border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] px-3 text-sm dark:text-[#F5F7FF]">
            {JOB_SEARCH_TYPES.map((type) => <option key={type} value={type}>{type === 'ALL' ? 'Any job type' : type.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
        </label>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {ALL_STATUSES.map((s) => (
          <button
            key={s.value}
            aria-pressed={activeStatus === s.value}
            onClick={() => changeFilters({ ...filters, status: s.value as JobSearchFilters['status'] })}
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

      {filtered ? <Button type="button" variant="ghost" size="sm" className="mb-4" onClick={() => changeFilters({ ...DEFAULT_JOB_SEARCH_FILTERS })}>Clear filters</Button> : null}
      <SavedSearches filters={filters} onApply={changeFilters} />

      {/* Job grid */}
      {isError ? <Card padding="md"><p role="alert" className="text-sm text-red-600 dark:text-red-300">Your jobs could not be loaded.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry jobs</Button></Card> : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-white dark:bg-[#111522] rounded-2xl border border-[#E2E5EC] dark:border-[#252B3A] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card padding="lg" className="text-center py-16">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-[#737D94] mx-auto mb-3" />
          <p className="text-slate-700 dark:text-[#F5F7FF] font-semibold text-base">
            {filtered
              ? 'No jobs match your filters'
              : 'No jobs saved yet'}
          </p>
          <p className="text-slate-400 dark:text-[#737D94] text-xs mt-1 mb-5">
            {filtered
              ? 'Try adjusting your search or filter'
              : 'Add your first job opportunity to get started'}
          </p>
          {!filtered && (
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
      {data && data.total > 50 ? <nav aria-label="Job pages" className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-[#A8B0C2]">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous page</Button>
        <span>Page {page} of {Math.max(1, Math.ceil(data.total / 50))}</span>
        <Button type="button" variant="outline" size="sm" disabled={page * 50 >= data.total} onClick={() => setPage((value) => value + 1)}>Next page</Button>
      </nav> : null}
    </div>
  )
}
