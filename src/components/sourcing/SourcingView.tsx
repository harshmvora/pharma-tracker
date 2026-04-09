import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BarChart2, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import PriceComparison from '../products/PriceComparison'
import { formatDate } from '../../lib/utils'
import type { Project, SourcingItem, Product, SourcingStatus } from '../../lib/types'

const STATUS_OPTS: SourcingStatus[] = ['pending', 'in-progress', 'sampled', 'approved', 'sourced', 'blocked']

interface ItemFormVals {
  generic_name: string; strength: string; dosage_form: string; packing: string
  category: string; status: SourcingStatus; notes: string; target_date: string
}

const BLANK: ItemFormVals = {
  generic_name: '', strength: '', dosage_form: '', packing: '',
  category: '', status: 'pending', notes: '', target_date: '',
}

function ItemModal({ item, onSave, onClose, loading }: {
  item?: SourcingItem & { product?: Product }
  onSave: (v: ItemFormVals) => void
  onClose: () => void
  loading?: boolean
}) {
  const [form, setForm] = useState<ItemFormVals>(item ? {
    generic_name: item.product?.generic_name ?? '',
    strength:     item.product?.strength ?? '',
    dosage_form:  item.product?.dosage_form ?? '',
    packing:      item.product?.packing ?? '',
    category:     item.product?.category ?? '',
    status:       item.status,
    notes:        item.notes ?? '',
    target_date:  item.target_date ?? '',
  } : BLANK)
  const set = <K extends keyof ItemFormVals>(k: K, v: ItemFormVals[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal
      title={item ? 'Edit Product' : 'Add Product'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => {
            if (!form.generic_name.trim()) return alert('Generic name is required')
            onSave(form)
          }} loading={loading}>
            {item ? 'Save' : 'Add Product'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
          Products are saved to the global catalogue and can be reused across projects.
        </p>

        <FormGroup label="Generic name" required>
          <Input value={form.generic_name} onChange={e => set('generic_name', e.target.value)} placeholder="e.g. Paracetamol" />
        </FormGroup>

        <FormRow>
          <FormGroup label="Strength">
            <Input value={form.strength} onChange={e => set('strength', e.target.value)} placeholder="e.g. 500mg" />
          </FormGroup>
          <FormGroup label="Dosage form">
            <Input value={form.dosage_form} onChange={e => set('dosage_form', e.target.value)} placeholder="e.g. Tablet" />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Packing">
            <Input value={form.packing} onChange={e => set('packing', e.target.value)} placeholder="e.g. 1x10 alu/alu" />
          </FormGroup>
          <FormGroup label="Category">
            <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Human Pharma" />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Status">
            <Select value={form.status} onChange={e => set('status', e.target.value as SourcingStatus)}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Target date">
            <Input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
          </FormGroup>
        </FormRow>

        <FormGroup label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </FormGroup>
      </div>
    </Modal>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  sampled: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  sourced: 'bg-brand-100 text-brand-700',
  blocked: 'bg-red-100 text-red-600',
}

export default function SourcingView({ project }: { project: Project }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showAdd,  setShowAdd]  = useState(false)
  const [editItem, setEditItem] = useState<(SourcingItem & { product?: Product }) | null>(null)
  const [priceItem, setPriceItem] = useState<(SourcingItem & { product?: Product }) | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sourcing_items', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_items')
        .select('*, product:products(*)')
        .eq('project_id', project.id)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as (SourcingItem & { product?: Product })[]
    },
  })

  const addItem = useMutation({
    mutationFn: async (vals: ItemFormVals) => {
      // Upsert product into global catalogue first
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .upsert({
          generic_name: vals.generic_name.trim(),
          strength:     vals.strength.trim()     || null,
          dosage_form:  vals.dosage_form.trim()  || null,
          packing:      vals.packing.trim()      || null,
          category:     vals.category.trim()     || null,
          created_by:   user!.id,
        }, { onConflict: 'id', ignoreDuplicates: false })
        .select()
        .single()
      if (pErr || !prod) throw pErr

      const { error } = await supabase.from('sourcing_items').insert({
        project_id:  project.id,
        product_id:  (prod as Product).id,
        status:      vals.status,
        notes:       vals.notes.trim()       || null,
        target_date: vals.target_date        || null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sourcing_items', project.id] }); setShowAdd(false) },
  })

  const updateItem = useMutation({
    mutationFn: async ({ id, vals }: { id: string; vals: ItemFormVals }) => {
      // Update product fields
      const item = items.find(i => i.id === id)
      if (item?.product_id) {
        await supabase.from('products').update({
          generic_name: vals.generic_name.trim(),
          strength:     vals.strength.trim()    || null,
          dosage_form:  vals.dosage_form.trim() || null,
          packing:      vals.packing.trim()     || null,
          category:     vals.category.trim()    || null,
        }).eq('id', item.product_id)
      }
      await supabase.from('sourcing_items').update({
        status:      vals.status,
        notes:       vals.notes.trim()  || null,
        target_date: vals.target_date   || null,
      }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sourcing_items', project.id] }); setEditItem(null) },
  })

  const updateStatus = async (id: string, status: SourcingStatus) => {
    await supabase.from('sourcing_items').update({ status }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['sourcing_items', project.id] })
  }

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('sourcing_items').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sourcing_items', project.id] }),
  })

  const done    = items.filter(i => i.status === 'sourced').length
  const blocked = items.filter(i => i.status === 'blocked').length

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">📦 Products ({items.length})</h3>
            {items.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {done} sourced · {items.length - done - blocked} in progress · {blocked} blocked
              </p>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Product
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="font-medium text-gray-600">No products yet</p>
            <p className="text-sm text-gray-400 mt-1">Add the products you need to source</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-3 py-3">Packing</th>
                  <th className="text-left px-3 py-3">Category</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Target date</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/60 group">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">
                        {item.product?.generic_name}
                        {item.product?.strength && <span className="text-gray-500"> {item.product.strength}</span>}
                      </p>
                      {item.product?.dosage_form && <p className="text-xs text-gray-400">{item.product.dosage_form}</p>}
                      {item.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{item.notes}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{item.product?.packing ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-600">{item.product?.category ?? '—'}</td>
                    <td className="px-3 py-3">
                      <select
                        value={item.status}
                        onChange={e => updateStatus(item.id, e.target.value as SourcingStatus)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-none outline-none cursor-pointer ${STATUS_COLORS[item.status] ?? 'bg-gray-100'}`}
                      >
                        {STATUS_OPTS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{item.target_date ? formatDate(item.target_date) : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPriceItem(item)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Compare prices"
                        >
                          <BarChart2 size={13} />
                        </button>
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Remove this product from the project?')) deleteItem.mutate(item.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd  && <ItemModal onSave={v => addItem.mutate(v)}                          onClose={() => setShowAdd(false)}  loading={addItem.isPending}    />}
      {editItem && <ItemModal item={editItem} onSave={v => updateItem.mutate({ id: editItem.id, vals: v })} onClose={() => setEditItem(null)}  loading={updateItem.isPending} />}
      {priceItem?.product && (
        <PriceComparison product={priceItem.product} onClose={() => setPriceItem(null)} />
      )}
    </>
  )
}
