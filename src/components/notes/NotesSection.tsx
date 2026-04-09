import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import { formatDate } from '../../lib/utils'
import type { Project, Note, NoteType } from '../../lib/types'

const NOTE_ICONS: Record<NoteType, string> = {
  note: '📝', email: '📧', call: '📞', meeting: '🤝', action: '⚡',
}

interface NoteForm { type: NoteType; title: string; content: string; date: string }
const today = () => new Date().toISOString().split('T')[0]

function NoteModal({ note, onSave, onClose, loading }: {
  note?: Note; onSave: (v: NoteForm) => void; onClose: () => void; loading?: boolean
}) {
  const [form, setForm] = useState<NoteForm>(note ? {
    type: note.type, title: note.title, content: note.content ?? '', date: note.date,
  } : { type: 'note', title: '', content: '', date: today() })
  const set = <K extends keyof NoteForm>(k: K, v: NoteForm[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={note ? 'Edit Entry' : 'Add Communication Entry'} onClose={onClose} size="lg" footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (!form.title.trim()) return alert('Title required'); onSave(form) }} loading={loading}>
          {note ? 'Save' : 'Save Entry'}
        </Button></>
    }>
      <div className="space-y-4">
        <FormRow>
          <FormGroup label="Type">
            <Select value={form.type} onChange={e => set('type', e.target.value as NoteType)}>
              <option value="note">📝 Note</option>
              <option value="email">📧 Email</option>
              <option value="call">📞 Call</option>
              <option value="meeting">🤝 Meeting</option>
              <option value="action">⚡ Action Item</option>
            </Select>
          </FormGroup>
          <FormGroup label="Date">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Title / Subject" required>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Supplier follow-up on pricing" autoFocus />
        </FormGroup>
        <FormGroup label="Content">
          <Textarea
            value={form.content}
            onChange={e => set('content', e.target.value)}
            rows={6}
            placeholder="Paste email content, meeting notes, action items, or any relevant information…"
          />
        </FormGroup>
      </div>
    </Modal>
  )
}

export default function NotesSection({ project }: { project: Project }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showAdd,  setShowAdd]  = useState(false)
  const [editNote, setEditNote] = useState<Note | null>(null)

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*, creator:profiles!notes_created_by_fkey(id, name, email)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as Note[]
    },
  })

  const addNote = useMutation({
    mutationFn: async (v: NoteForm) => {
      await supabase.from('notes').insert({
        project_id: project.id, created_by: user!.id,
        type: v.type, title: v.title.trim(),
        content: v.content.trim() || null, date: v.date,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes', project.id] }); setShowAdd(false) },
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: NoteForm }) => {
      await supabase.from('notes').update({
        type: v.type, title: v.title.trim(),
        content: v.content.trim() || null, date: v.date,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes', project.id] }); setEditNote(null) },
  })

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['notes', project.id] })
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📧 Communication Log ({notes.length})</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Entry
          </Button>
        </div>

        {notes.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">📬</p>
            <p className="font-medium text-gray-600">No entries yet</p>
            <p className="text-sm text-gray-400 mt-1">Log emails, calls, meetings, and action items here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notes.map(n => (
              <div key={n.id} className="px-5 py-4 group hover:bg-gray-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{NOTE_ICONS[n.type]}</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{n.type}</span>
                      <span className="text-xs text-gray-400">{formatDate(n.date)}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-900">{n.title}</p>
                    {n.content && (
                      <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => setEditNote(n)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400"><Edit2 size={12} /></button>
                    <button onClick={() => { if (confirm('Delete this entry?')) deleteNote(n.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd  && <NoteModal onSave={v => addNote.mutate(v)}                            onClose={() => setShowAdd(false)}  loading={addNote.isPending}    />}
      {editNote && <NoteModal note={editNote} onSave={v => updateNote.mutate({ id: editNote.id, v })} onClose={() => setEditNote(null)}  loading={updateNote.isPending} />}
    </>
  )
}
