import React, { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { ChevronDown, X, Check, Search, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SmartComboboxOption {
  value: string
  label: string
  category?: string
  sublabel?: string
}

export interface SmartComboboxProps {
  label?: string
  value?: string | null
  onChange: (value: string) => void
  options?: (SmartComboboxOption | string)[]
  loadOptions?: (query: string) => Promise<(SmartComboboxOption | string)[]>
  placeholder?: string
  className?: string
  error?: string
  hint?: string
  disabled?: boolean
  allowCustom?: boolean
  clearable?: boolean
}

export function SmartCombobox({
  label,
  value,
  onChange,
  options: staticOptions,
  loadOptions,
  placeholder = 'Select or type to search...',
  className,
  error,
  hint,
  disabled = false,
  allowCustom = true,
  clearable = true,
}: SmartComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SmartComboboxOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const debounceTimerRef = useRef<number | null>(null)

  // Normalize option array
  const normalizeOptions = (rawList: (SmartComboboxOption | string)[]): SmartComboboxOption[] => {
    return rawList.map((item) => {
      if (typeof item === 'string') {
        return { value: item, label: item }
      }
      return item
    })
  }

  // Synchronize internal query with external value when not focused
  useEffect(() => {
    if (!isOpen) {
      setQuery(value || '')
    }
  }, [value, isOpen])

  // Filter or load options based on query
  useEffect(() => {
    if (loadOptions) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

      setIsLoading(true)
      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          const loaded = await loadOptions(query)
          setItems(normalizeOptions(loaded))
          setHighlightedIndex(0)
        } catch (err) {
          console.warn('[SmartCombobox] Failed to load options:', err)
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
            opt.sublabel?.toLowerCase().includes(q) ||
            opt.category?.toLowerCase().includes(q)
        )
        setItems(filtered)
      }
      setHighlightedIndex(0)
    }
  }, [query, staticOptions, loadOptions])

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

  const handleSelect = (val: string) => {
    onChange(val)
    setQuery(val)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true)
        return
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          const max = allowCustom && query.trim() ? items.length : items.length - 1
          return prev < max ? prev + 1 : 0
        })
        break

      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          const max = allowCustom && query.trim() ? items.length : items.length - 1
          return prev > 0 ? prev - 1 : max
        })
        break

      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          handleSelect(items[highlightedIndex].value)
        } else if (allowCustom && query.trim()) {
          handleSelect(query.trim())
        }
        break

      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break

      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  const isExactMatchInItems = items.some(
    (i) => i.value.toLowerCase() === query.trim().toLowerCase() || i.label.toLowerCase() === query.trim().toLowerCase()
  )

  const showCustomOption = allowCustom && query.trim().length > 0 && !isExactMatchInItems

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

      <div
        className={cn(
          'relative flex items-center min-h-[42px] px-3 py-1.5 rounded-xl border bg-white',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent',
          'transition-all duration-150',
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
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />

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
          placeholder={placeholder}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
          className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
        />

        {isLoading ? (
          <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0 ml-1.5" />
        ) : (
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {clearable && query && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={cn('w-4 h-4 text-slate-400 transition-transform duration-150', isOpen && 'rotate-180')}
            />
          </div>
        )}
      </div>

      {/* Floating Dropdown Listbox */}
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
              const isSelected = value === opt.value
              const isHighlighted = highlightedIndex === idx

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(opt.value)
                  }}
                  className={cn(
                    'px-3.5 py-2 flex items-center justify-between cursor-pointer transition-colors',
                    isHighlighted ? 'bg-primary-50 text-primary-900' : 'text-slate-700 hover:bg-slate-50',
                    isSelected && 'font-semibold text-primary-700'
                  )}
                >
                  <div className="flex flex-col pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && <span className="text-xs text-slate-400">{opt.sublabel}</span>}
                  </div>
                  {opt.category && (
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {opt.category}
                    </span>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-primary-600 shrink-0 ml-2" />}
                </li>
              )
            })}

            {/* Custom Input Fallback Option */}
            {showCustomOption && (
              <li
                role="option"
                onMouseEnter={() => setHighlightedIndex(items.length)}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(query.trim())
                }}
                className={cn(
                  'px-3.5 py-2 flex items-center justify-between cursor-pointer border-t border-slate-100 transition-colors',
                  highlightedIndex === items.length ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50/70 text-slate-700 hover:bg-indigo-50/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">Custom</span>
                  <span>Use &ldquo;{query.trim()}&rdquo;</span>
                </div>
              </li>
            )}

            {items.length === 0 && !showCustomOption && (
              <li className="px-4 py-3 text-center text-slate-400 text-xs">
                No matching results found.
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
