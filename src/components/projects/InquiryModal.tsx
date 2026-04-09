import { useState } from 'react'
import { Sparkles, Plus, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea, FormGroup } from '../ui/Input'

interface ParsedProduct {
  generic_name: string
  strength: string
  dosage_form: string
  packing: string
  quantity: string
  notes: string
}

interface ParsedInquiry {
  project_name: string
  market: string
  description: string
  products: ParsedProduct[]
  open_questions: string[]
}

interface Props {
  onClose: () => void
  onCreated: (projectId: string) => void
}

export default function InquiryModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<'paste' | 'preview' | 'saving'>('paste')
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedInquiry | null>(null)
  const [error, setError] = useState('')

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
      const data: ParsedInquiry = await res.json()
      setParsed(data)
      setStep('preview')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setParsing(false)
    }
  }

  const updateProduct = (i: number, field: keyof ParsedProduct, val: string) => {
    if (!parsed) return
    const products = [...parsed.products]
    products[i] = { ...products[i], [field]: val }
    setParsed({ ...parsed, products })
  }

  const removeProduct = (i: number) => {
    if (!parsed) return
    setParsed({ ...parsed, products: parsed.products.filter((_, idx) => idx !== i) })
  }

  const addProduct = () => {
    if (!parsed) return
    setParsed({
      ...parsed,
      products: [...parsed.products, { generic_name: '', strength: '', dosage_form: 'tablet', packing: '', quantity: '', notes: '' }],
    })
  }

  const createProject = async () => {
    if (!parsed || !user) return
    setStep('saving')
    try {
      // 1. Create project
      const { data: project, error: pe } = await supabase
        .from('projects')
        .insert({
          name: parsed.project_name,
          type: 'sourcing',
          status: 'planning',
          priority: 'medium',
          description: [parsed.description, parsed.open_questions.length ? '📋 Open: ' + parsed.open_questions.join(' · ') : ''].filter(Boolean).join('\n\n'),
          owner_id: user.id,
        })
        .select('id')
        .single()
      if (pe) throw pe

      // 2. Create products + sourcing items
      for (const p of parsed.products) {
        if (!p.generic_name.trim()) continue

        // Upsert product (match on name + strength + form)
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .ilike('generic_name', p.generic_name.trim())
          .eq('strength', p.strength || '')
          .maybeSingle()

        let productId: string
        if (existing) {
          productId = existing.id
        } else {
          const { data: newProd, error: prodErr } = await supabase
            .from('products')
            .insert({
              generic_name: p.generic_name.trim(),
              strength: p.strength || null,
              dosage_form: p.dosage_form || null,
              packing: p.packing || null,
              created_by: user.id,
            })
            .select('id')
            .single()
          if (prodErr) throw prodErr
          productId = newProd.id
        }

        // Create sourcing item
        const noteParts = [
          p.quantity ? `Qty: ${p.quantity}` : '',
          p.notes || '',
        ].filter(Boolean).join(' · ')

        await supabase.from('sourcing_items').insert({
          project_id: project.id,
          product_id: productId,
          status: 'pending',
          notes: noteParts || null,
        })
      }

      onCreated(project.id)
    } catch (e: any) {
      setError(e.message)
      setStep('preview')
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-600" />
          New project from inquiry
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
            <Button variant="primary" onClick={createProject} disabled={!parsed?.products.some(p => p.generic_name.trim())}>
              Create Project
            </Button>
          </>
        ) : null
      }
    >
      {step === 'paste' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Paste the buyer's inquiry — WhatsApp message, email, or any raw text. Claude will extract the products, market, quantities, and open questions automatically.
          </p>
          <FormGroup label="Inquiry text">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={`e.g.\nTelmisartan with Amlodipine\n5+80\n\nQuantities 300,000 tab each\nSupply in bulk jars 500 or 10000\n\nNeed shape of tablet + lead time\n\nFor Bosnia`}
            />
          </FormGroup>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="space-y-5">
          {/* Project meta */}
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Project name" className="col-span-2">
              <Input
                value={parsed.project_name}
                onChange={e => setParsed({ ...parsed, project_name: e.target.value })}
              />
            </FormGroup>
            <FormGroup label="Market / Country">
              <Input
                value={parsed.market}
                onChange={e => setParsed({ ...parsed, market: e.target.value })}
              />
            </FormGroup>
          </div>

          <FormGroup label="Description">
            <Textarea
              value={parsed.description}
              onChange={e => setParsed({ ...parsed, description: e.target.value })}
              rows={2}
            />
          </FormGroup>

          {/* Open questions */}
          {parsed.open_questions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">📋 Open requirements</p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                {parsed.open_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Products ({parsed.products.length})</p>
              <button onClick={addProduct} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Add product
              </button>
            </div>
            <div className="space-y-3">
              {parsed.products.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <FormGroup label="Generic name" className="col-span-3">
                        <Input
                          value={p.generic_name}
                          onChange={e => updateProduct(i, 'generic_name', e.target.value)}
                          placeholder="e.g. Telmisartan + Amlodipine"
                        />
                      </FormGroup>
                      <FormGroup label="Strength">
                        <Input value={p.strength} onChange={e => updateProduct(i, 'strength', e.target.value)} placeholder="e.g. 80+5mg" />
                      </FormGroup>
                      <FormGroup label="Form">
                        <Input value={p.dosage_form} onChange={e => updateProduct(i, 'dosage_form', e.target.value)} placeholder="tablet" />
                      </FormGroup>
                      <FormGroup label="Quantity">
                        <Input value={p.quantity} onChange={e => updateProduct(i, 'quantity', e.target.value)} placeholder="e.g. 300,000 tabs" />
                      </FormGroup>
                      <FormGroup label="Packing" className="col-span-2">
                        <Input value={p.packing} onChange={e => updateProduct(i, 'packing', e.target.value)} placeholder="e.g. bulk jar 500/10000" />
                      </FormGroup>
                      {p.notes && (
                        <FormGroup label="Notes" className="col-span-3">
                          <Input value={p.notes} onChange={e => updateProduct(i, 'notes', e.target.value)} />
                        </FormGroup>
                      )}
                    </div>
                    <button onClick={() => removeProduct(i)} className="mt-5 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 size={28} className="animate-spin text-brand-600" />
          <p className="text-sm">Creating project and products…</p>
        </div>
      )}
    </Modal>
  )
}
