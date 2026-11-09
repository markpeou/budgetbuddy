'use strict';

const assert = require('assert');
const core = require('../budget-core.js');

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

console.log('budget-core tests');

test('weekly / fortnightly / monthly / yearly frequency normalization', () => {
  assert.strictEqual(core.frequencyToMonthly(100, 'weekly'), (100 * 52) / 12);
  assert.strictEqual(core.frequencyToMonthly(100, 'fortnightly'), (100 * 26) / 12);
  assert.strictEqual(core.frequencyToMonthly(100, 'monthly'), 100);
  assert.strictEqual(core.frequencyToMonthly(1200, 'annually'), 100);
  assert.strictEqual(core.frequencyToMonthly(1200, 'yearly'), 100);
  assert.strictEqual(core.frequencyToMonthly(300, 'quarterly'), 100);

  const income = core.incomeNormalized(5200, 'weekly');
  assert.strictEqual(income.perWeek, 5200);
  assert.ok(Math.abs(income.perMonth - (5200 * 52) / 12) < 0.001);
});

test('AUD + VND aggregation into reporting currency', () => {
  // Rates: units of currency per 1 VND
  // 1 VND = 0.00004 USD => 1 USD = 25000 VND
  // 1 VND = 0.00006 AUD => 1 AUD = 16666.666... VND
  const rates = {
    USD: 0.00004,
    AUD: 0.00006,
    VND: 1,
  };

  const rows = [
    { amount: 100, frequency: 'monthly', currency: 'AUD' },
    { amount: 500000, frequency: 'monthly', currency: 'VND' },
  ];

  const result = core.aggregateExpenseRows(rows, 'USD', rates);
  assert.strictEqual(result.ok, true);
  // 100 AUD -> 100 / 0.00006 = 1_666_666.666... VND
  // + 500_000 VND = 2_166_666.666... VND
  // in USD: * 0.00004 = 86.666...
  assert.ok(Math.abs(result.totalVnd - (100 / 0.00006 + 500000)) < 0.01);
  assert.ok(Math.abs(result.totalReporting - result.totalVnd * 0.00004) < 0.01);
});

test('unavailable rates return explicit failure without silent drop', () => {
  const rates = { USD: 0.00004 }; // no AUD
  const rows = [
    { amount: 100, frequency: 'monthly', currency: 'AUD' },
    { amount: 50, frequency: 'monthly', currency: 'USD' },
  ];
  const result = core.aggregateExpenseRows(rows, 'USD', rates);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.totalVnd, null);
  assert.strictEqual(result.totalReporting, null);
  assert.ok(result.missingRates.includes('AUD'));
});

test('null rates fail aggregation when conversion needed', () => {
  const rows = [{ amount: 100, frequency: 'monthly', currency: 'USD' }];
  const result = core.aggregateExpenseRows(rows, 'VND', null);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.totalReporting, null);
});

test('same-currency aggregation works without rates', () => {
  const rows = [
    { amount: 100, frequency: 'monthly', currency: 'VND' },
    { amount: 200, frequency: 'monthly', currency: 'VND' },
  ];
  const result = core.aggregateExpenseRows(rows, 'VND', null);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.totalVnd, 300);
  assert.strictEqual(result.totalReporting, 300);
});

test('split validation: exact / under / over', () => {
  const exact = core.validateSplits([
    { percent: 50 },
    { percent: 30 },
    { percent: 20 },
  ]);
  assert.strictEqual(exact.status, 'exact');
  assert.strictEqual(exact.remainder, 0);

  const under = core.validateSplits([{ percent: 40 }, { percent: 30 }]);
  assert.strictEqual(under.status, 'under');
  assert.strictEqual(under.remainder, 30);

  const over = core.validateSplits([
    { percent: 60 },
    { percent: 50 },
  ]);
  assert.strictEqual(over.status, 'over');
  assert.strictEqual(over.remainder, 10);
});

test('legacy scenario migration adds per-row currency and splits', () => {
  const legacy = {
    salaryAmount: '5,000',
    salaryFrequency: 'monthly',
    incomeCurrency: 'USD',
    expenseCurrency: 'AUD',
    fixed: [{ name: 'Rent', frequency: 'monthly', amount: '2,000' }],
    variable: [],
    subs: [],
    percentages: {
      expenses: '55',
      savings: '25',
      emergency: '10',
      investments: '10',
    },
  };

  const migrated = core.migrateScenarioData(legacy);
  assert.strictEqual(migrated.fixed[0].currency, 'AUD');
  assert.ok(Array.isArray(migrated.splits));
  assert.strictEqual(migrated.splits.length, 4);
  const expenses = migrated.splits.find((s) => s.kind === 'expenses');
  assert.ok(expenses);
  assert.strictEqual(expenses.percent, 55);
  assert.strictEqual(expenses.required, true);
});

