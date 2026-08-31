import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Star,
  Edit2,
  Trash2,
  FileText,
  CheckCircle,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  Loader2,
  FileCheck,
} from 'lucide-react'
import { resumesApi } from '../../api/resumes'
import { Resume } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Resume display name is required'),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return ''
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function Resumes() {
  const [showModal, setShowModal] = useState(false)
  const [editingResume, setEditingResume] = useState<Resume | null>(null)
  const [replacingResume, setReplacingResume] = useState<Resume | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Resume | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: resumes = [], isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: resumesApi.list,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      resumesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setShowModal(false)
      setEditingResume(null)
      reset()
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => resumesApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resumes'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resumesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setDeleteTarget(null)
    },
  })

  const validateAndSetFile = (file: File) => {
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds 10 MB limit.')
      return false
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      setFileError('Invalid format. Only PDF, DOC, and DOCX files are allowed.')
      return false
    }

    setFileError(null)
    setSelectedFile(file)

    // Auto-populate name if empty
    const cleanName = file.name.replace(/\.[^/.]+$/, '')
    setValue('name', cleanName)
    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !replacingResume) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10 MB limit.')
      return
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      alert('Invalid format. Only PDF, DOC, and DOCX files are allowed.')
      return
    }

    setIsUploading(true)
    try {
      await resumesApi.replace(replacingResume.id, file)
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setReplacingResume(null)
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to replace resume file.')
    } finally {
      setIsUploading(false)
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = ''
    }
  }

  const onSubmit = async (data: FormData) => {
    if (editingResume) {
      updateMutation.mutate({ id: editingResume.id, data })
      return
    }

    if (!selectedFile) {
      setFileError('Please select a resume file (PDF, DOC, DOCX).')
      return
    }

    setIsUploading(true)
    setFileError(null)
    try {
      await resumesApi.upload(selectedFile, {
        name: data.name,
        description: data.description || undefined,
        isDefault: data.isDefault,
      })
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setShowModal(false)
      setSelectedFile(null)
      reset()
    } catch (err: any) {
      setFileError(err?.response?.data?.error || 'Failed to upload resume file.')
    } finally {
      setIsUploading(false)
    }
  }

  const openEdit = (resume: Resume) => {
    setEditingResume(resume)
    setSelectedFile(null)
    setFileError(null)
    reset({ name: resume.name, description: resume.description || '', isDefault: resume.isDefault })
    setShowModal(true)
  }

  const openNew = () => {
    setEditingResume(null)
    setSelectedFile(null)
    setFileError(null)
    reset({ name: '', description: '', isDefault: resumes.length === 0 })
    setShowModal(true)
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Hidden file input for Replace File action */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleReplaceFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F5F7FF]">Resumes</h1>
          <p className="text-slate-500 dark:text-[#A8B0C2] text-sm mt-1">
            Upload, manage, and tailor different resume versions for automated job applications.
          </p>
        </div>
        <Button icon={<Plus />} onClick={openNew}>
          Upload Resume
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-[#111522] rounded-2xl animate-pulse border border-[#E2E5EC] dark:border-[#252B3A]" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <Card padding="lg" className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 dark:text-[#737D94] mx-auto mb-3" />
          <p className="text-slate-700 dark:text-[#F5F7FF] font-semibold text-base">No resumes uploaded yet</p>
          <p className="text-slate-400 dark:text-[#737D94] text-xs mt-1 mb-6 max-w-sm mx-auto">
            Upload your resume (PDF, DOC, DOCX) to power one-click autofill and intelligent resume matching.
          </p>
          <Button onClick={openNew} icon={<Upload />}>
            Upload Your First Resume
          </Button>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {resumes.map((resume) => (
            <Card
              key={resume.id}
              padding="md"
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150',
                resume.isDefault ? 'ring-2 ring-primary-500/20 dark:ring-violet-500/30 border-primary-300 dark:border-violet-600/50 bg-primary-50/20 dark:bg-violet-950/20' : 'hover:border-slate-300 dark:hover:border-[#353D50]'
              )}
            >
              <div className="flex items-start gap-4 min-w-0">
                {/* Icon */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
                    resume.isDefault
                      ? 'bg-primary-50 dark:bg-violet-950/60 text-primary-600 dark:text-violet-300 border-primary-200 dark:border-violet-800/60'
                      : 'bg-slate-100 dark:bg-[#151A29] text-slate-400 dark:text-[#737D94] border-slate-200 dark:border-[#252B3A]'
                  )}
                >
                  <FileText className="w-6 h-6" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-[#F5F7FF] text-sm truncate">{resume.name}</h3>
                    {resume.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-700 dark:text-violet-200 bg-primary-100/80 dark:bg-violet-900/60 px-2.5 py-0.5 rounded-full font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#A8B0C2] mt-1 flex-wrap">
                    {resume.fileName && (
                      <span className="font-mono text-slate-700 dark:text-[#F5F7FF]/90 bg-slate-100 dark:bg-[#151A29] border border-slate-200/60 dark:border-[#252B3A] px-1.5 py-0.5 rounded text-[11px] truncate max-w-[200px]">
                        {resume.fileName}
                      </span>
                    )}
                    {resume.fileSize && <span>• {formatBytes(resume.fileSize)}</span>}
                    <span>• Uploaded {formatDate(resume.createdAt)}</span>
                  </div>

                  {resume.description && (
                    <p className="text-xs text-slate-500 dark:text-[#A8B0C2] mt-1 line-clamp-1">{resume.description}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {resume.storagePath && (
                  <a
                    href={resumesApi.getFileUrl(resume.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-[#F5F7FF] hover:text-primary-600 dark:hover:text-violet-300 bg-white dark:bg-[#151A29] hover:bg-slate-50 dark:hover:bg-[#1E2538] border border-[#E2E5EC] dark:border-[#252B3A] px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
                    title="Download / View file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setReplacingResume(resume)
                    replaceFileInputRef.current?.click()
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-[#F5F7FF] hover:text-primary-600 dark:hover:text-violet-300 bg-white dark:bg-[#151A29] hover:bg-slate-50 dark:hover:bg-[#1E2538] border border-[#E2E5EC] dark:border-[#252B3A] px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
                  title="Replace with new file"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>

                {!resume.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultMutation.mutate(resume.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-[#A8B0C2] hover:text-amber-600 dark:hover:text-amber-300 bg-white dark:bg-[#151A29] hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-[#E2E5EC] dark:border-[#252B3A] px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
                    title="Set as primary default resume"
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>Set Default</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openEdit(resume)}
                  className="p-1.5 text-slate-400 dark:text-[#737D94] hover:text-slate-700 dark:hover:text-[#F5F7FF] rounded-lg hover:bg-slate-100 dark:hover:bg-[#151A29] transition-colors"
                  title="Edit details"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(resume)}
                  className="p-1.5 text-slate-400 dark:text-[#737D94] hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Delete resume"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingResume ? 'Edit Resume Details' : 'Upload Resume File'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editingResume && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF] mb-1 block">Resume File *</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                  selectedFile
                    ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                    : 'border-[#D9DDE7] dark:border-[#252B3A] hover:border-primary-400 dark:hover:border-violet-500 bg-slate-50/60 dark:bg-[#151A29]'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <FileCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-[#F5F7FF]">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500 dark:text-[#A8B0C2] font-mono">{formatBytes(selectedFile.size)}</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">Click to choose a different file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-400 dark:text-[#737D94]" />
                    <div className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]">Click to choose a resume file</div>
                    <div className="text-xs text-slate-500 dark:text-[#A8B0C2]">Supported formats: PDF, DOC, DOCX (Max 10 MB)</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {fileError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/60 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          <Input
            label="Display Name *"
            placeholder="e.g. Senior Java Backend Resume, General CV"
            {...register('name')}
            error={errors.name?.message}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF]">Description / Keywords</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="e.g. Focused on Spring Boot, Microservices, and Kubernetes architecture…"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94] resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent dark:focus:bg-[#111522]"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              {...register('isDefault')}
              className="w-4 h-4 rounded border-[#D9DDE7] dark:border-[#252B3A] text-primary-600 dark:text-violet-500 focus:ring-primary-500 focus:dark:ring-[#7C3AED]"
            />
            <span className="text-sm text-[#11131A] dark:text-[#F5F7FF] font-medium">Set as primary default resume</span>
          </label>

          <div className="flex gap-3 justify-end pt-3 border-t border-[#E2E5EC] dark:border-[#252B3A]">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" loading={isUploading || updateMutation.isPending}>
              {editingResume ? 'Save Changes' : 'Upload Resume'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Resume"
        size="sm"
      >
        <p className="text-sm text-slate-600 dark:text-[#A8B0C2] mb-6">
          Are you sure you want to delete <strong className="text-slate-900 dark:text-[#F5F7FF]">{deleteTarget?.name}</strong>? This file and its metadata will be permanently removed.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Delete Resume
          </Button>
        </div>
      </Modal>
    </div>
  )
}
