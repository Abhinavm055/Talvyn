import React from 'react'
import { cn } from '../../lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
  icon?: React.ReactNode
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, placeholder, icon, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-violet-400 shrink-0">
              {icon}
            </div>
          )}
          <select
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-11 text-sm rounded-xl border bg-white dark:bg-[#161725] text-slate-900 dark:text-[#E5E7EB]',
              'hover:border-slate-300 dark:hover:bg-[#1C1C2B]',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent',
              'transition-all duration-150 cursor-pointer',
              icon ? 'pl-10 pr-8' : 'px-3.5',
              error ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-[#1E1E2A]',
              props.disabled && 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-[#13141f]',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="dark:bg-[#161725] dark:text-[#71717A]">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="dark:bg-[#161725] dark:text-[#E5E7EB]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
