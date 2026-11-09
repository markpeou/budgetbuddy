'use strict';

const assert = require('assert');
const rc = require('../receipt-core.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const TODAY = '2026-11-09T12:00:00';

console.log('receipt-core tests');

test('parseMoney handles AU, EU and VND formats', () => {
  assert.strictEqual(rc.parseMoney('1,234.56'), 1234.56);
  assert.strictEqual(rc.parseMoney('1.234,56'), 1234.56);
  assert.strictEqual(rc.parseMoney('125.000'), 125000);
  assert.strictEqual(rc.parseMoney('125,000đ'), 125000);
  assert.strictEqual(rc.parseMoney('1.250.000'), 1250000);
  assert.strictEqual(rc.parseMoney('$12.50'), 12.5);
  assert.strictEqual(rc.parseMoney('4,50'), 4.5);
  assert.ok(Number.isNaN(rc.parseMoney('abc')));
});

test('Vietnamese café receipt → VND total, known brand, dining', () => {
  const text = `HIGHLANDS COFFEE
Vincom Đồng Khởi
HÓA ĐƠN BÁN HÀNG
Ngày: 07/11/2026 14:32
Phin Sữa Đá   x2   78.000
Bánh mì que   x1   25.000
Tạm tính            103.000
Giảm giá             10.000
Tổng cộng:           93.000
Tiền khách đưa      100.000
Tiền thối             7.000
Cảm ơn quý khách`;
  const r = rc.parseReceiptText(text, { defaultCurrency: 'AUD', today: TODAY });
  assert.strictEqual(r.amount, 93000);
  assert.strictEqual(r.currency, 'VND');
  assert.strictEqual(r.merchant, 'Highlands Coffee');
  assert.strictEqual(r.category, 'dining');
  assert.strictEqual(r.date, '2026-11-07');
  assert.strictEqual(r.confidence, 'high');
});

test('Australian supermarket receipt → AUD, ignores GST and card lines', () => {
  const text = `Woolworths
ABN 88 000 014 675
TAX INVOICE
BANANAS            3.20
MILK 2L            3.10
SUBTOTAL          45.20
TOTAL             45.20
GST INCLUDED IN TOTAL  4.11
EFTPOS            45.20
CARD ****1234
03/11/26 18:22`;
  const r = rc.parseReceiptText(text, { defaultCurrency: 'VND', today: TODAY });
  assert.strictEqual(r.amount, 45.2);
  assert.strictEqual(r.currency, 'AUD');
  assert.strictEqual(r.merchant, 'Woolworths');
  assert.strictEqual(r.category, 'groceries');
  assert.strictEqual(r.date, '2026-11-03');
});

test('"Total incl. GST" line is still treated as the total', () => {
  const r = rc.extractTotal('Item 10.00\nTotal incl. GST $22.00\n');
  assert.strictEqual(r.amount, 22);
});

test('unknown merchant falls back to top line + keyword category', () => {
  const text = `QUÁN PHỞ HÒA PASTEUR
260C Pasteur, Q3
ĐT: 028 3829 7943
Phở tái  85.000
Trà đá   5.000
Thanh toán   90.000`;
  const r = rc.parseReceiptText(text, { defaultCurrency: 'AUD', today: TODAY });
  assert.strictEqual(r.merchant, 'Quán Phở Hòa Pasteur');
  assert.strictEqual(r.category, 'dining');
  assert.strictEqual(r.amount, 90000);
  assert.strictEqual(r.currency, 'VND');
  assert.strictEqual(r.date, '2026-11-09', 'no date on receipt → today');
});

test('no total keyword → largest amount, low confidence', () => {
  const r = rc.extractTotal('Thing 4.00\nOther 12.50\nMore 3.00');
  assert.strictEqual(r.amount, 12.5);
  assert.strictEqual(r.confidence, 'low');
});

test('whole-word brand matching avoids false hits', () => {
  assert.strictEqual(rc.categorise('Gigabyte Store', ''), 'shopping');
  assert.strictEqual(rc.categorise('IGA Marrickville', ''), 'groceries');
  assert.strictEqual(rc.categorise('Phone repairs', ''), 'other');
});

test('learned merchant category wins', () => {
  assert.strictEqual(rc.categorise('Highlands Coffee', '', { 'highlands coffee': 'entertainment' }), 'entertainment');
});

test('future dates are rejected', () => {
  assert.strictEqual(rc.extractDate('12/12/2030', TODAY), '');
});

test('analyse converts, groups and filters by period', () => {
  const receipts = [
    { date: '2026-11-02', merchant: 'Coles', amount: 50, currency: 'AUD', category: 'groceries' },
    { date: '2026-11-05', merchant: 'Highlands Coffee', amount: 170000, currency: 'VND', category: 'dining' },
    { date: '2026-11-06', merchant: 'Coles', amount: 30, currency: 'AUD', category: 'groceries' },
    { date: '2026-10-20', merchant: 'Grab', amount: 85000, currency: 'VND', category: 'transport' },
    { date: '2026-11-07', merchant: 'Mystery', amount: 10, currency: 'XXX', category: 'other' },
  ];
  // Reporting in AUD: 1 AUD = 17,000 VND
  const toAud = (amt, code) => (code === 'AUD' ? amt : code === 'VND' ? amt / 17000 : NaN);
  const a = rc.analyse(receipts, rc.periodBounds('this-month', TODAY), toAud);
  assert.strictEqual(a.count, 3);
  assert.strictEqual(a.skipped, 1);
  assert.ok(Math.abs(a.total - 90) < 1e-9);
  assert.strictEqual(a.categories[0].id, 'groceries');
  assert.strictEqual(a.merchants[0].name, 'Coles');
  assert.strictEqual(a.merchants[0].count, 2);

  const all = rc.analyse(receipts, rc.periodBounds('all', TODAY), toAud);
  assert.deepStrictEqual(all.months.map((m) => m.month), ['2026-10', '2026-11']);
});

test('periodBounds last-month', () => {
  assert.deepStrictEqual(rc.periodBounds('last-month', TODAY), { from: '2026-10-01', to: '2026-10-31' });
});

test('CSV export holds data points only', () => {
  const csv = rc.toCsv([{ date: '2026-11-01', merchant: 'A, B', amount: 5, currency: 'AUD', category: 'dining' }]);
  assert.strictEqual(csv, 'date,merchant,amount,currency,category\n2026-11-01,"A, B",5,AUD,Dining & cafés');
});

// Regression: real Tesseract (eng+vie) output from generated, blurred, rotated receipt photos.
// Note the OCR's own errors (0→9 in vn_pho's date and prices) — the parser must degrade gracefully.
const fs = require('fs');
const path = require('path');
const fixture = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n + '.txt'), 'utf8');

