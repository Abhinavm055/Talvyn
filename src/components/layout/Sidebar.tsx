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
  Monitor,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
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

  const avatarUrl = user?.profile?.avatarUrl || user?.avatarUrl

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

      {/* Theme Section - Sleek Segmented Control */}
      <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <span className="px-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Theme
        </span>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
              theme === 'light'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
            title="Light theme"
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
              theme === 'dark'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
            title="Dark theme"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
              theme === 'system'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
            title="System theme"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* User & Sign Out Section */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xs"
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
