// Bank statements: layouts, signs, merchants, skips, duplicates and plan comparison.
// Fixtures follow each bank's documented CSV export layout.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require('../statement-core.js');

const ok = (name, fn) => {
  fn();
  console.log(`  ✓ ${name}`);
};
const read = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const spend = (r) => r.transactions.filter((t) => !t.skip);
console.log('statement-core');

ok('CSV: quotes, embedded commas, BOM, semicolons and tabs', () => {
  assert.deepStrictEqual(S.parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\n'), [['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  assert.deepStrictEqual(S.parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(S.parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
});

ok('dates and amounts in the usual bank formats', () => {
  assert.strictEqual(S.parseDate('02/10/2026'), '2026-10-02');
  assert.strictEqual(S.parseDate('10/02/2026', 'mdy'), '2026-10-02');
  assert.strictEqual(S.parseDate('2026-10-02'), '2026-10-02');
  assert.strictEqual(S.parseDate('02 Oct 26'), '2026-10-02');
  assert.strictEqual(S.parseDate('Oct 2, 2026'), '2026-10-02');
  assert.strictEqual(S.parseDate('31/02/2026'), null);
  assert.strictEqual(S.detectDateOrder(['01/02/2026', '13/02/2026']), 'dmy');
  assert.strictEqual(S.detectDateOrder(['01/02/2026', '01/13/2026']), 'mdy');
  assert.strictEqual(S.parseAmount('-85.40'), -85.4);
  assert.strictEqual(S.parseAmount('+1,234.56'), 1234.56);
  assert.strictEqual(S.parseAmount('(12.50)'), -12.5);
  assert.strictEqual(S.parseAmount('12.50 DR'), -12.5);
  assert.strictEqual(S.parseAmount('$-5.00'), -5);
  assert.strictEqual(S.parseAmount('1.500.000'), 1500000);
  assert.ok(Number.isNaN(S.parseAmount('')));
});

ok('CommBank: no header, negative spending, rent kept, transfers and pay skipped', () => {
  const r = S.parseStatement(read('commbank.csv'), { currency: 'AUD' });
  assert.ok(r.ok);
  assert.strictEqual(r.layout.hasHeader, false);
  assert.strictEqual(r.from, '2026-10-02');
  const byName = Object.fromEntries(r.transactions.map((t) => [t.merchant, t]));
  assert.strictEqual(byName.Woolworths.category, 'groceries');
  assert.strictEqual(byName.Woolworths.amount, 85.4);
  assert.strictEqual(byName.Netflix.category, 'entertainment');
  assert.strictEqual(byName['Uber Eats'].category, 'dining');
  const rent = r.transactions.find((t) => t.amount === 2100);
  assert.strictEqual(rent.category, 'housing');
  assert.strictEqual(rent.skip, null);
  assert.ok(/ray white rent/i.test(rent.merchant), rent.merchant);
  assert.strictEqual(r.transactions.find((t) => t.amount === 500).skip, 'Looks like a transfer');
  assert.strictEqual(r.transactions.find((t) => t.amount === 4000).skip, 'Money in');
  // Two identical Uber Eats orders on the same day are both kept, with different keys.
  const ue = r.transactions.filter((t) => t.merchant === 'Uber Eats');
  assert.strictEqual(ue.length, 2);
  assert.notStrictEqual(ue[0].key, ue[1].key);
  assert.strictEqual(spend(r).length, 6);
});

ok('ANZ, NAB and Westpac layouts', () => {
  const anz = S.parseStatement(read('anz.csv'), { currency: 'AUD' });
  assert.deepStrictEqual(spend(anz).map((t) => [t.merchant, t.category]), [['Woolworths', 'groceries'], ['Opal', 'transport']]);
  const nab = S.parseStatement(read('nab.csv'), { currency: 'AUD' });
  assert.strictEqual(nab.layout.merchant, 8);
  assert.deepStrictEqual(spend(nab).map((t) => [t.merchant, t.category, t.amount]), [['Woolworths', 'groceries', 85.4], ['AGL', 'bills', 120]]);
  const wbc = S.parseStatement(read('westpac.csv'), { currency: 'AUD' });
  assert.strictEqual(wbc.layout.debit, 3);
  assert.deepStrictEqual(spend(wbc).map((t) => [t.merchant, t.amount]), [['Woolworths', 85.4], ['Telstra', 95]]);
});

ok('credit card: purchases positive, US dates, repayment skipped', () => {
  const r = S.parseStatement(read('creditcard.csv'), { currency: 'AUD' });
  assert.strictEqual(r.spendingSign, 1);
  assert.strictEqual(r.layout.dateOrder, 'mdy');
  assert.deepStrictEqual(spend(r).map((t) => [t.date, t.merchant, t.category]), [['2026-10-02', 'Coles', 'groceries'], ['2026-10-03', 'Spotify', 'entertainment'], ['2026-10-13', 'Qantas', 'travel']]);
  // "These look backwards": flip swaps spending and money in.
  const flipped = S.parseStatement(read('creditcard.csv'), { currency: 'AUD', flip: true });
  assert.strictEqual(spend(flipped).length, 0); // the repayment is still recognised
});

ok('Vietnamese bank: debit/credit columns, VND amounts', () => {
  const r = S.parseStatement(read('vnd.csv'), { currency: 'VND' });
  assert.deepStrictEqual(spend(r).map((t) => [t.merchant, t.amount, t.category]), [['Grab', 85000, 'transport'], ['Highlands Coffee Q1', 59000, 'dining']]);
});

ok('not a statement, and remembered categories', () => {
  assert.strictEqual(S.parseStatement('hello\nworld', {}).ok, false);
  assert.strictEqual(S.parseStatement('', {}).ok, false);
  const r = S.parseStatement(read('anz.csv'), { currency: 'AUD', learned: { opal: 'other' } });
  assert.strictEqual(r.transactions.find((t) => t.merchant === 'Opal').category, 'other');
});

ok('duplicates: the same file twice, and a receipt already added', () => {
  const r = S.parseStatement(read('commbank.csv'), { currency: 'AUD' });
  const ledger = [
    { id: 'a', source: 'statement', key: r.transactions[0].key, date: '2026-10-02', amount: 85.4, currency: 'AUD' },
    { id: 'b', source: 'claude', date: '2026-10-11', amount: 65, currency: 'AUD' }, // Smiths Cafe, a day earlier
    { id: 'c', source: 'claude', date: '2026-10-03', amount: 18.99, currency: 'USD' }, // other currency: not a match
  ];
  const m = S.markDuplicates(r.transactions, ledger);
  assert.strictEqual(m[0].skip, 'Already added');
  const cafe = m.find((t) => t.amount === 65);
  assert.strictEqual(cafe.skip, 'Matches a receipt you added');
  assert.strictEqual(cafe.matchId, 'b');
  assert.strictEqual(m.find((t) => t.merchant === 'Netflix').skip, null);
});

const id = (x) => x;
const items = [
  { id: 'r1', name: 'Rent', monthly: 2100, frequency: 'monthly', kind: 'fixed' },
  { id: 'g1', name: 'Groceries', monthly: 700, frequency: 'monthly', kind: 'variable' },
  { id: 'd1', name: 'Dining out', monthly: 300, frequency: 'monthly', kind: 'variable' },
  { id: 'p1', name: 'Car rego', monthly: 60, frequency: 'annually', kind: 'fixed' },
];

ok('this month so far: spent vs plan, and the pace by today', () => {
  const ledger = [
    { date: '2026-11-02', amount: 400, currency: 'AUD', category: 'groceries' },
    { date: '2026-11-05', amount: 350, currency: 'AUD', category: 'dining' },
    { date: '2026-10-30', amount: 999, currency: 'AUD', category: 'groceries' }, // last month
    { date: '2026-11-06', amount: 50, currency: 'AUD', category: 'shopping' },
  ];
  const m = S.monthSoFar(ledger, items, id, new Date(2026, 10, 10));
  const row = (c) => m.rows.find((r) => r.id === c);
  assert.strictEqual(m.month, '2026-11');
  assert.strictEqual(row('groceries').spent, 400);
  assert.strictEqual(row('groceries').status, 'ahead'); // 400 by the 10th of a 700 plan (pace 233)
  assert.strictEqual(row('dining').status, 'over');
  assert.strictEqual(row('housing').status, 'ok');
  assert.strictEqual(row('shopping').status, 'unplanned');
  assert.strictEqual(m.total, 800);
  // Day-to-day only: groceries + dining + unplanned shopping; rent isn't paced.
  assert.strictEqual(m.dayToDay.spent, 800);
  assert.strictEqual(m.dayToDay.planned, 1000);
  assert.ok(Math.abs(m.dayToDay.expected - 1000 * 10 / 30) < 1e-9);
  // Rent paid in full on the 2nd isn't "ahead of pace".
  const rent = S.monthSoFar([{ date: '2026-11-02', amount: 2100, currency: 'AUD', category: 'housing' }], items, id, new Date(2026, 10, 3));
  assert.strictEqual(rent.rows.find((r) => r.id === 'housing').status, 'ok');
});

ok('covered months: only whole months inside a statement, never this month', () => {
  const today = new Date(2026, 10, 11);
  assert.deepStrictEqual(S.coveredMonths([{ from: '2026-09-02', to: '2026-10-31' }], today), ['2026-09', '2026-10']);
  assert.deepStrictEqual(S.coveredMonths([{ from: '2026-10-10', to: '2026-10-31' }], today), []);
  assert.deepStrictEqual(S.coveredMonths([{ from: '2026-11-01', to: '2026-11-10' }], today), []);
});

ok('suggestions: raise, add, never lower to zero or below a yearly bill', () => {
  const today = new Date(2026, 10, 11);
  const ledger = [
    { date: '2026-10-03', amount: 900, currency: 'AUD', category: 'groceries' },
    { date: '2026-10-04', amount: 2100, currency: 'AUD', category: 'housing' },
    { date: '2026-10-05', amount: 320, currency: 'AUD', category: 'transport' },
    { date: '2026-10-06', amount: 10, currency: 'AUD', category: 'personal' },
  ];
  const sug = S.suggestions(ledger, items, [{ from: '2026-10-01', to: '2026-10-31' }], id, today);
  const by = Object.fromEntries(sug.map((x) => [x.category, x]));
  assert.deepStrictEqual(by.groceries.action, { type: 'set', rowId: 'g1', rowName: 'Groceries', from: 700, monthly: 900 });
  assert.deepStrictEqual(by.transport.action, { type: 'add', group: 'variable', monthly: 320 }); // the yearly rego isn't changed; day-to-day transport is added
  assert.ok(!by.housing); // matches the plan
  assert.ok(!by.dining); // nothing spent: may be paid another way, so no "lower to zero"
  assert.ok(!by.personal); // too small to matter
  // No statement covering a whole month: no suggestions from partial data.
  assert.deepStrictEqual(S.suggestions(ledger, items, [{ from: '2026-10-15', to: '2026-10-31' }], id, today), []);
});
