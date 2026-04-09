import { daysUntil } from '../../lib/utils'
import type { Project } from '../../lib/types'

interface Props { projects: Project[] }

export default function StatsRow({ projects }: Props) {
  const total     = projects.length
  const active    = projects.filter(p => p.status === 'active').length
  const highPri   = projects.filter(p => p.priority === 'high' && p.status !== 'completed').length
  const dueSoon   = projects.filter(p => { const d = daysUntil(p.due_date); return d !== null && d >= 0 && d <= 7 }).length
  const overdue   = projects.filter(p => { const d = daysUntil(p.due_date); return d !== null && d < 0 && p.status !== 'completed' }).length

  const stats = [
    { label: 'Total Projects', value: total,   sub: `${active} active`,             color: 'text-gray-900'  },
    { label: 'Active',         value: active,   sub: 'in progress',                  color: 'text-green-600' },
    { label: 'High Priority',  value: highPri,  sub: overdue ? `${overdue} overdue` : 'on track', color: highPri ? 'text-red-500' : 'text-gray-900' },
    { label: 'Due This Week',  value: dueSoon,  sub: 'upcoming deadlines',           color: dueSoon ? 'text-amber-500' : 'text-gray-900' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
          <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}
