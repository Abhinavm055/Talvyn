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
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { Plus, ArrowRight, Building2, MapPin } from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { Job, JobStatus } from '../../types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/utils'

const COLUMNS: { id: JobStatus; label: string; headerClass: string; badgeClass: string }[] = [
  { id: 'SAVED',       label: 'Saved',       headerClass: 'bg-slate-100 dark:bg-[#151A29] text-slate-800 dark:text-[#F5F7FF] border border-slate-200/70 dark:border-[#252B3A]', badgeClass: 'bg-white dark:bg-[#111522] text-slate-700 dark:text-[#A8B0C2]' },
  { id: 'IN_PROGRESS', label: 'In Progress', headerClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200/70 dark:border-blue-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-blue-700 dark:text-blue-300' },
  { id: 'APPLIED',     label: 'Applied',     headerClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200/70 dark:border-indigo-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-indigo-700 dark:text-indigo-300' },
  { id: 'ASSESSMENT',  label: 'Assessment',  headerClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border border-purple-200/70 dark:border-purple-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-purple-700 dark:text-purple-300' },
  { id: 'INTERVIEW',   label: 'Interview',   headerClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-amber-800 dark:text-amber-300' },
  { id: 'OFFER',       label: 'Offer',       headerClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-emerald-800 dark:text-emerald-300' },
  { id: 'REJECTED',    label: 'Rejected',    headerClass: 'bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 border border-red-200/70 dark:border-red-800/60', badgeClass: 'bg-white dark:bg-[#111522] text-red-700 dark:text-red-300' },
]

function KanbanCard({
  job,
  isDragging,
  onClick,
}: {
  job: Job
  isDragging?: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: job.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white dark:bg-[#111522] rounded-xl border border-[#E2E5EC] dark:border-[#252B3A] shadow-card dark:shadow-card-dark p-3.5 cursor-grab active:cursor-grabbing select-none hover:shadow-card-hover dark:hover:border-[#353D50] transition-all ${isDragging ? 'opacity-40' : ''}`}
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

export default function Tracker() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [localJobs, setLocalJobs] = useState<Job[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ limit: 200 }),
    select: (d) => d.jobs,
  })

  const jobs = localJobs.length > 0 ? localJobs : (data || [])

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setLocalJobs([])
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id)
    if (job) setActiveJob(job)
    setLocalJobs(data || [])
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if over a column header
    const overColumn = COLUMNS.find((c) => c.id === overId)
    if (overColumn) {
      setLocalJobs((prev) =>
        prev.map((j) =>
          j.id === activeId ? { ...j, status: overColumn.id } : j
        )
      )
      return
    }

    // Over a card
    const overJob = localJobs.find((j) => j.id === overId)
    if (overJob && overJob.status !== localJobs.find((j) => j.id === activeId)?.status) {
      setLocalJobs((prev) =>
        prev.map((j) =>
          j.id === activeId ? { ...j, status: overJob.status } : j
        )
      )
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveJob(null)

    if (!over) {
      setLocalJobs([])
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Determine target column
    const targetColumn = COLUMNS.find((c) => c.id === overId)
    const targetJobColumn = localJobs.find((j) => j.id === overId)?.status

    const newStatus = targetColumn?.id || targetJobColumn
    const originalStatus = data?.find((j) => j.id === activeId)?.status

    if (newStatus && newStatus !== originalStatus) {
      updateStatusMutation.mutate({ id: activeId, status: newStatus as JobStatus })
    } else {
      setLocalJobs([])
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">Application Tracker</h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm mt-1">Drag jobs between columns to update their status</p>
        </div>
        <Button icon={<Plus />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
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
            {COLUMNS.map((col) => {
              const colJobs = jobs.filter((j) => j.status === col.id)
              return (
                <div
                  key={col.id}
                  id={col.id}
                  className="w-72 shrink-0 flex flex-col"
                >
                  {/* Column header */}
                  <div className={`${col.headerClass} rounded-t-2xl px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{col.label}</span>
                      <span className={`${col.badgeClass} text-xs font-semibold px-2 py-0.5 rounded-full shadow-2xs`}>
                        {colJobs.length}
                      </span>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <SortableContext
                    id={col.id}
                    items={colJobs.map((j) => j.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex-1 space-y-2.5 min-h-[220px] bg-[#F1F3F8]/50 dark:bg-[#0D101A]/60 border-x border-b border-[#E2E5EC] dark:border-[#252B3A] rounded-b-2xl p-2.5">
                      {colJobs.length === 0 ? (
                        <div className="flex items-center justify-center h-24 border-2 border-dashed border-[#D9DDE7] dark:border-[#252B3A] rounded-xl">
                          <p className="text-xs font-medium text-slate-400 dark:text-[#737D94]">Drop here</p>
                        </div>
                      ) : (
                        colJobs.map((job) => (
                          <KanbanCard
                            key={job.id}
                            job={job}
                            isDragging={activeJob?.id === job.id}
                            onClick={() => navigate(`/jobs/${job.id}`)}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
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
