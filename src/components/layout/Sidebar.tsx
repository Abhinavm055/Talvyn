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
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-white dark:bg-[#11121A] border-r border-slate-100 dark:border-[#1E1E2A] transition-colors duration-150 select-none">
      {/* Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-[#1E1E2A]">
        <div className="flex items-center gap-2.5">
          <img src="/logotalvyn.png" alt="Talvyn" className="w-8 h-8 rounded-xl object-contain shadow-xs" />
          <span className="text-lg font-bold text-slate-900 dark:text-[#E5E7EB] tracking-tight">Talvyn</span>
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
                  ? 'bg-primary-50 dark:bg-violet-950/40 text-primary-700 dark:text-violet-300 font-semibold border border-transparent dark:border-violet-500/20'
                  : 'text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-[#161725] hover:text-slate-900 dark:hover:text-[#E5E7EB]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-4.5 h-4.5 shrink-0 transition-colors',
                    isActive
                      ? 'text-primary-600 dark:text-violet-400'
                      : 'text-slate-400 dark:text-[#71717A] group-hover:text-slate-600 dark:group-hover:text-violet-300'
                  )}
                />
                <span className="flex-1 text-sm">{label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-primary-500 dark:text-violet-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme Section - Sleek Segmented Control */}
      <div className="px-3 py-2.5 border-t border-slate-100 dark:border-[#1E1E2A] space-y-1.5">
        <span className="px-1 text-[11px] font-semibold text-slate-400 dark:text-[#71717A] uppercase tracking-wider">
          Theme
        </span>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#161725] p-1 rounded-xl border border-slate-200/60 dark:border-[#1E1E2A]">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer',
              theme === 'light'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
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
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer',
              theme === 'dark'
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30 shadow-xs'
                : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
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
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer',
              theme === 'system'
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30 shadow-xs'
                : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            )}
            title="System theme"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* User & Sign Out Section */}
      <div className="p-3 border-t border-slate-100 dark:border-[#1E1E2A]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-[#1E1E2A] shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-violet-950/70 flex items-center justify-center shrink-0 ring-1 ring-primary-200 dark:ring-violet-800/40">
              <span className="text-primary-700 dark:text-violet-300 text-xs font-bold uppercase">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-[#E5E7EB] truncate uppercase tracking-tight">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-[#71717A] truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-[#A1A1AA] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 mt-1 group cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
