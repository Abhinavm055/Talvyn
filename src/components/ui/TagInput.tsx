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
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border bg-white',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent',
          'transition-colors duration-150',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {safeValue.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="hover:text-primary-900 transition-colors cursor-pointer"
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
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-slate-400">Press Enter or comma to add</p>
    </div>
  )
}
