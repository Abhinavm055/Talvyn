import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
  FileText,
  User,
  Puzzle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Monitor,
  Sun,
  Moon,
  Check,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore, ThemeMode } from '../../store/themeStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Briefcase, label: 'My Jobs' },
  { to: '/tracker', icon: KanbanSquare, label: 'Tracker' },
  { to: '/resumes', icon: FileText, label: 'Resumes' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/extensions', icon: Puzzle, label: 'Extension' },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const displayName =
    user?.profile?.preferredName ||
    user?.profile?.givenName ||
    user?.profile?.legalFullName ||
    user?.email?.split('@')[0] ||
    'User'

  const avatarUrl = user?.profile?.avatarUrl

  const themeOptions: { mode: ThemeMode; label: string; subtext: string; icon: typeof Monitor }[] = [
    { mode: 'system', label: 'Default', subtext: 'Follow system', icon: Monitor },
    { mode: 'light', label: 'Light', subtext: 'Always light', icon: Sun },
    { mode: 'dark', label: 'Dark', subtext: 'Always dark', icon: Moon },
  ]

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-colors duration-150 select-none">
      {/* Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src="/logotalvyn.png" alt="Talvyn" className="w-8 h-8 rounded-xl object-contain shadow-xs" />
          <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Talvyn</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-4.5 h-4.5 shrink-0 transition-colors',
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  )}
                />
                <span className="flex-1 text-sm">{label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-primary-500 dark:text-primary-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme Section */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <span className="px-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">
          Theme
        </span>
        <div className="space-y-1">
          {themeOptions.map((opt) => {
            const Icon = opt.icon
            const isSelected = theme === opt.mode
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setTheme(opt.mode)}
                className={cn(
                  'w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all border text-xs',
                  isSelected
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0',
                      isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold leading-none">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">
                      {opt.subtext}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-4.5 h-4.5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* User & Sign Out Section */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center shrink-0 ring-1 ring-primary-200 dark:ring-primary-900">
              <span className="text-primary-700 dark:text-primary-300 text-xs font-bold uppercase">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate uppercase tracking-tight">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 mt-1 group"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
