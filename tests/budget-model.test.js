// The shared budget model: every page reads these numbers, so they're tested here.
const assert = require('assert');
const C = require('../budget-core.js');

const ok = (name, fn) => {
  fn();
  console.log(`  ✓ ${name}`);
};
console.log('budget model');

const RATES = { VND: 1, AUD: 0.0000588, USD: 0.000038 };
const SPLITS = [
  { id: 'expenses', label: 'Expenses', percent: 50, kind: 'expenses' },
  { id: 'savings', label: 'Long-term savings', percent: 30, kind: 'goal' },
  { id: 'emergency', label: 'Emergency fund', percent: 10, kind: 'goal' },
  { id: 'investments', label: 'Investments', percent: 10, kind: 'goal' },
];
const base = (over = {}) => ({
  salaryAmount: '4,000',
  salaryFrequency: 'monthly',
  incomeCurrency: 'AUD',
  fixed: [{ id: 'r1', name: 'Rent', amount: '1,800', frequency: 'monthly', currency: 'AUD' }],
  variable: [{ id: 'g1', name: 'Groceries', amount: '700', frequency: 'monthly', currency: 'AUD' }, { id: 'd1', name: 'Dining out', amount: '300', frequency: 'monthly', currency: 'AUD' }],
  subs: [{ id: 'n1', name: 'Netflix', amount: '20', frequency: 'monthly', currency: 'AUD' }],
  splits: SPLITS,
  ...over,
});

ok('money in, money out, money left over (planned savings are not taken off)', () => {
  const m = C.budgetModel(base(), { rates: RATES });
  assert.strictEqual(m.moneyIn.total, 4000);
  assert.strictEqual(m.moneyOut.total, 2820);
  assert.strictEqual(m.leftOver, 1180);
  assert.strictEqual(m.leftOverYear, 14160);
  assert.strictEqual(m.planned.total, 2000); // 50% of 4,000 planned for savings & goals
  assert.strictEqual(m.leftOver, m.moneyIn.total - m.moneyOut.total); // the plan doesn't change it
});

ok('payment frequencies: weekly, fortnightly, quarterly, yearly, every 2 years', () => {
  const m = C.budgetModel(base({
    salaryAmount: '1,000', salaryFrequency: 'weekly',
    fixed: [
      { name: 'Rent', amount: '600', frequency: 'fortnightly', currency: 'AUD' },
      { name: 'Car insurance', amount: '900', frequency: 'annually', currency: 'AUD' },
      { name: 'Water', amount: '150', frequency: 'quarterly', currency: 'AUD' },
      { name: 'Passport', amount: '480', frequency: 'biennially', currency: 'AUD' },
    ],
    variable: [], subs: [],
  }), { rates: RATES });
  assert.strictEqual(m.moneyIn.total, 4333.33); // 1,000 × 52 ÷ 12
  assert.strictEqual(m.moneyOut.fixed, 1300 + 75 + 50 + 20); // 600×26÷12 + 900÷12 + 150÷3 + 480÷24
  assert.strictEqual(m.moneyOut.spread, 145); // the yearly, quarterly and 2-yearly part, spread monthly
});

ok('different currencies convert into the take-home pay currency', () => {
  const m = C.budgetModel(base({ fixed: [{ name: 'Rent in Saigon', amount: '17,007,000', frequency: 'monthly', currency: 'VND' }] }), { rates: RATES });
  assert.ok(m.ok);
  assert.ok(m.converted);
  assert.ok(Math.abs(m.moneyOut.fixed - 1000.01) < 0.01);
  assert.strictEqual(C.budgetModel(base(), { rates: RATES }).converted, false);
});

ok('missing exchange rate: no totals, the currency is named, nothing guessed', () => {
  const m = C.budgetModel(base({ fixed: [{ name: 'Rent', amount: '1,000', frequency: 'monthly', currency: 'VND' }] }), { rates: null });
  assert.strictEqual(m.ok, false);
  assert.deepStrictEqual(m.missingRates, ['VND']);
  assert.strictEqual(m.moneyOut.total, null);
  assert.strictEqual(m.leftOver, null);
});

ok('zero income: left over is unknown, not negative', () => {
  const m = C.budgetModel(base({ salaryAmount: '' }), { rates: RATES });
  assert.strictEqual(m.complete.income, false);
  assert.strictEqual(m.leftOver, null);
  assert.strictEqual(m.moneyOut.total, 2820);
});

ok('zero costs: everything is left over', () => {
  const m = C.budgetModel(base({ fixed: [], variable: [], subs: [] }), { rates: RATES });
  assert.strictEqual(m.complete.costs, false);
  assert.strictEqual(m.leftOver, 4000);
});

ok('negative left over when costs are more than money in', () => {
  const m = C.budgetModel(base({ salaryAmount: '2,000' }), { rates: RATES });
  assert.strictEqual(m.leftOver, -820);
});

