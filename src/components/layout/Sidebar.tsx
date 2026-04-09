import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, FlaskConical, ClipboardList,
  CheckSquare, Database, LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { initials } from '../../lib/utils'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/products', icon: Database,         label: 'Products & Prices' },
  { to: '/todos',    icon: CheckSquare,      label: 'My Todos'   },
  { to: '/my-tasks', icon: ClipboardList,    label: 'My Tasks'   },
]

const TYPE_LINKS = [
  { to: '/?type=sourcing',     icon: Package,      label: 'Sourcing'     },
  { to: '/?type=development',  icon: FlaskConical, label: 'Development'  },
  { to: '/?type=general',      icon: ClipboardList,label: 'General'      },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col fixed left-0 top-0 bottom-0 z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-base">💊</div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">PharmaTrack</div>
            <div className="text-white/40 text-xs">Ops Tracker</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/8'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/25 mb-1">
            Project types
          </p>
        </div>
        {TYPE_LINKS.map(({ to, icon: Icon, label }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Icon size={16} />
            {label}
            <ChevronRight size={12} className="ml-auto opacity-40" />
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials(profile?.name ?? profile?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{profile?.name ?? 'User'}</div>
            <div className="text-white/40 text-xs truncate">{profile?.email}</div>
          </div>
          <button
            onClick={signOut}
            className="text-white/30 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
