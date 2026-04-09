import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import TopBar from '../layout/TopBar'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Input, Select, FormGroup, FormRow } from '../ui/Input'
import { dueDateLabel } from '../../lib/utils'
import type { Todo, Priority } from '../../lib/types'

interface TodoForm { name: string; priority: Priority; due_date: string; notes: string }
const BLANK: TodoForm = { name: '', priority: 'medium', due_date: '', notes: '' }

function TodoModal({ todo, onSave, onClose, loading }: {
  todo?: Todo; onSave: (v: TodoForm) => void; onClose: () => void; loading?: boolean
}) {
  const [form, setForm] = useState<TodoForm>(todo
    ? { name: todo.name, priority: todo.priority, due_date: todo.due_date ?? '', notes: todo.notes ?? '' }
    : BLANK)
  const set = <K extends keyof TodoForm>(k: K, v: TodoForm[K]) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal title={todo ? 'Edit Todo' : 'New Todo'} onClose={onClose} size="sm" footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (!form.name.trim()) return alert('Required'); onSave(form) }} loading={loading}>
          {todo ? 'Save' : 'Add'}
        </Button></>
    }>
      <div className="space-y-3">
        <FormGroup label="Todo" required>
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
        <FormGroup label="Notes">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

type Filter = 'active' | 'all' | 'done'

export default function QuickTodos() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filter,  setFilter]  = useState<Filter>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [editTodo, setEditTodo] = useState<Todo | null>(null)
  const [quick,   setQuick]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: todos = [] } = useQuery({
    queryKey: ['todos', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as Todo[]
    },
    enabled: !!user,
  })

  const addQuick = useMutation({
    mutationFn: async () => {
      if (!quick.trim()) return
      await supabase.from('todos').insert({ user_id: user!.id, name: quick.trim(), priority: 'medium' })
      setQuick('')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })

  const addFull = useMutation({
    mutationFn: async (v: TodoForm) => {
      await supabase.from('todos').insert({
        user_id: user!.id, name: v.name.trim(), priority: v.priority,
        due_date: v.due_date || null, notes: v.notes.trim() || null,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos'] }); setShowAdd(false) },
  })

  const updateTodo = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: TodoForm }) => {
      await supabase.from('todos').update({
        name: v.name.trim(), priority: v.priority,
        due_date: v.due_date || null, notes: v.notes.trim() || null,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos'] }); setEditTodo(null) },
  })

  const toggleTodo = async (id: string, done: boolean) => {
    await supabase.from('todos').update({ done }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['todos'] })
  }

  const deleteTodo = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['todos'] })
  }

  const filtered = todos.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done
  )
  const activeCount = todos.filter(t => !t.done).length

  return (
    <>
      <TopBar
        title="Quick Todos"
        subtitle={`${activeCount} active`}
        actions={<Button variant="primary" size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Full form</Button>}
      />

      <div className="flex-1 p-6 max-w-2xl">
        {/* Quick add */}
        <div className="flex gap-2 mb-5">
          <input
            ref={inputRef}
            value={quick}
            onChange={e => setQuick(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addQuick.mutate()}
            placeholder="Quick add a todo… (press Enter)"
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          <Button variant="primary" onClick={() => addQuick.mutate()} disabled={!quick.trim()}>
            Add
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(['active', 'all', 'done'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'active' && activeCount > 0 && ` (${activeCount})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-500 font-medium">
                {filter === 'done' ? 'No completed todos' : 'All clear! Nothing pending.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(t => {
                const due = dueDateLabel(t.due_date)
                return (
                  <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/60 group">
                    <button
                      onClick={() => toggleTodo(t.id, !t.done)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        t.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {t.done && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M1 6l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.priority === 'high' && <span className="text-xs text-red-500">🔴 High</span>}
                        {t.due_date && <span className={`text-xs ${due.cls}`}>{due.label}</span>}
                        {t.notes && <span className="text-xs text-gray-400 italic">{t.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTodo(t)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400"><Edit2 size={12} /></button>
                      <button onClick={() => deleteTodo(t.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd  && <TodoModal onSave={v => addFull.mutate(v)}                             onClose={() => setShowAdd(false)}  loading={addFull.isPending}    />}
      {editTodo && <TodoModal todo={editTodo} onSave={v => updateTodo.mutate({ id: editTodo.id, v })} onClose={() => setEditTodo(null)}  loading={updateTodo.isPending} />}
    </>
  )
}
