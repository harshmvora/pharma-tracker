import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import TopBar from '../layout/TopBar'
import { dueDateLabel } from '../../lib/utils'
import type { Task, Project } from '../../lib/types'

export default function MyTasks() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my_tasks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, project:projects(id, name, type)')
        .eq('assigned_to', user!.id)
        .eq('done', false)
        .order('due_date', { ascending: true, nullsFirst: false })
      return (data ?? []) as (Task & { project?: Pick<Project, 'id' | 'name' | 'type'> })[]
    },
    enabled: !!user,
  })

  const toggleTask = async (id: string) => {
    await supabase.from('tasks').update({ done: true }).eq('id', id)
  }

  const TYPE_ICONS: Record<string, string> = { sourcing: '📦', development: '🔬', general: '📋' }

  return (
    <>
      <TopBar
        title="My Tasks"
        subtitle="Tasks assigned to you across all projects"
      />
      <div className="flex-1 p-6 max-w-2xl">
        {isLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-semibold text-gray-700">No tasks assigned to you</p>
            <p className="text-sm text-gray-400 mt-1">When teammates assign tasks to you, they'll appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {tasks.map(t => {
              const due = dueDateLabel(t.due_date)
              return (
                <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/60 group">
                  <button
                    onClick={() => toggleTask(t.id)}
                    className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 hover:border-green-400 flex-shrink-0 transition-colors"
                    title="Mark done"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {t.project && (
                        <button
                          onClick={() => navigate(`/projects/${t.project!.id}`)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          {TYPE_ICONS[t.project.type]} {t.project.name}
                        </button>
                      )}
                      {t.priority === 'high' && <span className="text-xs text-red-500">🔴 High</span>}
                      {t.due_date && <span className={`text-xs ${due.cls}`}>{due.label}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
