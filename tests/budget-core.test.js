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
