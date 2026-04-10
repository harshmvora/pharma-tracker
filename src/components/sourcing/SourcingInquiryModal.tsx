import { useState } from 'react'
import { Sparkles, Plus, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea, FormGroup } from '../ui/Input'
import type { Project } from '../../lib/types'

interface ParsedProduct {
  generic_name: string
  strength:     string
  dosage_form:  string
  packing:      string
  quantity:     string
  notes:        string
}

interface Props {
  project:   Project
  onClose:   () => void
  onAdded:   () => void   // refresh parent list
}

export default function SourcingInquiryModal({ project, onClose, onAdded }: Props) {
  const { user } = useAuth()
  const [step,    setStep]    = useState<'paste' | 'preview' | 'saving'>('paste')
  const [text,    setText]    = useState('')
  const [parsing, setParsing] = useState(false)
  const [products, setProducts] = useState<ParsedProduct[]>([])
  const [error,   setError]   = useState('')

  const parse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setError('')
    try {
      const res = await fetch('/api/parse-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Parse failed')
      const data = await res.json()
      setProducts(data.products ?? [])
      setStep('preview')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setParsing(false)
    }
  }

  const update = (i: number, field: keyof ParsedProduct, val: string) => {
    const next = [...products]
    next[i] = { ...next[i], [field]: val }
    setProducts(next)
  }

  const addProducts = async () => {
    if (!user) return
    setStep('saving')
    try {
      for (const p of products) {
        if (!p.generic_name.trim()) continue

        // Upsert into global products catalogue
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .upsert({
            generic_name: p.generic_name.trim(),
            strength:     p.strength    || null,
            dosage_form:  p.dosage_form || null,
            packing:      p.packing     || null,
            created_by:   user.id,
          }, { onConflict: 'id', ignoreDuplicates: false })
          .select()
          .single()
        if (pErr || !prod) throw pErr ?? new Error('Failed to save product')

        const noteParts = [
          p.quantity ? `Qty: ${p.quantity}` : '',
          p.notes    || '',
        ].filter(Boolean).join(' · ')

        const { error: siErr } = await supabase.from('sourcing_items').insert({
          project_id: project.id,
          product_id: (prod as any).id,
          status:     'pending',
          notes:      noteParts || null,
        })
        if (siErr) throw siErr
      }
      onAdded()
      onClose()
    } catch (e: any) {
      setError(e.message)
      setStep('preview')
    }
  }

  const validCount = products.filter(p => p.generic_name.trim()).length

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-600" />
          Add products from inquiry
        </span>
      }
      onClose={onClose}
      size="xl"
      footer={
        step === 'paste' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={parse} loading={parsing} disabled={!text.trim()}>
              {parsing ? 'Parsing…' : <><Sparkles size={14} /> Parse with AI</>}
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('paste')}>← Back</Button>
            <Button variant="primary" onClick={addProducts} disabled={validCount === 0}>
              Add {validCount} product{validCount !== 1 ? 's' : ''} to project
            </Button>
          </>
        ) : null
      }
    >
      {step === 'paste' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Paste the buyer's inquiry. Claude will extract all products, strengths, quantities and open requirements.
          </p>
          <FormGroup label="Inquiry text">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={`e.g.\nTelmisartan with Amlodipine\n5+80\nQuantities 300,000 tab each\nBulk jars 500 or 10000\nFor Bosnia`}
            />
          </FormGroup>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {validCount} product{validCount !== 1 ? 's' : ''} will be added to <span className="text-brand-600">{project.name}</span>
            </p>
            <button
              onClick={() => setProducts(p => [...p, { generic_name: '', strength: '', dosage_form: 'tablet', packing: '', quantity: '', notes: '' }])}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add product
            </button>
          </div>

          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <FormGroup label="Generic name" className="col-span-3">
                      <Input value={p.generic_name} onChange={e => update(i, 'generic_name', e.target.value)} placeholder="e.g. Telmisartan + Amlodipine" />
                    </FormGroup>
                    <FormGroup label="Strength">
                      <Input value={p.strength} onChange={e => update(i, 'strength', e.target.value)} placeholder="e.g. 80+5mg" />
                    </FormGroup>
                    <FormGroup label="Form">
                      <Input value={p.dosage_form} onChange={e => update(i, 'dosage_form', e.target.value)} placeholder="tablet" />
                    </FormGroup>
                    <FormGroup label="Quantity">
                      <Input value={p.quantity} onChange={e => update(i, 'quantity', e.target.value)} placeholder="e.g. 300,000 tabs" />
                    </FormGroup>
                    <FormGroup label="Packing" className="col-span-2">
                      <Input value={p.packing} onChange={e => update(i, 'packing', e.target.value)} placeholder="e.g. bulk jar 500/10000" />
                    </FormGroup>
                    {p.notes && (
                      <FormGroup label="Notes" className="col-span-3">
                        <Input value={p.notes} onChange={e => update(i, 'notes', e.target.value)} />
                      </FormGroup>
                    )}
                  </div>
                  <button onClick={() => setProducts(products.filter((_, idx) => idx !== i))} className="mt-5 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 size={28} className="animate-spin text-brand-600" />
          <p className="text-sm">Adding products to project…</p>
        </div>
      )}
    </Modal>
  )
}
