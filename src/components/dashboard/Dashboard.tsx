import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus, Search, Sparkles } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import TopBar from '../layout/TopBar'
import Button from '../ui/Button'
import ProjectCard from './ProjectCard'
import StatsRow from './StatsRow'
import ProjectModal from '../projects/ProjectModal'
import InquiryModal from '../projects/InquiryModal'
import type { Project } from '../../lib/types'

const TYPE_FILTERS = [
  { value: 'all',         label: 'All'         },
  { value: 'sourcing',    label: '📦 Sourcing'   },
  { value: 'development', label: '🔬 Development' },
  { value: 'general',     label: '📋 General'    },
]

const STATUS_FILTERS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'active',    label: 'Active'       },
  { value: 'planning',  label: 'Planning'     },
  { value: 'on-hold',   label: 'On hold'      },
  { value: 'completed', label: 'Completed'    },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? 'all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd,       setShowAdd]       = useState(false)
  const [showInquiry,   setShowInquiry]   = useState(false)

  // Sync type filter from URL query param (sidebar links)
  useEffect(() => {
    const t = searchParams.get('type')
    if (t) setTypeFilter(t)
  }, [searchParams])

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, name, email, avatar_url),
          members:project_members(user_id, role, profile:profiles(id, name, email, avatar_url))
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },
    enabled: !!user,
  })

  const addProject = useMutation({
    mutationFn: async (vals: Omit<Project, 'id' | 'created_at' | 'owner_id'>) => {
      const { error } = await supabase
        .from('projects')
        .insert({ ...vals, owner_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowAdd(false) },
  })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const filtered = projects.filter(p => {
    if (typeFilter !== 'all'   && p.type   !== typeFilter)   return false
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowInquiry(true)}>
              <Sparkles size={14} /> From Inquiry
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> New Project
            </Button>
          </>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <StatsRow projects={projects} />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setTypeFilter(f.value); navigate('/') }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === f.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">{search ? '🔍' : '🚀'}</div>
            <p className="font-medium text-gray-600">
              {search ? 'No projects match your search' : 'No projects yet'}
            </p>
            {!search && (
              <Button variant="primary" className="mt-4" onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Create first project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/projects/${p.id}`)}
                onDelete={() => {
                  if (confirm('Delete this project? This cannot be undone.'))
                    deleteProject.mutate(p.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <ProjectModal
          onSave={vals => addProject.mutate(vals)}
          onClose={() => setShowAdd(false)}
          loading={addProject.isPending}
        />
      )}

      {showInquiry && (
        <InquiryModal
          onClose={() => setShowInquiry(false)}
          onCreated={id => { setShowInquiry(false); qc.invalidateQueries({ queryKey: ['projects'] }); navigate(`/projects/${id}`) }}
        />
      )}
    </>
  )
}
