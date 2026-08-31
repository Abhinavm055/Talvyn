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
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-white dark:bg-[#0D101A] border-r border-[#E2E5EC] dark:border-[#252B3A] transition-colors duration-150 select-none">
      {/* Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#E2E5EC] dark:border-[#252B3A]">
        <div className="flex items-center gap-2.5">
          <img src="/logotalvyn.png" alt="Talvyn" className="w-8 h-8 rounded-xl object-contain shadow-xs" />
          <span className="text-lg font-bold text-slate-900 dark:text-[#F5F7FF] tracking-tight">Talvyn</span>
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
                  ? 'bg-primary-50 dark:bg-violet-950/50 text-primary-700 dark:text-violet-200 font-semibold border border-primary-200/60 dark:border-violet-500/30'
                  : 'text-[#5E6678] dark:text-[#A8B0C2] hover:bg-[#F1F3F8] dark:hover:bg-[#151A29] hover:text-[#11131A] dark:hover:text-[#F5F7FF]'
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
                      : 'text-[#858DA0] dark:text-[#737D94] group-hover:text-primary-600 dark:group-hover:text-violet-300'
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
      <div className="px-3 py-2.5 border-t border-[#E2E5EC] dark:border-[#252B3A] space-y-1.5">
        <span className="px-1 text-[11px] font-semibold text-[#858DA0] dark:text-[#737D94] uppercase tracking-wider">
          Theme
        </span>
        <div className="grid grid-cols-3 gap-1 bg-[#F1F3F8] dark:bg-[#111522] p-1 rounded-xl border border-[#E2E5EC] dark:border-[#252B3A]">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer',
              theme === 'light'
                ? 'bg-white text-slate-900 border border-[#E2E5EC] shadow-xs'
                : 'text-[#5E6678] dark:text-[#A8B0C2] hover:text-[#11131A] dark:hover:text-[#F5F7FF]'
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
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-xs'
                : 'text-[#5E6678] dark:text-[#A8B0C2] hover:text-[#11131A] dark:hover:text-[#F5F7FF]'
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
                ? 'bg-primary-600/20 dark:bg-violet-600/30 text-primary-700 dark:text-violet-200 border border-primary-300/50 dark:border-violet-500/40 shadow-xs'
                : 'text-[#5E6678] dark:text-[#A8B0C2] hover:text-[#11131A] dark:hover:text-[#F5F7FF]'
            )}
            title="System theme"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* User & Sign Out Section */}
      <div className="p-3 border-t border-[#E2E5EC] dark:border-[#252B3A]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-[#252B3A] shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-violet-950/70 flex items-center justify-center shrink-0 ring-1 ring-primary-200 dark:ring-violet-800/40">
              <span className="text-primary-700 dark:text-violet-300 text-xs font-bold uppercase">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-[#F5F7FF] truncate uppercase tracking-tight">
              {displayName}
            </p>
            <p className="text-[11px] text-[#858DA0] dark:text-[#737D94] truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#5E6678] dark:text-[#A8B0C2] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 mt-1 group cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-[#858DA0] group-hover:text-red-500 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
