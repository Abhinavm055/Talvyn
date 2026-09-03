import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useRef } from 'react'
import { Plus, Building2, MapPin, AlertCircle, X } from 'lucide-react'
import { jobsApi, JobsResponse } from '../../api/jobs'
import { Job, JobStatus } from '../../types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/utils'

export const TRACKER_COLUMNS: { id: JobStatus; label: string; headerClass: string; badgeClass: string }[] = [
  { id: 'SAVED',     label: 'Saved',     headerClass: 'bg-slate-100 dark:bg-[#151A29] text-slate-800 dark:text-[#F5F7FF] border border-slate-200/70 dark:border-[#252B3A]', badgeClass: 'bg-white dark:bg-[#111522] text-slate-700 dark:text-[#A8B0C2]' },
  { id: 'APPLIED',   label: 'Applied',   headerClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200/70 dark:border-indigo-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-indigo-700 dark:text-indigo-300' },
  { id: 'INTERVIEW', label: 'Interview', headerClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-amber-800 dark:text-amber-300' },
  { id: 'OFFER',     label: 'Offer',     headerClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-emerald-800 dark:text-emerald-300' },
  { id: 'REJECTED',  label: 'Rejected',  headerClass: 'bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 border border-red-200/70 dark:border-red-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-red-700 dark:text-red-300' },
]

export function normalizeStatusForColumn(status: string): JobStatus {
  if (status === 'IN_PROGRESS' || status === 'INTERESTED') return 'SAVED'
  if (status === 'ASSESSMENT') return 'INTERVIEW'
  if (status === 'ACCEPTED') return 'OFFER'
  return (status as JobStatus) || 'SAVED'
}

function KanbanCard({
  job,
  isDragging,
  onClick,
}: {
  job: Job
  isDragging?: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: job.id,
    data: { type: 'card', job },
  })

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (pointerStartRef.current) {
      const distance = Math.hypot(
        e.clientX - pointerStartRef.current.x,
        e.clientY - pointerStartRef.current.y
      )
      if (distance > 5) {
        // Pointer was dragged, suppress click navigation
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
    onClick()
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        handlePointerDown(e)
        const listenersDown = (listeners as any)?.onPointerDown
        if (typeof listenersDown === 'function') {
          listenersDown(e)
        }
      }}
      onClick={handleClick}
      className={`bg-white dark:bg-[#111522] rounded-xl border border-[#E2E5EC] dark:border-[#252B3A] shadow-card dark:shadow-card-dark p-3.5 cursor-grab active:cursor-grabbing select-none hover:shadow-card-hover dark:hover:border-[#353D50] transition-all ${
        isDragging ? 'opacity-40 ring-2 ring-primary-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#151A29] border border-slate-200/50 dark:border-[#252B3A] flex items-center justify-center shrink-0">
          <span className="text-slate-600 dark:text-[#A8B0C2] text-xs font-semibold">
            {job.company.charAt(0)}
          </span>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF] leading-snug line-clamp-2 mb-1">
        {job.title}
      </p>
      <p className="text-xs text-slate-600 dark:text-[#A8B0C2] flex items-center gap-1">
        <Building2 className="w-3 h-3 text-[#858DA0] dark:text-[#737D94]" />
        {job.company}
      </p>
      {job.location && (
        <p className="text-xs text-slate-500 dark:text-[#737D94] flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-[#858DA0] dark:text-[#737D94]" />
          {job.location}
        </p>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F1F3F8] dark:border-[#252B3A]/60">
        {job.jobType ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#151A29] text-slate-600 dark:text-[#A8B0C2]">
            {job.jobType.replace(/_/g, ' ')}
          </span>
        ) : <span />}
        <span className="text-xs text-slate-400 dark:text-[#737D94]">{timeAgo(job.createdAt)}</span>
      </div>
    </div>
  )
}

function KanbanColumn({
  column,
  jobs,
  activeJobId,
  onCardClick,
}: {
  column: typeof TRACKER_COLUMNS[number]
  jobs: Job[]
  activeJobId?: string
  onCardClick: (jobId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', status: column.id },
  })

  return (
    <div className="w-72 shrink-0 flex flex-col rounded-2xl">
      {/* Column header */}
      <div className={`${column.headerClass} rounded-t-2xl px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.label}</span>
          <span className={`${column.badgeClass} text-xs font-semibold px-2 py-0.5 rounded-full shadow-2xs`}>
            {jobs.length}
          </span>
        </div>
      </div>

      {/* Real droppable container */}
      <div
        ref={setNodeRef}
        data-droppable-column={column.id}
        className={`flex-1 space-y-2.5 min-h-[350px] bg-[#F1F3F8]/50 dark:bg-[#0D101A]/60 border-x border-b border-[#E2E5EC] dark:border-[#252B3A] rounded-b-2xl p-2.5 transition-colors ${
          isOver ? 'ring-2 ring-primary-500 dark:ring-violet-500 bg-primary-50/40 dark:bg-violet-950/40' : ''
        }`}
      >
        <SortableContext
          id={column.id}
          items={jobs.map((j) => j.id)}
          strategy={verticalListSortingStrategy}
        >
          {jobs.length === 0 ? (
            <div className={`flex items-center justify-center h-32 border-2 border-dashed rounded-xl transition-colors ${
              isOver ? 'border-primary-400 dark:border-violet-500 bg-primary-50/40 dark:bg-violet-950/40' : 'border-[#D9DDE7] dark:border-[#252B3A]'
            }`}>
              <p className="text-xs font-medium text-slate-400 dark:text-[#737D94]">Drop here</p>
            </div>
          ) : (
            jobs.map((job) => (
              <KanbanCard
                key={job.id}
                job={job}
                isDragging={activeJobId === job.id}
                onClick={() => onCardClick(job.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

export default function Tracker() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [localJobs, setLocalJobs] = useState<Job[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ limit: 200 }),
  })

  const serverJobs = data?.jobs || []
  const jobs = localJobs !== null ? localJobs : serverJobs

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      setErrorMessage(null)
      await qc.cancelQueries({ queryKey: ['jobs'] })
      const previousData = qc.getQueryData<JobsResponse>(['jobs'])

      if (previousData) {
        qc.setQueryData<JobsResponse>(['jobs'], {
          ...previousData,
          jobs: previousData.jobs.map((j) =>
            j.id === id ? { ...j, status } : j
          ),
        })
      }

      return { previousData }
    },
    onError: (err: any, _variables, context) => {
      if (context?.previousData) {
        qc.setQueryData(['jobs'], context.previousData)
      }
      setLocalJobs(null)
      setErrorMessage(err?.response?.data?.error || 'Failed to update job status. Restored previous position.')
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      if (variables?.id) {
        qc.invalidateQueries({ queryKey: ['job', variables.id] })
        qc.invalidateQueries({ queryKey: ['timeline', variables.id] })
      }
      setLocalJobs(null)
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string
    const job = (localJobs || serverJobs).find((j) => j.id === activeId)
    if (job) setActiveJob(job)
    setLocalJobs([...serverJobs])
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // 1. Hovered over a column directly
    const overColumn = TRACKER_COLUMNS.find((c) => c.id === overId)
    if (overColumn) {
      setLocalJobs((prev) => {
        const base = prev || serverJobs
        return base.map((j) => (j.id === activeId ? { ...j, status: overColumn.id } : j))
      })
      return
    }

    // 2. Hovered over another card
    const overJob = (localJobs || serverJobs).find((j) => j.id === overId)
    if (overJob && overJob.status) {
      const targetColStatus = normalizeStatusForColumn(overJob.status)
      setLocalJobs((prev) => {
        const base = prev || serverJobs
        return base.map((j) => (j.id === activeId ? { ...j, status: targetColStatus } : j))
      })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveJob(null)

    if (!over) {
      setLocalJobs(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Determine target column
    const directCol = TRACKER_COLUMNS.find((c) => c.id === overId)
    const overJob = (localJobs || serverJobs).find((j) => j.id === overId)
    const currentMovedJob = localJobs?.find((j) => j.id === activeId)

    let targetStatus: JobStatus | undefined
    if (directCol) {
      targetStatus = directCol.id
    } else if (overJob) {
      targetStatus = normalizeStatusForColumn(overJob.status)
    } else if (currentMovedJob) {
      targetStatus = normalizeStatusForColumn(currentMovedJob.status)
    }

    const originalJob = serverJobs.find((j) => j.id === activeId)
    const originalStatus = originalJob ? normalizeStatusForColumn(originalJob.status) : null

    if (targetStatus && targetStatus !== originalStatus) {
      // 1. Update UI optimistically
      setLocalJobs((prev) => {
        const base = prev || serverJobs
        return base.map((j) => (j.id === activeId ? { ...j, status: targetStatus! } : j))
      })

      // 2. Send backend PATCH request
      updateStatusMutation.mutate({ id: activeId, status: targetStatus })
    } else {
      setLocalJobs(null)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">Application Tracker</h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm mt-1">Drag jobs between columns to update their status</p>
        </div>
        <Button icon={<Plus />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TRACKER_COLUMNS.map((col) => (
            <div key={col.id} className="w-72 shrink-0 h-96 bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-6">
            {TRACKER_COLUMNS.map((col) => {
              const colJobs = jobs.filter((j) => normalizeStatusForColumn(j.status) === col.id)
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  jobs={colJobs}
                  activeJobId={activeJob?.id}
                  onCardClick={(jobId) => navigate(`/jobs/${jobId}`)}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeJob && (
              <div className="bg-white dark:bg-[#151A29] rounded-xl border border-primary-400 dark:border-violet-600 shadow-modal dark:shadow-modal-dark p-3.5 w-72 opacity-95 rotate-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]">{activeJob.title}</p>
                <p className="text-xs text-slate-500 dark:text-[#A8B0C2] mt-1">{activeJob.company}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