test('real OCR: Vietnamese café receipt', () => {
  const r = rc.parseReceiptText(fixture('vn_highlands'), { defaultCurrency: 'USD', today: TODAY });
  assert.deepStrictEqual(
    [r.amount, r.currency, r.merchant, r.category, r.date],
    [93000, 'VND', 'Highlands Coffee', 'dining', '2026-11-07']
  );
});

test('real OCR: noisy phở receipt — "Thanh toán" total, garbled date falls back to today', () => {
  const r = rc.parseReceiptText(fixture('vn_pho'), { defaultCurrency: 'USD', today: TODAY });
  assert.strictEqual(r.amount, 100000);
  assert.strictEqual(r.currency, 'VND');
  assert.strictEqual(r.category, 'dining');
  assert.notStrictEqual(r.confidence, 'low');
  assert.strictEqual(r.date, '2026-11-09');
  assert.ok(!/["”“]/.test(r.merchant), 'stray OCR quote marks are stripped from the name');
});

test('real OCR: Woolworths', () => {
  const r = rc.parseReceiptText(fixture('au_woolies'), { defaultCurrency: 'VND', today: TODAY });
  assert.deepStrictEqual(
    [r.amount, r.currency, r.merchant, r.category, r.date],
    [25.2, 'AUD', 'Woolworths', 'groceries', '2026-11-03']
  );
});

test('real OCR: gelato shop → dining, "incl GST" total', () => {
  const r = rc.parseReceiptText(fixture('au_cafe'), { defaultCurrency: 'VND', today: TODAY });
  assert.deepStrictEqual(
    [r.amount, r.currency, r.merchant, r.category, r.date],
    [21.5, 'AUD', 'Gelato Messina', 'dining', '2026-11-06']
  );
});
