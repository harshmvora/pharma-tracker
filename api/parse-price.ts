import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a pharmaceutical price list parser. Extract all product pricing data from the input and return ONLY valid JSON — no explanation, no markdown fences.

Output schema:
{
  "manufacturer_name": "string",
  "currency": "ISO 4217 code (e.g. INR, USD, EUR, AED)",
  "products": [
    {
      "generic_name": "string (International Non-proprietary Name)",
      "strength": "string or null (e.g. 500mg, 10mg/5ml)",
      "dosage_form": "string or null — normalise: tab/tablet/tabs → tablet, cap/capsule → capsule, inj/injection → injection, syr/syrup → syrup",
      "packing": "string or null (e.g. 1x10 alu/alu, 30ml bottle, 10x10 strip)",
      "price": number (numeric value only, no symbols),
      "currency": "string (ISO 4217 — use header currency if not per-product)",
      "moq": "string or null (minimum order quantity)",
      "pack_size": "string or null (if different from product packing)",
      "notes": "string or null (any special terms, brand name, etc.)"
    }
  ]
}

Rules:
- Extract ALL products in the input
- Normalise dosage form names
- If currency symbol is present (₹=INR, $=USD, €=EUR, £=GBP, AED, ¥=CNY/JPY), convert to ISO code
- If no currency found use the default_currency provided
- Return ONLY the JSON object`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { content, format, media_type, manufacturer_name, default_currency = 'INR' } = req.body

  if (!content) {
    return res.status(400).json({ error: 'content is required' })
  }

  try {
    let response

    if (format === 'image_base64') {
      // Vision — image of a price list
      response = await client.messages.create({
        model:      'claude-opus-4-6',
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type:       'base64',
                media_type: media_type ?? 'image/jpeg',
                data:       content,
              },
            },
            {
              type: 'text',
              text: `Manufacturer: ${manufacturer_name ?? 'unknown'}\nDefault currency: ${default_currency}\n\nExtract all products and prices from this image.`,
            },
          ],
        }],
      })
    } else {
      // Text — WhatsApp message, pasted email, CSV from Excel
      response = await client.messages.create({
        model:      'claude-opus-4-6',
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Manufacturer: ${manufacturer_name ?? 'unknown'}\nDefault currency: ${default_currency}\n\nPrice list:\n${content}`,
        }],
      })
    }

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip any accidental markdown fences
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(clean)

    return res.status(200).json(parsed)
  } catch (err: any) {
    console.error('parse-price error:', err)
    return res.status(500).json({ error: err.message ?? 'Failed to parse price list' })
  }
}
