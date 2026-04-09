import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Select, Textarea, FormGroup, FormRow } from '../ui/Input'
import { formatPrice, formatDate, CURRENCIES } from '../../lib/utils'
import type { Product, PriceQuote, Manufacturer } from '../../lib/types'

interface QuoteForm {
  manufacturer_id: string; price: string; currency: string
  pack_size: string; moq: string; validity_date: string; notes: string; quote_date: string
}
const BLANK_QUOTE = (today: string): QuoteForm => ({
  manufacturer_id: '', price: '', currency: 'INR',
  pack_size: '', moq: '', validity_date: '', notes: '', quote_date: today,
})

function AddQuoteModal({ product, manufacturers, onSave, onClose, loading }: {
  product: Product
  manufacturers: Manufacturer[]
  onSave: (v: QuoteForm) => void
  onClose: () => void
  loading?: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<QuoteForm>(BLANK_QUOTE(today))
  const [newMfr, setNewMfr] = useState(false)
  const [mfrName, setMfrName] = useState('')
  const qc = useQueryClient()
  const { user } = useAuth()

  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => setForm(f => ({ ...f, [k]: v }))

  const createMfr = async () => {
    if (!mfrName.trim()) return
    const { data } = await supabase.from('manufacturers').insert({ name: mfrName.trim(), created_by: user!.id }).select().single()
    if (data) {
      qc.invalidateQueries({ queryKey: ['manufacturers'] })
      set('manufacturer_id', (data as Manufacturer).id)
      setNewMfr(false)
      setMfrName('')
    }
  }

  return (
    <Modal title="Add Price Quote" onClose={onClose} size="lg" footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={() => {
          if (!form.manufacturer_id) return alert('Select a manufacturer')
          if (!form.price)           return alert('Price is required')
          onSave(form)
        }}>Save Quote</Button></>
    }>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <span className="font-medium">{product.generic_name}</span>
          {product.strength    && <span className="text-gray-500"> {product.strength}</span>}
          {product.dosage_form && <span className="text-gray-400"> · {product.dosage_form}</span>}
          {product.packing     && <span className="text-gray-400"> · {product.packing}</span>}
        </div>

        {/* Manufacturer */}
        <FormGroup label="Manufacturer / Supplier" required>
          {newMfr ? (
            <div className="flex gap-2">
              <Input value={mfrName} onChange={e => setMfrName(e.target.value)} placeholder="Manufacturer name" autoFocus />
              <Button variant="primary" size="sm" onClick={createMfr}>Add</Button>
              <Button variant="ghost"   size="sm" onClick={() => setNewMfr(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={form.manufacturer_id} onChange={e => set('manufacturer_id', e.target.value)} className="flex-1">
                <option value="">— Select manufacturer —</option>
                {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}{m.country ? ` (${m.country})` : ''}</option>)}
              </Select>
              <Button variant="secondary" size="sm" onClick={() => setNewMfr(true)}><Plus size={12} /> New</Button>
            </div>
          )}
        </FormGroup>

        <FormRow>
          <FormGroup label="Price" required>
            <Input type="number" step="0.0001" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          </FormGroup>
          <FormGroup label="Currency">
            <Select value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Pack size (for this quote)">
            <Input value={form.pack_size} onChange={e => set('pack_size', e.target.value)} placeholder="e.g. 1x10, 10x10" />
          </FormGroup>
          <FormGroup label="MOQ">
            <Input value={form.moq} onChange={e => set('moq', e.target.value)} placeholder="e.g. 10,000 strips" />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Quote date">
            <Input type="date" value={form.quote_date} onChange={e => set('quote_date', e.target.value)} />
          </FormGroup>
          <FormGroup label="Valid until">
            <Input type="date" value={form.validity_date} onChange={e => set('validity_date', e.target.value)} />
          </FormGroup>
        </FormRow>

        <FormGroup label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any remarks…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

export default function PriceComparison({ product, onClose }: { product: Product; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', product.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('price_quotes')
        .select('*, manufacturer:manufacturers(*)')
        .eq('product_id', product.id)
        .order('quote_date', { ascending: false })
      return (data ?? []) as (PriceQuote & { manufacturer?: Manufacturer })[]
    },
  })

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const { data } = await supabase.from('manufacturers').select('*').order('name')
      return (data ?? []) as Manufacturer[]
    },
  })

  const addQuote = useMutation({
    mutationFn: async (v: QuoteForm) => {
      await supabase.from('price_quotes').insert({
        product_id:      product.id,
        manufacturer_id: v.manufacturer_id,
        price:           parseFloat(v.price),
        currency:        v.currency,
        pack_size:       v.pack_size.trim()     || null,
        moq:             v.moq.trim()           || null,
        validity_date:   v.validity_date        || null,
        quote_date:      v.quote_date,
        notes:           v.notes.trim()         || null,
        created_by:      user!.id,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes', product.id] }); setShowAdd(false) },
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => { await supabase.from('price_quotes').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes', product.id] }),
  })

  // Find best (lowest) price — in same currency only, group by currency
  const byCurrency = quotes.reduce<Record<string, PriceQuote[]>>((acc, q) => {
    ;(acc[q.currency] ??= []).push(q)
    return acc
  }, {})

  return (
    <>
      <Modal
        title="Price Comparison"
        onClose={onClose}
        size="xl"
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        {/* Product summary */}
        <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm">
          <p className="font-semibold text-gray-900">
            {product.generic_name}
            {product.strength    && <span className="font-normal text-gray-500"> {product.strength}</span>}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">
            {[product.dosage_form, product.packing, product.category].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Best prices summary */}
        {Object.entries(byCurrency).length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Object.entries(byCurrency).map(([currency, qs]) => {
              const best = [...qs].sort((a, b) => a.price - b.price)[0]
              return (
                <div key={currency} className="border border-green-200 bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Best in {currency}</p>
                  <p className="text-xl font-bold text-green-800 mt-0.5">{formatPrice(best.price, currency)}</p>
                  <p className="text-xs text-green-600">{best.manufacturer?.name}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Add quote button */}
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-medium text-gray-700">{quotes.length} quote{quotes.length !== 1 ? 's' : ''} received</p>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={12} /> Add Quote
          </Button>
        </div>

        {/* Quotes table */}
        {quotes.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm">No quotes yet. Add the first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Manufacturer</th>
                  <th className="text-right px-4 py-2.5">Price</th>
                  <th className="text-left px-4 py-2.5">Pack size</th>
                  <th className="text-left px-4 py-2.5">MOQ</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Valid until</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{q.manufacturer?.name ?? '—'}</p>
                      {q.manufacturer?.country && <p className="text-xs text-gray-400">{q.manufacturer.country}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-900">{formatPrice(q.price, q.currency)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{q.pack_size ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{q.moq ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(q.quote_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{q.validity_date ? formatDate(q.validity_date) : '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { if (confirm('Delete this quote?')) deleteQuote.mutate(q.id) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {showAdd && (
        <AddQuoteModal
          product={product}
          manufacturers={manufacturers}
          onSave={v => addQuote.mutate(v)}
          onClose={() => setShowAdd(false)}
          loading={addQuote.isPending}
        />
      )}
    </>
  )
}
