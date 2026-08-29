import React, { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { X, Check, Search, Plus, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { normalizeTags } from './TagInput'

export interface SmartMultiSelectOption {
  value: string
  label: string
  category?: string
  sublabel?: string
}

export interface SmartMultiSelectProps {
  label?: string
  value?: string[] | string | null
  onChange: (values: string[]) => void
  options?: (SmartMultiSelectOption | string)[]
  loadOptions?: (query: string) => Promise<(SmartMultiSelectOption | string)[]>
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  error?: string
  hint?: string
  disabled?: boolean
  allowCustom?: boolean
  maxItems?: number
}

export function SmartMultiSelect({
  label,
  value,
  onChange,
  options: staticOptions,
  loadOptions,
  placeholder = 'Add or search...',
  className,
  error,
  hint,
  disabled = false,
  allowCustom = true,
  maxItems,
}: SmartMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SmartMultiSelectOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const debounceTimerRef = useRef<number | null>(null)

  // Guarantee that safeValue is always a string array
  const safeValue = normalizeTags(value)

  // Normalize options
  const normalizeOptions = (rawList: (SmartMultiSelectOption | string)[]): SmartMultiSelectOption[] => {
    return rawList.map((item) => {
      if (typeof item === 'string') {
        return { value: item, label: item }
      }
      return item
    })
  }

  // Load or filter options
  useEffect(() => {
    if (!isOpen) return

    if (loadOptions) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

      setIsLoading(true)
      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          const loaded = await loadOptions(query)
          const normalized = normalizeOptions(loaded)
          setItems(normalized)
          setHighlightedIndex(0)
        } catch (err) {
          console.warn('[SmartMultiSelect] Failed to load options:', err)
          setItems([])
        } finally {
          setIsLoading(false)
        }
      }, 150)

      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      }
    } else if (staticOptions) {
      const normalized = normalizeOptions(staticOptions)
      const q = query.trim().toLowerCase()
      if (!q) {
        setItems(normalized)
      } else {
        const filtered = normalized.filter(
          (opt) =>
            opt.label.toLowerCase().includes(q) ||
            opt.value.toLowerCase().includes(q) ||
            opt.category?.toLowerCase().includes(q) ||
            opt.sublabel?.toLowerCase().includes(q)
        )
        setItems(filtered)
      }
      setHighlightedIndex(0)
    }
  }, [query, staticOptions, loadOptions, isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listboxRef.current && highlightedIndex >= 0) {
      const activeEl = listboxRef.current.children[highlightedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (maxItems && safeValue.length >= maxItems) return

    // Prevent duplicate values (case-insensitive check)
    const exists = safeValue.some((v) => v.toLowerCase() === trimmed.toLowerCase())
    if (!exists) {
      onChange([...safeValue, trimmed])
    }
    setQuery('')
    setHighlightedIndex(-1)
  }

  const removeTag = (index: number) => {
    onChange(safeValue.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = showCustomOption ? items.length : items.length - 1
      setHighlightedIndex((prev) => (prev < max ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const max = showCustomOption ? items.length : items.length - 1
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : max))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        addTag(items[highlightedIndex].value)
      } else if (query.trim()) {
        addTag(query.trim())
      }
    } else if (e.key === 'Backspace' && !query && safeValue.length > 0) {
      removeTag(safeValue.length - 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  const isExactMatchInItems = items.some(
    (i) => i.value.toLowerCase() === query.trim().toLowerCase() || i.label.toLowerCase() === query.trim().toLowerCase()
  )

  const showCustomOption =
    allowCustom &&
    query.trim().length > 0 &&
    !isExactMatchInItems &&
    !safeValue.some((v) => v.toLowerCase() === query.trim().toLowerCase())

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl border bg-white',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent',
          'transition-colors duration-150',
          disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'cursor-text',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300'
        )}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        {/* Selected Tags */}
        {safeValue.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-100/60 rounded-lg text-xs font-medium shrink-0 animate-in fade-in duration-100"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(i)
                }}
                className="hover:text-primary-900 transition-colors p-0.5"
                title={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Search / Tag Input */}
        <div className="flex-1 flex items-center min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={safeValue.length === 0 ? placeholder : 'Type to add more...'}
            className="w-full text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {isLoading && <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0 ml-1" />}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && !disabled && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden',
            'animate-in fade-in duration-100 max-h-64 flex flex-col'
          )}
        >
          <ul
            ref={listboxRef}
            role="listbox"
            className="overflow-y-auto py-1.5 divide-y divide-slate-50 text-sm focus:outline-none"
          >
            {items.map((opt, idx) => {
              const isSelected = safeValue.some((v) => v.toLowerCase() === opt.value.toLowerCase())
              const isHighlighted = highlightedIndex === idx

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSelected) {
                      const selIndex = safeValue.findIndex((v) => v.toLowerCase() === opt.value.toLowerCase())
                      if (selIndex >= 0) removeTag(selIndex)
                    } else {
                      addTag(opt.value)
                    }
                  }}
                  className={cn(
                    'px-3.5 py-2 flex items-center justify-between cursor-pointer transition-colors',
                    isHighlighted ? 'bg-primary-50 text-primary-900' : 'text-slate-700 hover:bg-slate-50',
                    isSelected && 'bg-primary-50/50 font-medium text-primary-800'
                  )}
                >
                  <div className="flex flex-col pr-2">
                    <span>{opt.label}</span>
                    {opt.sublabel && <span className="text-xs text-slate-400">{opt.sublabel}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.category && (
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {opt.category}
                      </span>
                    )}
                    {isSelected ? (
                      <Check className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-300 hover:text-primary-600" />
                    )}
                  </div>
                </li>
              )
            })}

            {/* Custom Option */}
            {showCustomOption && (
              <li
                role="option"
                onMouseEnter={() => setHighlightedIndex(items.length)}
                onClick={(e) => {
                  e.stopPropagation()
                  addTag(query.trim())
                }}
                className={cn(
                  'px-3.5 py-2 flex items-center justify-between cursor-pointer border-t border-slate-100 transition-colors',
                  highlightedIndex === items.length ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50/70 text-slate-700 hover:bg-indigo-50/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">Add</span>
                  <span>Add &ldquo;{query.trim()}&rdquo;</span>
                </div>
                <Plus className="w-4 h-4 text-primary-600" />
              </li>
            )}

            {items.length === 0 && !showCustomOption && (
              <li className="px-4 py-3 text-center text-slate-400 text-xs">
                No matching suggestions. Press Enter to add custom item.
              </li>
            )}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
