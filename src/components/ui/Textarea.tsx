import React from 'react'
import { cn } from '../../lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94] resize-y min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent dark:focus:bg-[#111522]',
            'transition-colors duration-150',
            error ? 'border-red-400 focus:ring-red-400' : 'border-[#D9DDE7] dark:border-[#252B3A] hover:border-[#BFC6D4] dark:hover:border-[#353D50]',
            props.disabled && 'opacity-60 cursor-not-allowed bg-[#F7F8FC] dark:bg-[#0D101A]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-[#858DA0] dark:text-[#737D94]">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
