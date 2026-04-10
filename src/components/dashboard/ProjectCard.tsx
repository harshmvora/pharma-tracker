import { Trash2, ChevronRight, Calendar } from 'lucide-react'
import Badge, { typeLabel, statusLabel, priorityLabel } from '../ui/Badge'
import { dueDateLabel, initials } from '../../lib/utils'
import type { Project } from '../../lib/types'

const TYPE_ICONS: Record<string, string> = {
  sourcing: '📦', development: '🔬', general: '📋',
}

interface Props {
  project:        Project
  onClick:        () => void
  onDelete:       () => void
  currentUserId?: string
}

export default function ProjectCard({ project, onClick, onDelete, currentUserId }: Props) {
  const due = dueDateLabel(project.due_date)

  const isSharedWithMe =
    !!currentUserId &&
    project.owner_id !== currentUserId &&
    (project.members ?? []).some(m => m.user_id === currentUserId)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-brand-400 hover:shadow-sm transition-all group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
          project.type === 'sourcing'    ? 'bg-blue-50' :
          project.type === 'development' ? 'bg-emerald-50' : 'bg-violet-50'
        }`}>
          {TYPE_ICONS[project.type]}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate pr-2">{project.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge variant={project.type}>{typeLabel(project.type)}</Badge>
            <Badge variant={project.status}>{statusLabel(project.status)}</Badge>
            <Badge variant={project.priority}>{priorityLabel(project.priority)}</Badge>
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${due.cls}`}>
            <Calendar size={11} />
            {due.label}
          </span>
          {isSharedWithMe && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
              Shared with me
            </span>
          )}
        </div>

        {/* Members avatars */}
        <div className="flex items-center gap-1">
          {(project.members ?? []).slice(0, 4).map(m => (
            <div
              key={m.user_id}
              title={m.profile?.name ?? m.profile?.email ?? ''}
              className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white"
            >
              {initials(m.profile?.name ?? m.profile?.email)}
            </div>
          ))}
          <ChevronRight size={14} className="text-gray-400 ml-1" />
        </div>
      </div>
    </div>
  )
}
