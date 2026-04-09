import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Upload, BarChart2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TopBar from '../layout/TopBar'
import Button from '../ui/Button'
import PriceComparison from './PriceComparison'
import PriceUploadModal from './PriceUploadModal'
import type { Product } from '../../lib/types'

export default function ProductsPage() {
  const [search,      setSearch]      = useState('')
  const [category,    setCategory]    = useState('all')
  const [showUpload,  setShowUpload]  = useState(false)
  const [priceProduct, setPriceProduct] = useState<Product | null>(null)

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('generic_name')
      return (data ?? []) as Product[]
    },
  })

  // Quote counts per product
  const { data: quoteCounts = {} } = useQuery({
    queryKey: ['quote_counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('price_quotes')
        .select('product_id')
      const counts: Record<string, number> = {}
      ;(data ?? []).forEach((q: any) => { counts[q.product_id] = (counts[q.product_id] ?? 0) + 1 })
      return counts
    },
  })

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[]]

  const filtered = products.filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return p.generic_name.toLowerCase().includes(q)
          || p.strength?.toLowerCase().includes(q)
          || p.dosage_form?.toLowerCase().includes(q)
          || p.packing?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <>
      <TopBar
        title="Product Database"
        subtitle={`${products.length} products across all projects`}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
              />
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
              <Upload size={14} /> Import Price List
            </Button>
          </>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  category === c
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}
              >
                {c === 'all' ? 'All categories' : c}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          {isLoading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-4xl mb-3">💊</p>
              <p className="font-semibold text-gray-700">
                {search ? 'No products match your search' : 'Product database is empty'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Products are added automatically when you add items to sourcing projects, or via bulk import.
              </p>
              <Button variant="primary" className="mt-4" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Import Price List
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Product</th>
                    <th className="text-left px-4 py-3">Strength</th>
                    <th className="text-left px-4 py-3">Form</th>
                    <th className="text-left px-4 py-3">Packing</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-center px-4 py-3">Quotes</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 group">
                      <td className="px-5 py-3 font-medium text-gray-900">{p.generic_name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.strength ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.dosage_form ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.packing ?? '—'}</td>
                      <td className="px-4 py-3">
                        {p.category ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.category}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {quoteCounts[p.id] ? (
                          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                            {quoteCounts[p.id]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPriceProduct(p)}
                          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <BarChart2 size={13} /> Compare prices
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showUpload   && <PriceUploadModal onClose={() => setShowUpload(false)}   onImported={() => { setShowUpload(false); refetch() }} />}
      {priceProduct && <PriceComparison  product={priceProduct}                  onClose={() => setPriceProduct(null)}                />}
    </>
  )
}
