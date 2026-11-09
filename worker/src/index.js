/**
 * Budget Buddy receipt reader — Cloudflare Worker.
 *
 * Holds the Anthropic API key so it never reaches a browser. Accepts one
 * receipt image, asks Claude for the data points, returns them. Nothing is
 * stored or logged: the image only exists for the length of this request.
 *
 * POST /  { image: "<base64 jpeg>" }  or  { pdf: "<base64 pdf>" }
 *   → 200 { merchant, total, currency, date, category }
 *   → 422 { error: "not_a_receipt" }
 */

const MODEL = 'claude-haiku-5-5';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // base64 length cap (~2.2 MB file)

const CATEGORIES = [
  'groceries', 'dining', 'transport', 'shopping', 'health',
  'bills', 'entertainment', 'travel', 'personal', 'other',
];

const RECEIPT_TOOL = {
  name: 'record_receipt',
  description: 'Record the purchase shown on a receipt.',
  input_schema: {
    type: 'object',
    properties: {
      is_receipt: { type: 'boolean', description: 'False if the image is not a purchase receipt.' },
      merchant: {
        type: 'string',
        description: 'The shop or business that issued the receipt (the store, not a product brand on a line item). Tidy capitalisation, e.g. "WinMart", "Highlands Coffee".',
      },
      total: {
        type: 'number',
        description: 'Final amount paid incl. tax, after discounts. Not the subtotal, not cash given, not change. Plain number without separators: 1,180,521 VND → 1180521.',
      },
      currency: { type: 'string', description: 'ISO 4217 code inferred from symbols, language and country, e.g. VND, AUD.' },
      date: { type: 'string', description: 'Purchase date as YYYY-MM-DD. Receipts are day-first (09/11/2026 = 9 Nov 2026). Empty string if not shown.' },
      category: { type: 'string', enum: CATEGORIES, description: 'Best spending category for the shop as a whole.' },
    },
    required: ['is_receipt', 'merchant', 'total', 'currency', 'date', 'category'],
  },
};

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    _ok: ok,
  };
}

function json(body, status, cors) {
  const { _ok, ...headers } = cors;
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return json(null, cors._ok ? 204 : 403, cors);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    // Browsers always send Origin on cross-site POSTs; this blocks other websites
    // from using your key. (Scripts can fake it — the rate limit and your
    // Anthropic spend limit are the backstop.)
    if (!cors._ok) return json({ error: 'origin_not_allowed' }, 403, cors);

    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'rate_limited' }, 429, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_request' }, 400, cors);
    }
    const isPdf = typeof body.pdf === 'string';
    const file = isPdf ? body.pdf : body.image;
    if (typeof file !== 'string' || !file || file.length > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(file)) {
      return json({ error: 'bad_image' }, 400, cors);
    }
    // Digital receipts (e-invoices) are often PDFs; Claude reads them directly.
    const receiptBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
      : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: file } };

    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.MODEL || MODEL,
        max_tokens: 400,
        tools: [RECEIPT_TOOL],
        tool_choice: { type: 'tool', name: 'record_receipt' },
        messages: [
          {
            role: 'user',
            content: [
              receiptBlock,
              { type: 'text', text: `Read this receipt and record it. Today is ${today}.` },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      // Don't leak upstream details (or the key) to the browser.
      return json({ error: res.status === 429 || res.status === 529 ? 'busy' : 'upstream_error' }, 502, cors);
    }

    const data = await res.json();
    const call = (data.content || []).find((b) => b.type === 'tool_use');
    if (!call) return json({ error: 'unreadable' }, 422, cors);
    const r = call.input || {};
    if (r.is_receipt === false) return json({ error: 'not_a_receipt' }, 422, cors);

    return json(
      {
        merchant: String(r.merchant || '').slice(0, 60),
        total: Number(r.total),
        currency: String(r.currency || '').toUpperCase().slice(0, 3),
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : '',
        category: CATEGORIES.includes(r.category) ? r.category : 'other',
      },
      200,
      cors
    );
  },
};
