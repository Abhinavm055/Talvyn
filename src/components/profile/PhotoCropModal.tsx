import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, ZoomIn, ZoomOut, Check, Loader2, Image as ImageIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { profileApi } from '../../api/profile'

interface PhotoCropModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (file: File) => Promise<void>
  initialImageUrl?: string
}

/**
 * Promisified canvas.toBlob helper for robust error handling and async flow
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas export failed: generated empty blob.'))
        }
      }, type, quality)
    } catch (err) {
      reject(err)
    }
  })
}

export function PhotoCropModal({ isOpen, onClose, onSave, initialImageUrl }: PhotoCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isImageReady, setIsImageReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const createdObjectUrlsRef = useRef<Set<string>>(new Set())

  // Create tracked object URL that will be safely revoked
  const createTrackedObjectURL = useCallback((blobOrFile: Blob | File): string => {
    const url = URL.createObjectURL(blobOrFile)
    createdObjectUrlsRef.current.add(url)
    return url
  }, [])

  // Revoke all created object URLs to prevent memory leaks
  const revokeAllTrackedURLs = useCallback(() => {
    createdObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    })
    createdObjectUrlsRef.current.clear()
  }, [])

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      revokeAllTrackedURLs()
    }
  }, [revokeAllTrackedURLs])

  // Load image when modal opens or initialImageUrl changes
  useEffect(() => {
    if (!isOpen) {
      revokeAllTrackedURLs()
      setImageSrc(null)
      setIsImageReady(false)
      setIsImageLoading(false)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setError('')
      return
    }

    if (initialImageUrl) {
      let isCancelled = false
      setIsImageLoading(true)
      setIsImageReady(false)
      setError('')

      const loadRemoteImage = async () => {
        try {
          // If already a local blob/data URL, use directly
          if (initialImageUrl.startsWith('blob:') || initialImageUrl.startsWith('data:')) {
            if (!isCancelled) {
              setImageSrc(initialImageUrl)
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }
            return
          }

          // Fetch safe CORS blob via direct CORS or backend proxy
          const blob = await profileApi.fetchSafeAvatarBlob(initialImageUrl)
          if (!isCancelled) {
            const safeUrl = createTrackedObjectURL(blob)
            setImageSrc(safeUrl)
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }
        } catch (err: unknown) {
          if (!isCancelled) {
            console.warn('[Talvyn] Failed to fetch remote avatar blob, using fallback:', err)
            // Fallback directly to the initial image URL
            setImageSrc(initialImageUrl)
          }
        } finally {
          if (!isCancelled) {
            setIsImageLoading(false)
          }
        }
      }

      loadRemoteImage()

      return () => {
        isCancelled = true
      }
    } else {
      revokeAllTrackedURLs()
      setImageSrc(null)
      setIsImageReady(false)
      setIsImageLoading(false)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setError('')
    }
  }, [isOpen, initialImageUrl, createTrackedObjectURL, revokeAllTrackedURLs])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset file input value so selecting the same file again triggers onChange
    e.target.value = ''

    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image file (PNG, JPG, JPEG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5 MB.')
      return
    }

    setError('')
    setIsImageReady(false)
    setIsImageLoading(false)

    // Revoke previous URLs before setting the new one
    revokeAllTrackedURLs()

    const localUrl = createTrackedObjectURL(file)
    setImageSrc(localUrl)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc || !isImageReady) return
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

  // Touch pan handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSrc || !isImageReady || e.touches.length !== 1) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!imageSrc || !isImageReady) return
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    setZoom((prev) => Math.min(3, Math.max(1, prev + delta)))
  }

  const handleImageLoad = () => {
    setIsImageReady(true)
    setError('')
  }

  const handleImageError = () => {
    setIsImageReady(false)
    setError('Failed to load image. Please choose another photo.')
  }

  const handleSaveCrop = async () => {
    if (!imageSrc || !isImageReady) return
    const img = imageRef.current
    if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      setError('Image is still loading. Please wait a moment and try again.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const targetSize = 400 // Standard 400x400 avatar resolution
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d', { willReadFrequently: false })

      if (!ctx) throw new Error('Could not get canvas context')

      // High-quality downsampling / upsampling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Clean background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetSize, targetSize)

      // Displayed crop circle diameter is 220px in the container center
      const cropBoxSize = 220

      // Natural and base rendered dimensions
      const baseWidth = img.width || img.naturalWidth
      const baseHeight = img.height || img.naturalHeight

      // Scale factor mapping display pixels to 400x400 canvas pixels
      const destScale = targetSize / cropBoxSize

      // Rendered width & height scaled to the 400x400 canvas
      const dw = baseWidth * zoom * destScale
      const dh = baseHeight * zoom * destScale

      // Center of canvas is (targetSize / 2, targetSize / 2)
      // The user's pan offset in display pixels is scaled to canvas pixels
      const canvasCenterX = targetSize / 2 + pan.x * destScale
      const canvasCenterY = targetSize / 2 + pan.y * destScale

      const dx = canvasCenterX - dw / 2
      const dy = canvasCenterY - dh / 2

      // Draw the full image at the computed position onto the canvas
      ctx.drawImage(img, dx, dy, dw, dh)

      // Export canvas to JPEG blob using Promise helper
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
      const croppedFile = new File([blob], 'profile-avatar.jpg', { type: 'image/jpeg' })

      await onSave(croppedFile)
      onClose()
    } catch (err: unknown) {
      const e = err as Error
      console.error('[Talvyn] Photo crop error:', e)
      if (e.message?.includes('Tainted canvases')) {
        setError('Cross-origin image protection blocked export. Please upload a local photo.')
      } else {
        setError(e.message || 'Error processing cropped photo.')
      }
    } finally {
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        >
          {isImageLoading && (
            <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center gap-2 z-20">
              <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />
              <span className="text-xs text-slate-300 font-medium">Preparing image...</span>
            </div>
          )}

          {imageSrc ? (
            <>
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Target"
                draggable={false}
                crossOrigin="anonymous"
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                className="transition-transform duration-75 pointer-events-none"
              />

              {/* Dark Overlay with 1:1 Circular Cutout (220px diameter) */}
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
                <p className="text-xs text-slate-400 mt-0.5">Recommended: 1:1 square photo (PNG, JPG, WebP)</p>
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
          accept="image/png,image/jpeg,image/jpg,image/webp"
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
                className="text-xs font-semibold text-primary-600 dark:text-violet-400 hover:underline shrink-0 ml-2 cursor-pointer"
              >
                Change Photo
              </button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-[#737D94] text-center">
              Drag image to position • Use slider or scroll wheel to zoom
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#252B3A]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            icon={<Check className="w-4 h-4" />}
            onClick={handleSaveCrop}
            loading={saving}
            disabled={!imageSrc || !isImageReady}
          >
            Save Photo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
