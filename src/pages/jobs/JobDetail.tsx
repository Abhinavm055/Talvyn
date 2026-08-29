import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit2, Trash2, ExternalLink, MapPin, Calendar, Building2,
  DollarSign, Briefcase, StickyNote, Plus, Send, Clock, CheckCircle, Award, CheckCircle2, AlertCircle
} from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { notesApi } from '../../api/notes'
import { profileApi } from '../../api/profile'
import { resumesApi } from '../../api/resumes'
import { readinessScorer } from '../../services/readinessScorer'
import { ApplicationTimeline } from '../../components/timeline/ApplicationTimeline'
import { JobStatus, Note } from '../../types'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { formatDate, timeAgo } from '../../lib/utils'

const JOB_STATUSES: { value: string; label: string }[] = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [noteContent, setNoteContent] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: !!id,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: () => notesApi.list(id!),
    enabled: !!id,
  })

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.get(),
  })

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumesApi.list(),
  })

  const readiness = readinessScorer.calculateReadiness(profile || null, resumes)

  const updateStatusMutation = useMutation({
    mutationFn: (status: JobStatus) => jobsApi.updateStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const deleteJobMutation = useMutation({
    mutationFn: () => jobsApi.delete(id!),
    onSuccess: () => navigate('/jobs'),
  })

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => notesApi.create(id!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', id] })
      setNoteContent('')
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      notesApi.update(noteId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', id] })
      setEditingNote(null)
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => notesApi.delete(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', id] }),
  })

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse mb-8" />
        <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Job not found.</p>
        <Link to="/jobs" className="text-primary-600 text-sm mt-2 inline-block hover:underline">
          Back to My Jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          My Jobs
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Edit2 />}
            onClick={() => navigate(`/jobs/${id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 />}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <Card padding="lg">
            {/* Company + Title */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-slate-600 text-xl font-bold">
                  {job.company.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 font-medium text-sm">{job.company}</span>
                </div>
              </div>
              <StatusBadge status={job.status as JobStatus} />
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {job.location && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.salary && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>{job.salary}</span>
                </div>
              )}
              {job.jobType && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>{job.jobType.replace('_', ' ')}</span>
                </div>
              )}
              {job.sourceWebsite && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Send className="w-4 h-4 text-slate-400" />
                  <span>{job.sourceWebsite}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Saved {formatDate(job.dateSaved)}</span>
              </div>
              {job.dateApplied && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-slate-400" />
                  <span>Applied {formatDate(job.dateApplied)}</span>
                </div>
              )}
            </div>

            {/* URL */}
            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium mb-5"
              >
                <ExternalLink className="w-4 h-4" />
                View Job Posting
              </a>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Job Description</h3>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-4">
                  {job.description}
                </div>
              </div>
            )}
          </Card>



            {/* Notes Section */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-slate-400" />
                Notes & Activity
                {notes.length > 0 && (
                  <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {notes.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            {/* Add note */}
            <div className="flex gap-2 mb-5">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a note — follow-up, interview prep, recruiter details…"
                rows={2}
                className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-slate-300 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteContent.trim()) {
                    e.preventDefault()
                    createNoteMutation.mutate(noteContent)
                  }
                }}
              />
              <Button
                size="sm"
                icon={<Plus />}
                onClick={() => noteContent.trim() && createNoteMutation.mutate(noteContent)}
                loading={createNoteMutation.isPending}
                disabled={!noteContent.trim()}
                className="self-start mt-0.5"
              >
                Add
              </Button>
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No notes yet. Add your first note above.
              </p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-amber-50 border border-amber-100 rounded-xl group"
                  >
                    {editingNote?.id === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm rounded-lg border border-amber-200 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updateNoteMutation.mutate({ noteId: note.id, content: editNoteContent })
                            }
                            loading={updateNoteMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNote(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-400">{timeAgo(note.updatedAt)}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingNote(note)
                                setEditNoteContent(note.content)
                              }}
                              className="text-xs text-slate-500 hover:text-primary-600 px-2 py-0.5 rounded hover:bg-primary-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              className="text-xs text-slate-500 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Interactive Application Timeline (Phase 2E) */}
          <ApplicationTimeline jobId={id!} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Update */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Update Status</h3>
            <Select
              value={job.status}
              onChange={(e) => updateStatusMutation.mutate(e.target.value as JobStatus)}
              options={JOB_STATUSES}
            />
            {updateStatusMutation.isPending && (
              <p className="text-xs text-slate-400 mt-2">Updating…</p>
            )}
          </Card>

          {/* Application Readiness Score Widget (Phase 2E) */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Application Readiness</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                readiness.tier === 'READY'
                  ? 'bg-emerald-50 text-emerald-700'
                  : readiness.tier === 'MOSTLY_READY'
                  ? 'bg-blue-50 text-blue-700'
                  : readiness.tier === 'NEEDS_ATTENTION'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {readiness.score}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  readiness.tier === 'READY'
                    ? 'bg-emerald-500'
                    : readiness.tier === 'MOSTLY_READY'
                    ? 'bg-blue-500'
                    : readiness.tier === 'NEEDS_ATTENTION'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>

            <p className="text-xs font-medium text-slate-600 mb-3">{readiness.summaryText}</p>

            <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
              {readiness.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  {item.isReady ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Missing
                    </span>
                  )}
                </div>
              ))}
            </div>

            {readiness.tier !== 'READY' && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <Link
                  to="/profile"
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline block text-center"
                >
                  Complete Profile in Settings →
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Job"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong>{job.title}</strong> at {job.company}? This will also delete all notes. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteJobMutation.isPending}
            onClick={() => deleteJobMutation.mutate()}
          >
            Delete Job
          </Button>
        </div>
      </Modal>
    </div>
  )
}
