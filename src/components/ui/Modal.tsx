import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-[#111522] border border-[#E2E5EC] dark:border-[#252B3A] text-slate-900 dark:text-[#F5F7FF] rounded-2xl shadow-modal dark:shadow-modal-dark z-10 max-h-[90vh] overflow-y-auto',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-[#E2E5EC] dark:border-[#252B3A]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FF]">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#858DA0] dark:text-[#737D94] hover:text-slate-900 dark:hover:text-[#F5F7FF] hover:bg-[#F1F3F8] dark:hover:bg-[#151A29] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
