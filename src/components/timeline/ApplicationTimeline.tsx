import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import { TimelineEvent, TimelineStage } from '../../types'
import { CheckCircle2, Circle, Clock, Plus, ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'

interface ApplicationTimelineProps {
  jobId: string
}

const STAGE_LABELS: Record<string, string> = {
  SAVED: 'Saved',
  APPLICATION_STARTED: 'Application Started',
  APPLIED: 'Applied',
  ASSESSMENT: 'Assessment / Challenge',
  INTERVIEW: 'Interview',
  OFFER: 'Offer Received',
  ACCEPTED: 'Offer Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

export const ApplicationTimeline: React.FC<ApplicationTimelineProps> = ({ jobId }) => {
  const qc = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedStage, setSelectedStage] = useState<TimelineStage>('ASSESSMENT')
  const [stageNote, setStageNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', jobId],
    queryFn: () => jobsApi.getTimeline(jobId),
  })

  const addEventMutation = useMutation({
    mutationFn: ({ stage, note }: { stage: string; note?: string }) =>
      jobsApi.addTimelineEvent(jobId, stage, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline', jobId] })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setShowAddModal(false)
      setStageNote('')
    },
  })

  const timeline: TimelineEvent[] = data?.timeline || []

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Not yet'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return isoString
    }
  }

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-base">Application Timeline</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowAddModal(true)}
        >
          Log Stage
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-2">
          <div className="h-6 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-6 bg-slate-100 rounded animate-pulse w-1/2" />
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {timeline.map((event, index) => {
            const isCompleted = event.completed
            return (
              <div key={event.id || index} className="relative group">
                {/* Dot */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-white ${
                    isCompleted
                      ? 'text-emerald-600 ring-2 ring-emerald-500'
                      : 'text-slate-300 ring-2 ring-slate-200'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 fill-emerald-100" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isCompleted ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {STAGE_LABELS[event.stage] || event.title}
                      </span>
                      {isCompleted && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Completed
                        </span>
                      )}
                    </div>
                    {event.note && (
                      <p className="text-xs text-slate-500 mt-0.5">{event.note}</p>
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      isCompleted && event.timestamp
                        ? 'text-slate-600'
                        : 'text-slate-400 italic'
                    }`}
                  >
                    {formatDate(event.timestamp)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Log Stage Milestone Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Log Timeline Milestone"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Milestone Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as TimelineStage)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
            >
              <option value="APPLICATION_STARTED">Application Started</option>
              <option value="APPLIED">Applied</option>
              <option value="ASSESSMENT">Assessment / Technical Screen</option>
              <option value="INTERVIEW">Interview Scheduled / Completed</option>
              <option value="OFFER">Offer Received</option>
              <option value="ACCEPTED">Offer Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notes / Details (Optional)
            </label>
            <textarea
              rows={3}
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              placeholder="e.g. Completed 45-minute live technical interview with Engineering Manager."
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={addEventMutation.isPending}
              onClick={() => {
                addEventMutation.mutate({
                  stage: selectedStage,
                  note: stageNote,
                })
              }}
            >
              Save Milestone
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
