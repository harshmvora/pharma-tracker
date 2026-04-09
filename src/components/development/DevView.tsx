import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, Edit2, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import { formatDate, dueDateLabel, initials } from '../../lib/utils'
import type { Project, DevPhase, Task, Priority, PhaseStatus, Profile } from '../../lib/types'

// ── Phase form ────────────────────────────────────────────────
interface PhaseForm { name: string; status: PhaseStatus; start_date: string; end_date: string; description: string }
const BLANK_PHASE: PhaseForm = { name: '', status: 'planned', start_date: '', end_date: '', description: '' }

function PhaseModal({ phase, onSave, onClose, loading }: {
  phase?: DevPhase; onSave: (v: PhaseForm) => void; onClose: () => void; loading?: boolean
}) {
  const [form, setForm] = useState<PhaseForm>(phase ? {
    name: phase.name, status: phase.status,
    start_date: phase.start_date ?? '', end_date: phase.end_date ?? '',
    description: phase.description ?? '',
  } : BLANK_PHASE)
  const set = <K extends keyof PhaseForm>(k: K, v: PhaseForm[K]) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal title={phase ? 'Edit Phase' : 'Add Phase'} onClose={onClose} footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (!form.name.trim()) return alert('Phase name required'); onSave(form) }} loading={loading}>
          {phase ? 'Save' : 'Add Phase'}
        </Button></>
    }>
      <div className="space-y-4">
        <FormGroup label="Phase name" required>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. R&D, Formulation, Regulatory…" autoFocus />
        </FormGroup>
        <FormRow>
          <FormGroup label="Status">
            <Select value={form.status} onChange={e => set('status', e.target.value as PhaseStatus)}>
              <option value="planned">Planned</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Start date"><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></FormGroup>
          <FormGroup label="End date"><Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></FormGroup>
        </FormRow>
        <FormGroup label="Description">
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What happens in this phase?" rows={2} />
        </FormGroup>
      </div>
    </Modal>
  )
}

// ── Task form ─────────────────────────────────────────────────
interface TaskForm { name: string; priority: Priority; due_date: string; assigned_to: string; notes: string }
const BLANK_TASK: TaskForm = { name: '', priority: 'medium', due_date: '', assigned_to: '', notes: '' }

