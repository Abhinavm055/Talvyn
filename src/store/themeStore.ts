import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
}

const STORAGE_KEY = 'talvyn_theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'dark'
}

function applyThemeToDOM(theme: ThemeMode): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement

  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  return resolved
}

export const useThemeStore = create<ThemeState>((set) => {
  const initialTheme = getStoredTheme()
  const initialResolved = applyThemeToDOM(initialTheme)

  // Listen for system theme changes if on 'system'
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      const currentTheme = getStoredTheme()
      if (currentTheme === 'system') {
        const resolved = applyThemeToDOM('system')
        set({ resolvedTheme: resolved })
      }
    })
  }

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    setTheme: (theme: ThemeMode) => {
      localStorage.setItem(STORAGE_KEY, theme)
      const resolved = applyThemeToDOM(theme)
      set({ theme, resolvedTheme: resolved })
    },
  }
})
