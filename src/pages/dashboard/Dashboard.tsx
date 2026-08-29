import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  XCircle,
  Plus,
  ArrowRight,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { useAuthStore } from '../../store/authStore'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDate, timeAgo } from '../../lib/utils'
import { Job } from '../../types'

const statCards = (jobs: Job[]) => [
  {
    label: 'Total Saved',
    value: jobs.length,
    icon: Briefcase,
    color: 'bg-slate-50 text-slate-600',
    iconColor: 'text-slate-500',
  },
  {
    label: 'Applied',
    value: jobs.filter((j) => ['APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'ACCEPTED'].includes(j.status)).length,
    icon: Send,
    color: 'bg-indigo-50 text-indigo-700',
    iconColor: 'text-indigo-500',
  },
  {
    label: 'Interviews',
    value: jobs.filter((j) => j.status === 'INTERVIEW').length,
    icon: MessageSquare,
    color: 'bg-amber-50 text-amber-700',
    iconColor: 'text-amber-500',
  },
  {
    label: 'Offers',
    value: jobs.filter((j) => ['OFFER', 'ACCEPTED'].includes(j.status)).length,
    icon: Trophy,
    color: 'bg-emerald-50 text-emerald-700',
    iconColor: 'text-emerald-500',
  },
  {
    label: 'Rejected',
    value: jobs.filter((j) => j.status === 'REJECTED').length,
    icon: XCircle,
    color: 'bg-red-50 text-red-700',
    iconColor: 'text-red-500',
  },
]

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ limit: 100 }),
  })

  const jobs = data?.jobs || []
  const recentJobs = [...jobs].slice(0, 6)
  const stats = statCards(jobs)

  const displayName =
    user?.profile?.preferredName ||
    user?.profile?.givenName ||
    user?.profile?.legalFullName?.split(' ')[0] ||
    'there'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} padding="md">
              <div className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {isLoading ? '—' : stat.value}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Recent Jobs
            </h2>
            <Link to="/jobs" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <Card padding="lg" className="text-center py-12">
              <Briefcase className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No jobs saved yet</p>
              <p className="text-slate-400 text-xs mt-1 mb-4">Add your first job to get started</p>
              <Button onClick={() => navigate('/jobs/new')} size="sm" icon={<Plus />}>
                Add Job Manually
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {recentJobs.map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`}>
                  <Card hover padding="md" className="flex items-center gap-4">
                    {/* Company logo placeholder */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-slate-500 text-sm font-semibold">
                        {job.company.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm truncate">{job.title}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                        <span>{job.company}</span>
                        {job.location && <span>· {job.location}</span>}
                        <span>· {timeAgo(job.createdAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & Tips */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Add a job manually', to: '/jobs/new', desc: 'Track a new opportunity' },
                { label: 'Update your profile', to: '/profile', desc: 'Keep your info current' },
                { label: 'Manage resumes', to: '/resumes', desc: 'Add or organize your CVs' },
                { label: 'View application tracker', to: '/tracker', desc: 'See your Kanban board' },
              ].map((action) => (
                <Link key={action.to} to={action.to}>
                  <Card hover padding="sm" className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{action.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Status breakdown */}
          {jobs.length > 0 && (
            <Card padding="md">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Application Pipeline</h3>
              <div className="space-y-2">
                {[
                  { label: 'Saved / Interested', count: jobs.filter((j) => ['SAVED', 'INTERESTED'].includes(j.status)).length, color: 'bg-slate-200' },
                  { label: 'Applied', count: jobs.filter((j) => j.status === 'APPLIED').length, color: 'bg-indigo-300' },
                  { label: 'Assessment', count: jobs.filter((j) => j.status === 'ASSESSMENT').length, color: 'bg-purple-300' },
                  { label: 'Interview', count: jobs.filter((j) => j.status === 'INTERVIEW').length, color: 'bg-amber-300' },
                  { label: 'Offer', count: jobs.filter((j) => ['OFFER', 'ACCEPTED'].includes(j.status)).length, color: 'bg-emerald-400' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${row.color} shrink-0`} />
                    <span className="text-slate-600 flex-1">{row.label}</span>
                    <span className="font-semibold text-slate-800">{row.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