function TaskModal({ task, members, onSave, onClose, loading }: {
  task?: Task; members: Profile[]; onSave: (v: TaskForm) => void; onClose: () => void; loading?: boolean
}) {
  const [form, setForm] = useState<TaskForm>(task ? {
    name: task.name, priority: task.priority,
    due_date: task.due_date ?? '', assigned_to: task.assigned_to ?? '', notes: task.notes ?? '',
  } : BLANK_TASK)
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
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

// ── Phase status colours ─────────────────────────────────────
const PHASE_STATUS_CLS: Record<PhaseStatus, string> = {
  planned:      'bg-sky-50 text-sky-700',
  'in-progress':'bg-blue-50 text-blue-700',
  completed:    'bg-gray-100 text-gray-500',
  'on-hold':    'bg-amber-50 text-amber-700',
}

// ── Main component ────────────────────────────────────────────
export default function DevView({ project }: { project: Project }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [openPhases,   setOpenPhases]   = useState<Record<string, boolean>>({})
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [editPhase,    setEditPhase]    = useState<DevPhase | null>(null)
  const [addTaskFor,   setAddTaskFor]   = useState<string | null>(null)
  const [editTask,     setEditTask]     = useState<Task | null>(null)

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['dev_phases', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dev_phases')
        .select('*, tasks(*,assignee:profiles!tasks_assigned_to_fkey(id,name,email,avatar_url))')
        .eq('project_id', project.id)
        .order('order_index')
      return (data ?? []) as (DevPhase & { tasks: (Task & { assignee?: Profile })[] })[]
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

  const addPhase = useMutation({
    mutationFn: async (v: PhaseForm) => {
      await supabase.from('dev_phases').insert({
        project_id:  project.id,
        name:        v.name.trim(),
        status:      v.status,
        start_date:  v.start_date || null,
        end_date:    v.end_date   || null,
        description: v.description.trim() || null,
        order_index: phases.length,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dev_phases', project.id] }); setShowAddPhase(false) },
  })

  const updatePhase = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: PhaseForm }) => {
      await supabase.from('dev_phases').update({
        name: v.name.trim(), status: v.status,
        start_date: v.start_date || null, end_date: v.end_date || null,
        description: v.description.trim() || null,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dev_phases', project.id] }); setEditPhase(null) },
  })

  const deletePhase = useMutation({
    mutationFn: async (id: string) => { await supabase.from('dev_phases').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev_phases', project.id] }),
  })

  const addTask = useMutation({
    mutationFn: async ({ phaseId, v }: { phaseId: string; v: TaskForm }) => {
      await supabase.from('tasks').insert({
        project_id:  project.id,
        phase_id:    phaseId,
        name:        v.name.trim(),
        priority:    v.priority,
        due_date:    v.due_date    || null,
        assigned_to: v.assigned_to || null,
        notes:       v.notes.trim() || null,
        done: false,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dev_phases', project.id] }); setAddTaskFor(null) },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: TaskForm }) => {
      await supabase.from('tasks').update({
        name: v.name.trim(), priority: v.priority,
        due_date: v.due_date || null,
        assigned_to: v.assigned_to || null,
        notes: v.notes.trim() || null,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dev_phases', project.id] }); setEditTask(null) },
  })

  const toggleTask = async (id: string, done: boolean) => {
    await supabase.from('tasks').update({ done }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['dev_phases', project.id] })
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['dev_phases', project.id] })
  }

  const totalTasks = phases.flatMap(p => p.tasks ?? []).length
  const doneTasks  = phases.flatMap(p => p.tasks ?? []).filter(t => t.done).length

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">🔬 Phases & Milestones ({phases.length})</h3>
            {totalTasks > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">{doneTasks}/{totalTasks} tasks complete</p>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddPhase(true)}>
            <Plus size={13} /> Add Phase
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : phases.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="font-medium text-gray-600">No phases yet</p>
            <p className="text-sm text-gray-400 mt-1">Break your project into phases like R&D, Formulation, Regulatory, Launch…</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {phases.map((phase, idx) => {
              const tasks = phase.tasks ?? []
              const done  = tasks.filter(t => t.done).length
              const pct   = tasks.length ? Math.round((done / tasks.length) * 100) : 0
              const open  = openPhases[phase.id] ?? false

              return (
                <div key={phase.id}>
                  {/* Phase header */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50/70 group"
                    onClick={() => setOpenPhases(s => ({ ...s, [phase.id]: !s[phase.id] }))}
                  >
                    <span className="text-xs font-bold text-gray-300 w-5">#{idx + 1}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{phase.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_STATUS_CLS[phase.status]}`}>
                          {phase.status.replace('-', ' ')}
                        </span>
                        {(phase.start_date || phase.end_date) && (
                          <span className="text-xs text-gray-400">
                            {phase.start_date && formatDate(phase.start_date)}
                            {phase.start_date && phase.end_date && ' → '}
                            {phase.end_date && formatDate(phase.end_date)}
                          </span>
                        )}
                      </div>
                      {tasks.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 max-w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{done}/{tasks.length}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditPhase(phase)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => { if (confirm('Delete phase and all its tasks?')) deletePhase.mutate(phase.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                  </div>

                  {/* Tasks */}
                  {open && (
                    <div className="bg-gray-50/60 border-t border-gray-100 px-5 py-3">
                      {phase.description && <p className="text-xs text-gray-500 mb-3">{phase.description}</p>}

                      {tasks.map(t => {
                        const tDue = dueDateLabel(t.due_date)
                        return (
                          <div key={t.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 group">
                            <button
                              onClick={() => toggleTask(t.id, !t.done)}
                              className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                t.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {t.done && <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5"><path d="M1 6l4 4 6-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {t.priority !== 'medium' && (
                                  <span className={`text-xs ${t.priority === 'high' ? 'text-red-500' : 'text-gray-400'}`}>
                                    {t.priority === 'high' ? '🔴' : '⚪'} {t.priority}
                                  </span>
                                )}
                                {t.due_date && <span className={`text-xs ${tDue.cls}`}>{tDue.label}</span>}
                                {t.assignee && (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                    <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs">
                                      {initials(t.assignee.name ?? t.assignee.email)}
                                    </span>
                                    {t.assignee.name ?? t.assignee.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditTask(t)} className="p-1 rounded hover:bg-gray-200 text-gray-400"><Edit2 size={11} /></button>
                              <button onClick={() => { if (confirm('Delete task?')) deleteTask(t.id) }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        )
                      })}

                      <button
                        onClick={() => setAddTaskFor(phase.id)}
                        className="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
                      >
                        <Plus size={11} /> Add task
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddPhase && <PhaseModal onSave={v => addPhase.mutate(v)} onClose={() => setShowAddPhase(false)} loading={addPhase.isPending} />}
      {editPhase    && <PhaseModal phase={editPhase} onSave={v => updatePhase.mutate({ id: editPhase.id, v })} onClose={() => setEditPhase(null)} loading={updatePhase.isPending} />}
      {addTaskFor   && <TaskModal members={members} onSave={v => addTask.mutate({ phaseId: addTaskFor, v })} onClose={() => setAddTaskFor(null)} loading={addTask.isPending} />}
      {editTask     && <TaskModal task={editTask} members={members} onSave={v => updateTask.mutate({ id: editTask.id, v })} onClose={() => setEditTask(null)} loading={updateTask.isPending} />}
    </>
  )
}
