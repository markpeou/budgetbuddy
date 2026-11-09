# Backlog

Parked ideas, roughly in priority order. Move an item into work by opening an issue or branch.

## Receipts

- **Deploy the receipt reader worker** (`worker/`), set `RECEIPT_PROXY_URL` in `receipts.js`, and set a monthly spend limit in the Anthropic console. Blocks Claude reading for everyone without their own key.
- **Automatic fallback to on-device OCR** when the worker is unavailable, rate-limited or over budget (images only; PDFs still need Claude). Show "Couldn't read this automatically — enter it manually" instead of API-key errors.
- **"Connect your own AI" via OpenRouter OAuth (PKCE)**: browser-only, no server; users pay with their own OpenRouter credits or use free models. For power users, not the default. ~½ day.
- **Watch "Sign in with ChatGPT"**: launched Oct 2026 for 16 partner apps, Plus/Pro only, no open developer access. Revisit if it opens up.
- **Gemini free tier**: considered and not chosen. Free-tier inputs may be used to improve Google products and reviewed by people, which conflicts with the "we don't keep your receipt" promise.
- **Measure real scan cost** after the first 20–30 scans (estimate: ~$0.0003–0.0005 per receipt on Haiku 5.5, so ~2,000 receipts per $1).
- **Cloudflare Turnstile** on the worker if abuse shows up (worst case today ≈ $7/day from one scripted IP at 10 scans/min).

## Calculators with placeholder pages

- **Emergency fund calculator** (`#soon/emergency`): target buffer from essential monthly costs, and time to build it. Linked from journeys and the question list.
- **Financial runway calculator** (`#soon/runway`): months your savings last if income stops or drops. Powers "six months off", "lost my job", "manage without an income" and "save before leaving my job".
- **Savings goal timeline**: how long a specific target takes at the current monthly contribution (journey currently routes to the goals split only).

## Summary (after OCR is reliable)

- Safe to spend today.
- Insight cards (biggest categories, changes vs last month).
- Plan vs actual by category (planned expenses vs scanned receipts).

## Other ideas

- Currency exposure view (how much of spending sits in each currency).
- Scenario comparison side by side.
