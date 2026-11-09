// Worker tests with a mocked Anthropic API (no network, no key needed).
import assert from 'assert';
import worker from '../worker/src/index.js';

const env = { ANTHROPIC_API_KEY: 'sk-test', ALLOWED_ORIGINS: 'https://markpeou.github.io' };
const ORIGIN = 'https://markpeou.github.io';
let sent;
let upstream;
globalThis.fetch = async (url, init) => {
  sent = { url, init, body: JSON.parse(init.body) };
  return upstream();
};
const toolReply = (input) => () =>
  new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'record_receipt', input }] }), { status: 200 });

const post = (body, origin = ORIGIN) =>
  worker.fetch(
    new Request('https://w.example/', {
      method: 'POST',
      headers: { Origin: origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env
  );

let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

console.log('worker tests');

await test('reads a receipt and returns data points only', async () => {
  upstream = toolReply({ is_receipt: true, merchant: 'WinMart', total: 1180521, currency: 'vnd', date: '2026-11-09', category: 'groceries' });
  const res = await post({ image: 'QUJD' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.deepStrictEqual(await res.json(), { merchant: 'WinMart', total: 1180521, currency: 'VND', date: '2026-11-09', category: 'groceries' });
  assert.strictEqual(sent.init.headers['x-api-key'], 'sk-test');
  assert.deepStrictEqual(sent.body.tool_choice, { type: 'tool', name: 'record_receipt' });
});

await test('PDF receipts are sent as a document', async () => {
  upstream = toolReply({ is_receipt: true, merchant: 'Grab', total: 85000, currency: 'VND', date: '2026-11-08', category: 'transport' });
  const res = await post({ pdf: 'JVBERi0x' });
  assert.strictEqual(res.status, 200);
  const block = sent.body.messages[0].content[0];
  assert.strictEqual(block.type, 'document');
  assert.strictEqual(block.source.media_type, 'application/pdf');
});

await test('other websites are refused', async () => {
  const res = await post({ image: 'QUJD' }, 'https://evil.example');
  assert.strictEqual(res.status, 403);
});

await test('preflight allowed for the app', async () => {
  const res = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.strictEqual(res.status, 204);
});

await test('bad input rejected before calling Claude', async () => {
  sent = null;
  assert.strictEqual((await post({ image: '<script>' })).status, 400);
  assert.strictEqual((await post({ image: 'A'.repeat(3 * 1024 * 1024 + 4) })).status, 400);
  assert.strictEqual(sent, null);
});

await test('not a receipt → 422', async () => {
  upstream = toolReply({ is_receipt: false, merchant: '', total: 0, currency: '', date: '', category: 'other' });
  assert.strictEqual((await post({ image: 'QUJD' })).status, 422);
});

await test('unknown category and bad date are sanitised', async () => {
  upstream = toolReply({ is_receipt: true, merchant: 'X', total: 5, currency: 'AUD', date: '9/11/26', category: 'snacks' });
  const body = await (await post({ image: 'QUJD' })).json();
  assert.strictEqual(body.category, 'other');
  assert.strictEqual(body.date, '');
});

await test('upstream errors do not leak details', async () => {
  upstream = () => new Response('{"error":{"message":"invalid x-api-key sk-test"}}', { status: 401 });
  const res = await post({ image: 'QUJD' });
  assert.strictEqual(res.status, 502);
  assert.ok(!(await res.text()).includes('sk-test'));
});

await test('rate limit honoured', async () => {
  const limited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await worker.fetch(
    new Request('https://w.example/', { method: 'POST', headers: { Origin: ORIGIN }, body: '{"image":"QUJD"}' }),
    limited
  );
  assert.strictEqual(res.status, 429);
});

if (failed) process.exit(1);
