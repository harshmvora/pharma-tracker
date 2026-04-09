import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import { dueDateLabel, initials } from '../../lib/utils'
import type { Project, Task, Priority, Profile } from '../../lib/types'

interface TaskForm { name: string; priority: Priority; due_date: string; assigned_to: string; notes: string }
const BLANK: TaskForm = { name: '', priority: 'medium', due_date: '', assigned_to: '', notes: '' }

function TaskModal({ task, members, onSave, onClose, loading }: {
  task?: Task; members: Profile[]; onSave: (v: TaskForm) => void; onClose: () => void; loading?: boolean
}) {
  const [form, setForm] = useState<TaskForm>(task ? {
    name: task.name, priority: task.priority,
    due_date: task.due_date ?? '', assigned_to: task.assigned_to ?? '', notes: task.notes ?? '',
  } : BLANK)
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={task ? 'Edit Task' : 'Add Task'} onClose={onClose} size="sm" footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (!form.name.trim()) return alert('Task required'); onSave(form) }} loading={loading}>
          {task ? 'Save' : 'Add'}
        </Button></>
    }>
      <div className="space-y-3">
        <FormGroup label="Task" required>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="What needs to be done?" autoFocus />
        </FormGroup>
        <FormRow>
          <FormGroup label="Priority">
            <Select value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </Select>
          </FormGroup>
          <FormGroup label="Due date">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </FormGroup>
        </FormRow>
        {members.length > 0 && (
          <FormGroup label="Assign to">
            <Select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">— Unassigned —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </Select>
          </FormGroup>
        )}
        <FormGroup label="Notes">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

export default function GeneralView({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [showAdd,  setShowAdd]  = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(id,name,email,avatar_url)')
        .eq('project_id', project.id)
        .is('phase_id', null)
        .order('created_at')
      return (data ?? []) as (Task & { assignee?: Profile })[]
    },
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_members')
        .select('profile:profiles(id, name, email, avatar_url)')
        .eq('project_id', project.id)
      return (data ?? []).map((m: any) => m.profile as Profile).filter(Boolean)
    },
  })

  const addTask = useMutation({
    mutationFn: async (v: TaskForm) => {
      await supabase.from('tasks').insert({
        project_id: project.id, phase_id: null,
        name: v.name.trim(), priority: v.priority,
        due_date: v.due_date || null, assigned_to: v.assigned_to || null,
        notes: v.notes.trim() || null, done: false,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', project.id] }); setShowAdd(false) },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: TaskForm }) => {
      await supabase.from('tasks').update({
        name: v.name.trim(), priority: v.priority,
        due_date: v.due_date || null, assigned_to: v.assigned_to || null,
        notes: v.notes.trim() || null,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', project.id] }); setEditTask(null) },
  })

  const toggleTask = async (id: string, done: boolean) => {
    await supabase.from('tasks').update({ done }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['tasks', project.id] })
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['tasks', project.id] })
  }

  const done = tasks.filter(t => t.done).length

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">📋 Tasks ({tasks.length})</h3>
            {tasks.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{done} of {tasks.length} done</p>}
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Task
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-medium text-gray-600">No tasks yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tasks.map(t => {
              const due = dueDateLabel(t.due_date)
              return (
                <div key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 group">
                  <button
                    onClick={() => toggleTask(t.id, !t.done)}
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      t.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {t.done && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M1 6l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {t.priority === 'high' && <span className="text-xs text-red-500">🔴 High</span>}
                      {t.due_date && <span className={`text-xs ${due.cls}`}>{due.label}</span>}
                      {t.assignee && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs">
                            {initials(t.assignee.name ?? t.assignee.email)}
                          </span>
                          {t.assignee.name ?? t.assignee.email}
                        </span>
                      )}
                      {t.notes && <span className="text-xs text-gray-400 italic">{t.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditTask(t)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400"><Edit2 size={12} /></button>
                    <button onClick={() => { if (confirm('Delete task?')) deleteTask(t.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd  && <TaskModal members={members} onSave={v => addTask.mutate(v)}                           onClose={() => setShowAdd(false)}  loading={addTask.isPending}    />}
      {editTask && <TaskModal task={editTask} members={members} onSave={v => updateTask.mutate({ id: editTask.id, v })} onClose={() => setEditTask(null)}  loading={updateTask.isPending} />}
    </>
  )
}
