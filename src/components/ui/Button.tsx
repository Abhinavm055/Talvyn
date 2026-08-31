import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none'

    const variants = {
      primary: 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white focus:ring-primary-500 shadow-sm font-semibold',
      secondary: 'bg-[#F1F3F8] hover:bg-[#E2E5EC] text-[#11131A] dark:bg-[#151A29] dark:hover:bg-[#1C2234] dark:text-[#F5F7FF] dark:border dark:border-[#252B3A] focus:ring-primary-500',
      ghost: 'text-[#5E6678] hover:bg-[#F1F3F8] hover:text-[#11131A] dark:text-[#A8B0C2] dark:hover:bg-[#151A29] dark:hover:text-[#F5F7FF] focus:ring-slate-400',
      danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus:ring-red-500 shadow-sm font-semibold',
      outline: 'border border-[#E2E5EC] text-[#11131A] hover:bg-[#F7F8FC] hover:border-[#D9DDE7] dark:bg-[#111522] dark:border-[#252B3A] dark:text-[#F5F7FF] dark:hover:bg-[#151A29] dark:hover:border-[#353D50] focus:ring-slate-400 bg-white',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-11 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          <span className="w-4 h-4 flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
