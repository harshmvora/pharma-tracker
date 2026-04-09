import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a pharmaceutical business inquiry parser. Extract structured project information from a buyer inquiry and return ONLY valid JSON — no explanation, no markdown fences.

Output schema:
{
  "project_name": "string (concise, e.g. 'Bosnia — Telmisartan/Amlodipine Sourcing')",
  "market": "string (destination country/region, e.g. 'Bosnia', 'UAE', 'Europe')",
  "description": "string (1-2 sentence summary of the inquiry)",
  "products": [
    {
      "generic_name": "string (INN name, e.g. 'Telmisartan + Amlodipine')",
      "strength": "string or null (e.g. '40mg + 5mg', '80mg + 12.5mg')",
      "dosage_form": "string or null — normalise: tab/tablet/tabs → tablet, cap/capsule → capsule, inj/injection → injection",
      "packing": "string or null (e.g. '500 tabs/jar', '10000 tabs/jar')",
      "quantity": "string or null (e.g. '300,000 tablets')",
      "notes": "string or null (open questions, specs needed like shape, lead time, etc.)"
    }
  ],
  "open_questions": ["string"] // list of unanswered requirements e.g. "Tablet shape required", "Lead time required"
}

Rules:
- Extract ALL products mentioned
- If multiple pack sizes are given (e.g. "500 or 10000"), list them in packing field
- Infer dosage form from context (if not stated, use 'tablet' for pharma solid dose)
- Capture open requirements (shape, lead time, registration, dossier, etc.) in open_questions
- Return ONLY the JSON object`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text is required' })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Inquiry:\n${text}` }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    return res.status(200).json(JSON.parse(clean))
  } catch (err: any) {
    console.error('parse-inquiry error:', err)
    return res.status(500).json({ error: err.message ?? 'Failed to parse inquiry' })
  }
}
