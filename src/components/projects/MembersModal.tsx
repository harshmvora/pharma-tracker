import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Select, FormGroup, FormRow } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { initials } from '../../lib/utils'
import type { Project, Profile, MemberRole } from '../../lib/types'

interface Props {
  project: Project
  onClose: () => void
}

export default function MembersModal({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role,  setRole]  = useState<MemberRole>('member')
  const [err,   setErr]   = useState('')

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

  const addMember = useMutation({
    mutationFn: async () => {
      setErr('')
      // Look up user by email
      const { data: profileData, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single()
      if (pErr || !profileData) { setErr('No user found with that email. They must sign up first.'); return }

      const { error } = await supabase
        .from('project_members')
        .upsert({ project_id: project.id, user_id: (profileData as Profile).id, role })
      if (error) throw error
      setEmail('')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', project.id] }),
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      await supabase
        .from('project_members')
        .delete()
        .eq('project_id', project.id)
        .eq('user_id', userId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', project.id] }),
  })

  return (
    <Modal title="Manage Team Members" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        {/* Add member */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Add team member</p>
          <FormRow>
            <FormGroup label="Email">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </FormGroup>
            <FormGroup label="Role">
              <Select value={role} onChange={e => setRole(e.target.value as MemberRole)}>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </Select>
            </FormGroup>
          </FormRow>
          {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          <Button
            variant="primary" size="sm" className="mt-2"
            onClick={() => addMember.mutate()}
            loading={addMember.isPending}
            disabled={!email.trim()}
          >
            <UserPlus size={13} /> Add
          </Button>
        </div>

        {/* Current members */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Current members ({members.length})</p>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400">No members added yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials(m.profile?.name ?? m.profile?.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.profile?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{m.profile?.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                  {m.user_id !== project.owner_id && (
                    <button
                      onClick={() => removeMember.mutate(m.user_id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
