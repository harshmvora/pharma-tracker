import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, Image, MessageSquare, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Select, FormGroup } from '../ui/Input'
import { formatPrice, CURRENCIES } from '../../lib/utils'
import type { Manufacturer, ParsedPriceList, ParsedProduct } from '../../lib/types'

type InputMode = 'text' | 'file' | 'image'
type Step = 'input' | 'review' | 'done'

interface Props {
  onClose: () => void
  onImported?: () => void
}

export default function PriceUploadModal({ onClose, onImported }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step,      setStep]      = useState<Step>('input')
  const [mode,      setMode]      = useState<InputMode>('text')
  const [mfrId,     setMfrId]     = useState('')
  const [mfrName,   setMfrName]   = useState('')
  const [text,      setText]      = useState('')
  const [currency,  setCurrency]  = useState('INR')
  const [fileName,  setFileName]  = useState('')
  const [fileData,  setFileData]  = useState<{ base64: string; mimeType: string } | null>(null)
  const [parsed,    setParsed]    = useState<ParsedPriceList | null>(null)
  const [selected,  setSelected]  = useState<Record<number, boolean>>({})
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const { data } = await supabase.from('manufacturers').select('*').order('name')
      return (data ?? []) as Manufacturer[]
    },
  })

  // Read uploaded file — Excel → JSON text, Image → base64
  const handleFile = async (file: File) => {
    setFileName(file.name)
    setError('')

    if (file.type.startsWith('image/')) {
      setMode('image')
      const reader = new FileReader()
      reader.onload = e => {
        const base64 = (e.target?.result as string).split(',')[1]
        setFileData({ base64, mimeType: file.type })
      }
      reader.readAsDataURL(file)
    } else {
      // Excel / CSV
      setMode('file')
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb  = XLSX.read(e.target?.result, { type: 'array' })
          const ws  = wb.Sheets[wb.SheetNames[0]]
          const csv = XLSX.utils.sheet_to_csv(ws)
          setText(csv)
        } catch {
          setError('Could not read file. Try copying the content and pasting as text.')
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const parse = async () => {
    if (!text.trim() && !fileData) { setError('Nothing to parse.'); return }
    setLoading(true)
    setError('')

    try {
      const mfrLabel = mfrId
        ? manufacturers.find(m => m.id === mfrId)?.name ?? ''
        : mfrName.trim()

      const body: Record<string, string> = {
        format:           fileData ? 'image_base64' : 'text',
        manufacturer_name: mfrLabel,
        default_currency: currency,
      }
      if (fileData) {
        body.content    = fileData.base64
        body.media_type = fileData.mimeType
      } else {
        body.content = text
      }

      const res = await fetch('/api/parse-price', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: ParsedPriceList = await res.json()

      setParsed(data)
      // Select all by default
      setSelected(Object.fromEntries(data.products.map((_, i) => [i, true])))
      setStep('review')
    } catch (e: any) {
      setError(e.message ?? 'Parsing failed. Check your API key or try again.')
    } finally {
      setLoading(false)
    }
  }

  const importSelected = async () => {
    if (!parsed) return
    setLoading(true)

    try {
      // Ensure manufacturer exists
      let effectiveMfrId = mfrId
      if (!effectiveMfrId && (mfrName.trim() || parsed.manufacturer_name)) {
        const name = mfrName.trim() || parsed.manufacturer_name
        const { data: existing } = await supabase.from('manufacturers').select('id').eq('name', name).single()
        if (existing) {
          effectiveMfrId = (existing as any).id
        } else {
          const { data: newMfr } = await supabase.from('manufacturers').insert({ name, created_by: user!.id }).select().single()
          effectiveMfrId = (newMfr as any).id
        }
      }

      const toImport = parsed.products.filter((_, i) => selected[i])

      for (const p of toImport) {
        // Upsert product
        const { data: prod } = await supabase.from('products').upsert({
          generic_name: p.generic_name,
          strength:     p.strength     ?? null,
          dosage_form:  p.dosage_form  ?? null,
          packing:      p.packing      ?? null,
          created_by:   user!.id,
        }, { onConflict: 'id' }).select().single()

        if (!prod || !effectiveMfrId) continue

        await supabase.from('price_quotes').insert({
          product_id:      (prod as any).id,
          manufacturer_id: effectiveMfrId,
          price:           p.price,
          currency:        p.currency ?? parsed.currency,
          pack_size:       p.pack_size ?? null,
          moq:             p.moq      ?? null,
          notes:           p.notes    ?? null,
          quote_date:      new Date().toISOString().split('T')[0],
          created_by:      user!.id,
        })
      }

      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setStep('done')
      onImported?.()
    } catch (e: any) {
      setError(e.message ?? 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <Modal
      title="Import Price List"
      onClose={onClose}
      size="xl"
      footer={
        step === 'input' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={parse} loading={loading} disabled={!text.trim() && !fileData}>
              Parse with AI
            </Button>
          </>
        ) : step === 'review' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('input')}>← Back</Button>
            <Button variant="primary" onClick={importSelected} loading={loading} disabled={selectedCount === 0}>
              Import {selectedCount} product{selectedCount !== 1 ? 's' : ''}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>Done</Button>
        )
      }
    >
      {/* ── Step 1: Input ─── */}
      {step === 'input' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Upload a price list from any manufacturer — Excel file, WhatsApp message, or a photo/screenshot.
            Claude AI will extract all products and prices automatically.
          </p>

          {/* Manufacturer */}
          <FormGroup label="Manufacturer (optional — Claude will detect from the content)">
            <Select value={mfrId} onChange={e => setMfrId(e.target.value)}>
              <option value="">— Let AI detect / enter name below —</option>
              {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            {!mfrId && (
              <Input
                className="mt-1.5"
                value={mfrName}
                onChange={e => setMfrName(e.target.value)}
                placeholder="Or type manufacturer name…"
              />
            )}
          </FormGroup>

          {/* Default currency */}
          <FormGroup label="Default currency (if not in the price list)">
            <Select value={currency} onChange={e => setCurrency(e.target.value)} className="max-w-40">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormGroup>

          {/* Input mode tabs */}
          <div>
            <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg w-fit">
              {([
                { m: 'text'  as InputMode, icon: MessageSquare, label: 'Paste text'    },
                { m: 'file'  as InputMode, icon: FileText,      label: 'Upload file'   },
                { m: 'image' as InputMode, icon: Image,         label: 'Upload image'  },
              ]).map(({ m, icon: Icon, label }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {mode === 'text' && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
                placeholder={`Paste WhatsApp message, email, or copied price list here…

Example:
Paracetamol 500mg tab 1x10 alu/alu - Rs. 12.50/strip MOQ 10,000
Amoxicillin 250mg cap 1x10 - Rs. 18.00/strip MOQ 5,000`}
              />
            )}

            {(mode === 'file' || mode === 'image') && (
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              >
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                {fileName ? (
                  <p className="text-sm font-medium text-brand-600">{fileName}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-600">
                      {mode === 'image' ? 'Drop an image or click to upload' : 'Drop an Excel / CSV file or click to upload'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {mode === 'image' ? 'JPG, PNG, GIF, WebP' : '.xlsx, .xls, .csv'}
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept={mode === 'image' ? 'image/*' : '.xlsx,.xls,.csv'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review ─── */}
      {step === 'review' && parsed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                Found {parsed.products.length} products from <span className="text-brand-600">{parsed.manufacturer_name || 'Unknown'}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Review and deselect any products you don't want to import.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(Object.fromEntries(parsed.products.map((_, i) => [i, true])))} className="text-xs text-brand-600 hover:underline">Select all</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSelected({})} className="text-xs text-gray-500 hover:underline">Deselect all</button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2.5 w-8" />
                  <th className="text-left px-3 py-2.5">Product</th>
                  <th className="text-left px-3 py-2.5">Form / Packing</th>
                  <th className="text-right px-3 py-2.5">Price</th>
                  <th className="text-left px-3 py-2.5">MOQ</th>
                </tr>
              </thead>
              <tbody>
                {parsed.products.map((p, i) => (
                  <tr key={i} className={`border-b border-gray-50 last:border-0 ${selected[i] ? '' : 'opacity-40'}`}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={!!selected[i]}
                        onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">
                        {p.generic_name}{p.strength && <span className="text-gray-500 font-normal"> {p.strength}</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {[p.dosage_form, p.packing].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                      {formatPrice(p.price, p.currency ?? parsed.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{p.moq ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ─── */}
      {step === 'done' && (
        <div className="text-center py-10">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <p className="text-lg font-semibold text-gray-900">Import complete!</p>
          <p className="text-sm text-gray-500 mt-1">
            {selectedCount} product{selectedCount !== 1 ? 's' : ''} and price quotes have been saved to the product database.
          </p>
        </div>
      )}
    </Modal>
  )
}
