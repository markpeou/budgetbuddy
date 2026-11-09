# Receipt reader worker

A Cloudflare Worker that reads receipt photos with Claude for Budget Buddy.
Your Anthropic API key lives here as a secret, so it never reaches anyone's
browser. Images are passed straight to Claude and never stored or logged.

Free Cloudflare plan is enough. Claude usage is billed to your Anthropic account.

## Deploy (one time, ~5 minutes)

```bash
cd worker
npx wrangler login                          # opens browser, sign in / sign up to Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key from console.anthropic.com
npx wrangler deploy
```

`deploy` prints a URL like `https://budgetbuddy-receipts.<you>.workers.dev`.
Put it in `receipts.js`:

```js
const RECEIPT_PROXY_URL = 'https://budgetbuddy-receipts.<you>.workers.dev';
```

Commit and push. Claude AI is now the default reader for everyone, no key needed.

## Protecting your bill

- **Set a monthly spend limit** in the Anthropic console (Settings → Limits). This is the real backstop.
- Only origins in `ALLOWED_ORIGINS` (wrangler.toml) are accepted, so other websites can't use your worker.
  Scripts can fake an origin, so this keeps out casual misuse, not a determined attacker.
- Each IP is limited to 10 scans a minute (`[[ratelimits]]` in wrangler.toml).

When you open the app to many people, add sign-in or Cloudflare Turnstile so
only real users of your app can scan.

## Change the model

Default is `claude-haiku-5-5` (fast, cheap). To try another without editing code:

```bash
npx wrangler deploy --var MODEL:claude-sonnet-5-5
```

## Test

From the repo root: `npm test` (runs the worker against a mocked Anthropic API).
