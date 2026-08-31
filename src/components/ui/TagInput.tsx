import React, { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface TagInputProps {
  label?: string
  value?: string[] | string | null
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  error?: string
}

/**
 * Safely normalizes any input value into a clean string array.
 * Handles:
 * - string[] -> filtered string[]
 * - JSON array string (e.g. '["a","b"]', '[]') -> parsed string[]
 * - comma-separated string (e.g. 'a, b') -> parsed string[]
 * - single string (e.g. 'Software Engineer') -> [trimmed]
 * - null / undefined / malformed JSON -> []
 */
export function normalizeTags(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter((item) => item.length > 0)
  }

  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed === '[]' || trimmed === '{}') return []

    // Try parsing as JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
            .filter((item) => item.length > 0)
        }
      } catch {
        // Fallback below
      }
    }

    // Comma-separated string
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    }

    // Single non-empty string value
    return [trimmed]
  }

  return []
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  className,
  error,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  // Guarantee that safeValue is always a valid string array
  const safeValue = normalizeTags(value)

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !safeValue.includes(trimmed)) {
      onChange([...safeValue, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (index: number) => {
    onChange(safeValue.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && safeValue.length > 0) {
      removeTag(safeValue.length - 1)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && <label className="text-xs sm:text-sm font-medium text-[#11131A] dark:text-[#F5F7FF]">{label}</label>}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border bg-white dark:bg-[#111522]',
          'hover:border-[#BFC6D4] dark:hover:border-[#353D50] dark:hover:bg-[#151A29]',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:dark:ring-[#7C3AED] focus-within:border-transparent dark:focus-within:bg-[#111522]',
          'transition-all duration-150',
          error ? 'border-red-400' : 'border-[#D9DDE7] dark:border-[#252B3A]'
        )}
      >
        {safeValue.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-violet-950/70 text-primary-700 dark:text-violet-300 border border-primary-200/60 dark:border-violet-800/60 rounded-lg text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="hover:text-primary-900 dark:hover:text-violet-100 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={safeValue.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent text-[#11131A] dark:text-[#F5F7FF] placeholder:text-[#858DA0] dark:placeholder-[#737D94]"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-[#858DA0] dark:text-[#737D94]">Press Enter or comma to add</p>
    </div>
  )
}
