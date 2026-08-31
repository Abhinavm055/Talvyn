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
          <label htmlFor={inputId} className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#858DA0] dark:text-violet-400 shrink-0">
              {icon}
            </div>
          )}
          <select
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-11 text-sm rounded-xl border bg-white dark:bg-[#111522] text-[#11131A] dark:text-[#F5F7FF]',
              'hover:border-[#BFC6D4] dark:hover:border-[#353D50] dark:hover:bg-[#151A29]',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:dark:ring-[#7C3AED] focus:border-transparent dark:focus:bg-[#111522]',
              'transition-all duration-150 cursor-pointer',
              icon ? 'pl-10 pr-8' : 'px-3.5',
              error ? 'border-red-400 focus:ring-red-400' : 'border-[#D9DDE7] dark:border-[#252B3A]',
              props.disabled && 'opacity-60 cursor-not-allowed bg-[#F7F8FC] dark:bg-[#0D101A]',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="dark:bg-[#111522] dark:text-[#737D94]">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="dark:bg-[#111522] dark:text-[#F5F7FF]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-[#858DA0] dark:text-[#737D94]">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