test('very old scenarios without currencies default to VND/VND', () => {
  const ancient = {
    salaryAmount: '10000000',
    salaryFrequency: 'monthly',
    fixed: [{ name: 'Rent', frequency: 'monthly', amount: '5000000' }],
  };
  const migrated = core.migrateScenarioData(ancient);
  assert.strictEqual(migrated.incomeCurrency, 'VND');
  assert.strictEqual(migrated.expenseCurrency, 'VND');
  assert.strictEqual(migrated.fixed[0].currency, 'VND');
});

test('goalSplitsPercentTotal excludes expenses bucket', () => {
  const total = core.goalSplitsPercentTotal([
    { kind: 'expenses', percent: 50 },
    { kind: 'goal', percent: 20 },
    { kind: 'goal', percent: 15 },
  ]);
  assert.strictEqual(total, 35);
});

if (process.exitCode) {
  console.error('\nSome tests failed.');
} else {
  console.log('\nAll tests passed.');
}

test('currency catalogue covers active currencies with names, symbols and decimals', () => {
  const cat = core.buildCurrencyCatalog([{ code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 }]);
  const by = Object.fromEntries(cat.map((c) => [c.code, c]));
  assert.ok(cat.length >= 150, `only ${cat.length}`);
  assert.strictEqual(by.AUD.symbol, 'A$', 'overrides kept');
  assert.strictEqual(by.VND.decimals, 0);
  assert.strictEqual(by.JPY.decimals, 0);
  assert.strictEqual(by.GBP.symbol, '£');
  assert.strictEqual(by.KWD.decimals, 3);
  assert.ok(/Swiss/.test(by.CHF.name));
  assert.notStrictEqual(by.CAD.symbol, '$', 'never an ambiguous bare $ for non-USD dollars');
});

test('default currency from device locale', () => {
  assert.strictEqual(core.currencyForLocales(['en-AU', 'en']), 'AUD');
  assert.strictEqual(core.currencyForLocales(['vi-VN']), 'VND');
  assert.strictEqual(core.currencyForLocales(['de-DE']), 'EUR');
  assert.strictEqual(core.currencyForLocales(['en'], 'USD'), 'USD');
});

test('majority currency: by value, sticky, count fallback, empty fallback', () => {
  const rates = { VND: 1, AUD: 1 / 17000 }; // units per VND
  const toVnd = (a, c) => (c in rates ? a / rates[c] : NaN);
  const entries = [
    { amount: 15000000, currency: 'VND' },
    { amount: 4000000, currency: 'VND' },
    { amount: 450, currency: 'AUD' }, // ≈ ₫7.65M
  ];
  const r = core.majorityCurrency(entries, toVnd, { fallback: 'USD' });
  assert.strictEqual(r.code, 'VND');
  assert.ok(r.share > 0.7 && r.share < 0.72);

  // AUD slightly ahead of current VND (within 20%) → stay on VND
  const close = [{ amount: 10000000, currency: 'VND' }, { amount: 700, currency: 'AUD' }]; // AUD ≈ ₫11.9M
  assert.strictEqual(core.majorityCurrency(close, toVnd, { current: 'VND', fallback: 'USD' }).code, 'VND');
  assert.strictEqual(core.majorityCurrency(close, toVnd, { fallback: 'USD' }).code, 'AUD');

  // No rates for one currency → compare by count
  const noRate = [{ amount: 5, currency: 'XYZ' }, { amount: 1, currency: 'VND' }, { amount: 2, currency: 'VND' }];
  const c = core.majorityCurrency(noRate, toVnd, { fallback: 'USD' });
  assert.deepStrictEqual([c.code, c.basis], ['VND', 'count']);

  assert.strictEqual(core.majorityCurrency([], toVnd, { fallback: 'AUD' }).code, 'AUD');
});

// Time zone → local currency
{
  const C = require('../budget-core.js');
  const assert = require('assert');
  assert.strictEqual(C.currencyForTimeZone('Asia/Ho_Chi_Minh'), 'VND');
  assert.strictEqual(C.currencyForTimeZone('Asia/Saigon'), 'VND');
  assert.strictEqual(C.currencyForTimeZone('Australia/Sydney'), 'AUD');
  assert.strictEqual(C.currencyForTimeZone('Australia/Some_New_Zone'), 'AUD');
  assert.strictEqual(C.currencyForTimeZone('Europe/Paris'), 'EUR');
  assert.strictEqual(C.currencyForTimeZone('America/Los_Angeles'), 'USD');
  assert.strictEqual(C.currencyForTimeZone('Mars/Olympus', 'USD'), 'USD');
  assert.strictEqual(C.currencyForTimeZone(undefined), null);
  console.log('✓ currencyForTimeZone maps zones to local currency');
}
