import { cn } from '../../lib/utils'
import { JobStatus } from '../../types'

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  SAVED:       { label: 'Saved',       className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60' },
  INTERESTED:  { label: 'Interested',  className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800/60' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-200 border border-cyan-200/60 dark:border-cyan-800/60' },
  APPLIED:     { label: 'Applied',     className: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-800/60' },
  ASSESSMENT:  { label: 'Assessment',  className: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/60' },
  INTERVIEW:  { label: 'Interview',  className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/60' },
  OFFER:      { label: 'Offer',      className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-800/60' },
  ACCEPTED:   { label: 'Accepted',   className: 'bg-green-100 dark:bg-green-950/80 text-green-800 dark:text-green-200 border border-green-300/60 dark:border-green-800/60' },
  REJECTED:   { label: 'Rejected',   className: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-200 border border-red-200/60 dark:border-red-800/60' },
  WITHDRAWN:  { label: 'Withdrawn',  className: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-200 border border-orange-200/60 dark:border-orange-800/60' },
  EXPIRED:    { label: 'Expired',    className: 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-700/40' },
}

interface StatusBadgeProps {
  status: JobStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig.SAVED
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  )
}

export { statusConfig }
