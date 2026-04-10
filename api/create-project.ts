import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const supabaseUrl     = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Product {
  generic_name: string
  strength:    string
  dosage_form: string
  packing:     string
  quantity:    string
  notes:       string
}

interface Body {
  project_name:    string
  market:          string
  description:     string
  open_questions:  string[]
  products:        Product[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Validate user JWT from Authorization header
  const jwt = req.headers.authorization?.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Missing authorization token' })

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // 2. Use service role client (bypasses RLS) for all DB writes
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const body: Body = req.body

  try {
    // Create project
    const { data: project, error: pe } = await db
      .from('projects')
      .insert({
        name:        body.project_name,
        type:        'sourcing',
        status:      'planning',
        priority:    'medium',
        description: [
          body.description,
          body.open_questions?.length
            ? '📋 Open: ' + body.open_questions.join(' · ')
            : '',
        ].filter(Boolean).join('\n\n'),
        owner_id: user.id,
      })
      .select('id')
      .single()

    if (pe) throw pe

    // Create products + sourcing items
    for (const p of body.products) {
      if (!p.generic_name?.trim()) continue

      // Reuse existing product if name+strength match
      const { data: existing } = await db
        .from('products')
        .select('id')
        .ilike('generic_name', p.generic_name.trim())
        .eq('strength', p.strength || '')
        .maybeSingle()

      let productId: string
      if (existing) {
        productId = existing.id
      } else {
        const { data: newProd, error: prodErr } = await db
          .from('products')
          .insert({
            generic_name: p.generic_name.trim(),
            strength:     p.strength     || null,
            dosage_form:  p.dosage_form  || null,
            packing:      p.packing      || null,
            created_by:   user.id,
          })
          .select('id')
          .single()
        if (prodErr) throw prodErr
        productId = newProd.id
      }

      const noteParts = [
        p.quantity ? `Qty: ${p.quantity}` : '',
        p.notes    || '',
      ].filter(Boolean).join(' · ')

      await db.from('sourcing_items').insert({
        project_id: project.id,
        product_id: productId,
        status:     'pending',
        notes:      noteParts || null,
      })
    }

    return res.status(200).json({ id: project.id })
  } catch (err: any) {
    console.error('create-project error:', err)
    return res.status(500).json({ error: err.message ?? 'Failed to create project' })
  }
}
