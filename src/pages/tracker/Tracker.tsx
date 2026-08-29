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

const COLUMNS: { id: JobStatus; label: string; color: string }[] = [
  { id: 'SAVED',       label: 'Saved',       color: 'bg-slate-100' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'APPLIED',     label: 'Applied',     color: 'bg-indigo-50' },
  { id: 'ASSESSMENT',  label: 'Assessment',  color: 'bg-purple-50' },
  { id: 'INTERVIEW',   label: 'Interview',   color: 'bg-amber-50' },
  { id: 'OFFER',       label: 'Offer',       color: 'bg-emerald-50' },
  { id: 'REJECTED',    label: 'Rejected',    color: 'bg-red-50' },
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
      className={`bg-white rounded-xl border border-slate-100 shadow-card p-3.5 cursor-grab active:cursor-grabbing select-none hover:shadow-card-hover transition-all ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <span className="text-slate-500 text-xs font-semibold">
            {job.company.charAt(0)}
          </span>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 mb-1">
        {job.title}
      </p>
      <p className="text-xs text-slate-500 flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        {job.company}
      </p>
      {job.location && (
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3" />
          {job.location}
        </p>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
        {job.jobType ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {job.jobType.replace(/_/g, ' ')}
          </span>
        ) : <span />}
        <span className="text-xs text-slate-300">{timeAgo(job.createdAt)}</span>
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Application Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Drag jobs between columns to update their status</p>
        </div>
        <Button icon={<Plus />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-72 shrink-0 h-96 bg-slate-50 rounded-2xl animate-pulse" />
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
                  <div className={`${col.color} rounded-t-2xl px-4 py-3 flex items-center justify-between mb-2`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                      <span className="bg-white text-slate-500 text-xs font-semibold px-1.5 py-0.5 rounded-full">
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
                    <div className="flex-1 space-y-2.5 min-h-[200px] bg-slate-50/50 rounded-b-2xl p-2">
                      {colJobs.length === 0 ? (
                        <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 rounded-xl">
                          <p className="text-xs text-slate-300">Drop here</p>
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
              <div className="bg-white rounded-xl border border-primary-200 shadow-modal p-3.5 w-72 opacity-95 rotate-2">
                <p className="text-sm font-semibold text-slate-900">{activeJob.title}</p>
                <p className="text-xs text-slate-500 mt-1">{activeJob.company}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
