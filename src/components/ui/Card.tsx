import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ className, hover, padding = 'md', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#111522] rounded-2xl border border-[#E2E5EC] dark:border-[#252B3A] shadow-card dark:shadow-card-dark text-[#11131A] dark:text-[#F5F7FF]',
        hover && 'hover:shadow-card-hover dark:hover:shadow-card-hover-dark hover:-translate-y-0.5 dark:hover:bg-[#151A29] dark:hover:border-[#353D50] transition-all duration-200 cursor-pointer',
        padding === 'none' && '',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3 className={cn('text-base font-semibold text-slate-900 dark:text-[#F5F7FF]', className)} {...props}>
      {children}
    </h3>
  )
}
