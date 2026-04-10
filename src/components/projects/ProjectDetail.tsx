import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Edit2, Trash2, Users, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import TopBar from '../layout/TopBar'
import Button from '../ui/Button'
import Badge, { typeLabel, statusLabel, priorityLabel } from '../ui/Badge'
import ProjectModal from './ProjectModal'
import MembersModal from './MembersModal'
import SourcingView from '../sourcing/SourcingView'
import DevView from '../development/DevView'
import GeneralView from '../general/GeneralView'
import NotesSection from '../notes/NotesSection'
import { dueDateLabel, formatDate } from '../../lib/utils'
import type { Project } from '../../lib/types'

const TYPE_ICONS: Record<string, string> = {
  sourcing: '📦', development: '🔬', general: '📋',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [showEdit,    setShowEdit]    = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, name, email, avatar_url),
          members:project_members(user_id, role, profile:profiles(id, name, email, avatar_url))
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Project
    },
    enabled: !!id,
  })

  // Real-time: subscribe to changes on projects, project_members, and sourcing_items for this project
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`project-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${id}` },
        () => { qc.invalidateQueries({ queryKey: ['project', id] }) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_members', filter: `project_id=eq.${id}` },
        () => { qc.invalidateQueries({ queryKey: ['project', id] }) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sourcing_items', filter: `project_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ['project', id] })
          qc.invalidateQueries({ queryKey: ['sourcing_items', id] })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const updateProject = useMutation({
    mutationFn: async (vals: Partial<Project>) => {
      const { error } = await supabase.from('projects').update(vals).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowEdit(false)
    },
  })

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('projects').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); navigate('/') },
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }
  if (!project) return <div className="flex-1 p-6 text-gray-500">Project not found.</div>

  const due = dueDateLabel(project.due_date)
  const isOwner = project.owner_id === user?.id

  return (
    <>
      <TopBar
        title={project.name}
        subtitle={`${typeLabel(project.type)} project`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft size={14} /> Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowMembers(true)}>
              <Users size={13} /> Team
            </Button>
            {isOwner && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
                  <Edit2 size={13} /> Edit
                </Button>
                <Button
                  variant="danger" size="sm"
                  onClick={() => { if (confirm('Delete this project?')) deleteProject.mutate() }}
                >
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
              project.type === 'sourcing'    ? 'bg-blue-50' :
              project.type === 'development' ? 'bg-emerald-50' : 'bg-violet-50'
            }`}>
              {TYPE_ICONS[project.type]}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant={project.type}>{typeLabel(project.type)}</Badge>
                <Badge variant={project.status}>{statusLabel(project.status)}</Badge>
                <Badge variant={project.priority}>{priorityLabel(project.priority)} Priority</Badge>
              </div>
              {project.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                <span className={`flex items-center gap-1 ${due.cls}`}>
                  <Calendar size={11} /> {due.label}
                </span>
                <span>Created {formatDate(project.created_at)}</span>
                <span>Owner: {project.owner?.name ?? project.owner?.email ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Type-specific view */}
        {project.type === 'sourcing'     && <SourcingView    project={project} />}
        {project.type === 'development'  && <DevView         project={project} />}
        {project.type === 'general'      && <GeneralView     project={project} />}

        {/* Communication log */}
        <NotesSection project={project} />
      </div>

      {showEdit && (
        <ProjectModal
          project={project}
          onSave={vals => updateProject.mutate(vals)}
          onClose={() => setShowEdit(false)}
          loading={updateProject.isPending}
        />
      )}
      {showMembers && <MembersModal project={project} onClose={() => setShowMembers(false)} />}
    </>
  )
}
