import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, UserPlus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, FormGroup } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { initials } from '../../lib/utils'
import type { Project, Profile, MemberRole } from '../../lib/types'

interface Props {
  project: Project
  onClose: () => void
}

export default function MembersModal({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  // All registered profiles
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .order('name', { ascending: true })
      return (data ?? []) as Profile[]
    },
  })

  // Current project members
  const { data: members = [] } = useQuery({
    queryKey: ['members', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_members')
        .select('*, profile:profiles(id, name, email, avatar_url)')
        .eq('project_id', project.id)
      return data ?? []
    },
  })

  const memberUserIds = new Set((members as any[]).map((m: any) => m.user_id))

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('project_members')
        .upsert({ project_id: project.id, user_id: userId, role: 'member' as MemberRole })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', project.id] })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', project.id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', project.id] })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const filtered = allProfiles.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  })

  return (
    <Modal
      title="Manage Team Members"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        {/* Search */}
        <FormGroup label="Search users">
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name or email…"
          />
        </FormGroup>

        {/* User list */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No users found.</p>
          )}
          {filtered.map(profile => {
            const isMember = memberUserIds.has(profile.id)
            const isOwner  = profile.id === project.owner_id
            const isHovered = hovered === profile.id

            return (
              <div
                key={profile.id}
                onMouseEnter={() => setHovered(profile.id)}
                onMouseLeave={() => setHovered(null)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isMember ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
                  {initials(profile.name ?? profile.email)}
                </div>

                {/* Name / email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile.name ?? <span className="text-gray-400 italic">No name</span>}
                    {isOwner && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">(owner)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                </div>

                {/* Status / action */}
                {isMember ? (
                  isOwner ? (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <Check size={12} /> Owner
                    </span>
                  ) : isHovered ? (
                    <button
                      onClick={() => removeMember.mutate(profile.id)}
                      disabled={removeMember.isPending}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <Check size={12} /> Added
                    </span>
                  )
                ) : (
                  <button
                    onClick={() => addMember.mutate(profile.id)}
                    disabled={addMember.isPending}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                  >
                    <UserPlus size={12} /> Add
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400">
          {members.length} member{members.length !== 1 ? 's' : ''} in this project
        </p>
      </div>
    </Modal>
  )
}
