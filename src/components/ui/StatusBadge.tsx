import { cn } from '../../lib/utils'
import { JobStatus } from '../../types'

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  SAVED:       { label: 'Saved',       className: 'bg-slate-100 text-slate-600' },
  INTERESTED:  { label: 'Interested',  className: 'bg-blue-50 text-blue-600' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-cyan-50 text-cyan-700' },
  APPLIED:     { label: 'Applied',     className: 'bg-indigo-50 text-indigo-700' },
  ASSESSMENT:  { label: 'Assessment',  className: 'bg-purple-50 text-purple-700' },
  INTERVIEW:  { label: 'Interview',  className: 'bg-amber-50 text-amber-700' },
  OFFER:      { label: 'Offer',      className: 'bg-emerald-50 text-emerald-700' },
  ACCEPTED:   { label: 'Accepted',   className: 'bg-green-100 text-green-700' },
  REJECTED:   { label: 'Rejected',   className: 'bg-red-50 text-red-600' },
  WITHDRAWN:  { label: 'Withdrawn',  className: 'bg-orange-50 text-orange-600' },
  EXPIRED:    { label: 'Expired',    className: 'bg-slate-50 text-slate-400' },
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