ok('essential and other spending; variable costs are not assumed optional', () => {
  const m = C.budgetModel(base(), { rates: RATES });
  assert.strictEqual(m.moneyOut.essential, 2500); // rent + groceries
  assert.strictEqual(m.moneyOut.other, 320); // dining + netflix
  const g = m.moneyOut.items.find((i) => i.name === 'Groceries');
  assert.ok(g.essential && !g.essentialConfirmed);
});

ok('the user’s essential choice wins, and survives a rename (kept by id)', () => {
  const data = base({ essentials: { items: { 'id:d1': { on: true }, 'id:g1': { on: false } } } });
  data.variable[1].name = 'Eating out with family';
  const m = C.budgetModel(data, { rates: RATES });
  assert.strictEqual(m.moneyOut.items.find((i) => i.id === 'd1').essential, true);
  assert.strictEqual(m.moneyOut.essential, 1800 + 300);
});

ok('older data: essential choices kept by name still apply', () => {
  const data = base({ essentials: { items: { 'variable:groceries': { on: false } } } });
  data.variable = data.variable.map(({ id, ...r }) => r);
  assert.strictEqual(C.budgetModel(data, { rates: RATES }).moneyOut.essential, 1800);
});

ok('savings plan vs actual savings: the plan is never counted as money you have', () => {
  const m = C.budgetModel(base({ savings: { accessible: { amount: '12,000', currency: 'AUD' }, other: { amount: '30,000', currency: 'AUD' } } }), { rates: RATES });
  assert.strictEqual(m.savings.accessible, 12000);
  assert.strictEqual(m.savings.other, 30000);
  assert.strictEqual(m.planned.total, 2000);
  const none = C.budgetModel(base(), { rates: RATES });
  assert.strictEqual(none.savings.accessible, 0); // a 50% plan doesn't create savings
});

ok('debt repayments are counted once, as a cost', () => {
  const m = C.budgetModel(base({ fixed: [{ name: 'Rent', amount: '1,800', currency: 'AUD' }, { name: 'Car loan repayment', amount: '400', currency: 'AUD' }] }), { rates: RATES });
  assert.strictEqual(m.moneyOut.fixed, 2200);
  assert.strictEqual(m.moneyOut.items.find((i) => i.name === 'Car loan repayment').essential, true);
  assert.strictEqual(m.planned.total, 2000); // not added to the plan
});

ok('other money coming in: regular and not regular, in any currency', () => {
  const m = C.budgetModel(base({ otherIncome: [
    { name: 'Tutoring', amount: '200', frequency: 'weekly', currency: 'AUD', regular: false },
    { name: 'Rent from room', amount: '17,007,000', frequency: 'monthly', currency: 'VND', regular: true },
  ] }), { rates: RATES });
  assert.strictEqual(m.moneyIn.notRegular, 866.67);
  assert.ok(Math.abs(m.moneyIn.regular - 5000.01) < 0.01);
  assert.ok(Math.abs(m.moneyIn.total - 5866.68) < 0.01);
});

ok('incomplete information: a cost with no amount is ignored, not guessed', () => {
  const m = C.budgetModel(base({ variable: [{ name: 'Groceries', amount: '' }, { name: 'Transport', amount: 'abc' }] }), { rates: RATES });
  assert.strictEqual(m.moneyOut.variable, 0);
  assert.ok(m.ok);
});

ok('rounding: results are in whole cents, never 0.30000000000000004', () => {
  const m = C.budgetModel(base({ salaryAmount: '0.3', fixed: [{ name: 'A', amount: '0.1' }, { name: 'B', amount: '0.2' }], variable: [], subs: [] }), { rates: RATES });
  assert.strictEqual(m.moneyOut.total, 0.3);
  assert.strictEqual(m.leftOver, 0);
});

ok('no NaN or Infinity anywhere in a model', () => {
  const cases = [base(), base({ salaryAmount: 'x' }), base({ fixed: null, variable: undefined }), {}, null];
  for (const c of cases) {
    const json = JSON.stringify(C.budgetModel(c, { rates: RATES }));
    assert.ok(!/NaN|Infinity/.test(json), json);
  }
});

ok('scenario comparison: difference between two budgets', () => {
  const now = C.budgetModel(base(), { rates: RATES });
  const cheaper = C.budgetModel(base({ fixed: [{ name: 'Rent', amount: '1,500' }] }), { rates: RATES });
  assert.deepStrictEqual(C.compareModels(now, cheaper), { ok: true, moneyIn: 0, moneyOut: -300, leftOver: 300, leftOverYear: 3600 });
  const broken = C.budgetModel(base({ fixed: [{ name: 'Rent', amount: '1', currency: 'EUR' }] }), { rates: RATES });
  assert.strictEqual(C.compareModels(now, broken).ok, false);
  assert.strictEqual(C.compareModels(now, broken).leftOver, null);
});
