import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import type { Project, ProjectType, ProjectStatus, Priority } from '../../lib/types'

type FormVals = Pick<Project, 'name' | 'type' | 'status' | 'priority' | 'description' | 'due_date'>

interface Props {
  project?: Project
  onSave:   (vals: FormVals) => void
  onClose:  () => void
  loading?: boolean
}

const DEFAULTS: FormVals = {
  name: '', type: 'sourcing', status: 'planning', priority: 'medium',
  description: null, due_date: null,
}

export default function ProjectModal({ project, onSave, onClose, loading }: Props) {
  const [form, setForm] = useState<FormVals>(project ? {
    name: project.name, type: project.type, status: project.status,
    priority: project.priority, description: project.description,
    due_date: project.due_date,
  } : DEFAULTS)

  const set = <K extends keyof FormVals>(k: K, v: FormVals[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.name.trim()) return alert('Project name is required')
    onSave({ ...form, name: form.name.trim() })
  }

  return (
    <Modal
      title={project ? 'Edit Project' : 'New Project'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={loading}>
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGroup label="Project name" required>
          <Input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Vet Protein Range Q3"
            autoFocus
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Type">
            <Select value={form.type} onChange={e => set('type', e.target.value as ProjectType)}>
              <option value="sourcing">📦 Sourcing</option>
              <option value="development">🔬 Development</option>
              <option value="general">📋 General</option>
            </Select>
          </FormGroup>
          <FormGroup label="Priority">
            <Select value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </Select>
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Status">
            <Select value={form.status} onChange={e => set('status', e.target.value as ProjectStatus)}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </Select>
          </FormGroup>
          <FormGroup label="Due date">
            <Input type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value || null)} />
          </FormGroup>
        </FormRow>

        <FormGroup label="Description">
          <Textarea
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value || null)}
            placeholder="Brief overview of this project…"
            rows={3}
          />
        </FormGroup>
      </div>
    </Modal>
  )
}
