import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, ZoomIn, ZoomOut, Check, RotateCw, Image as ImageIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface PhotoCropModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (file: File) => Promise<void>
  initialImageUrl?: string
}

export function PhotoCropModal({ isOpen, onClose, onSave, initialImageUrl }: PhotoCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setImageSrc(initialImageUrl || null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setError('')
    }
  }, [isOpen, initialImageUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5 MB.')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleSaveCrop = async () => {
    if (!imageSrc) return
    setSaving(true)
    setError('')

    try {
      const img = imageRef.current
      if (!img) throw new Error('Image reference missing')

      const canvas = document.createElement('canvas')
      const targetSize = 400
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')

      if (!ctx) throw new Error('Could not get canvas context')

      const cropBoxSize = 220 // Displayed crop box dimension in px
      const scale = (img.naturalWidth / img.width) / zoom

      // Center offset
      const cx = img.width / 2 + pan.x
      const cy = img.height / 2 + pan.y

      const sourceWidth = cropBoxSize * scale
      const sourceHeight = cropBoxSize * scale
      const sourceX = (img.naturalWidth / 2) - (sourceWidth / 2) - (pan.x * (img.naturalWidth / (img.width * zoom)))
      const sourceY = (img.naturalHeight / 2) - (sourceHeight / 2) - (pan.y * (img.naturalHeight / (img.height * zoom)))

      // Draw onto canvas
      ctx.drawImage(
        img,
        Math.max(0, sourceX),
        Math.max(0, sourceY),
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetSize,
        targetSize
      )

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to generate image file.')
          setSaving(false)
          return
        }

        const croppedFile = new File([blob], 'profile-avatar.jpg', { type: 'image/jpeg' })
        try {
          await onSave(croppedFile)
          onClose()
        } catch (err: unknown) {
          const e = err as Error
          setError(e.message || 'Failed to upload cropped photo.')
        } finally {
          setSaving(false)
        }
      }, 'image/jpeg', 0.92)
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Error processing crop.')
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crop Profile Photo">
      <div className="space-y-5">
        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        {/* Cropper Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        >
          {imageSrc ? (
            <>
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Target"
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                className="transition-transform duration-75 pointer-events-none"
              />

              {/* Dark Overlay with 1:1 Circular Cutout */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[220px] h-[220px] rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />
              </div>
            </>
          ) : (
            <div className="text-center space-y-3 p-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto">
                <ImageIcon className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Upload a photo to crop</p>
                <p className="text-xs text-slate-400 mt-0.5">Recommended: 1:1 square photo (PNG, JPG)</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 text-white hover:bg-white/20 border-white/20"
              >
                Choose Photo
              </Button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Controls */}
        {imageSrc && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-primary-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <ZoomIn className="w-4 h-4 text-slate-400" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline shrink-0 ml-2"
              >
                Change Photo
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Drag image to position • Use slider to zoom
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            icon={<Check className="w-4 h-4" />}
            onClick={handleSaveCrop}
            loading={saving}
            disabled={!imageSrc}
          >
            Save Photo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
