const assert = require('assert');
const J = require('../journey-core.js');

const ok = (name, fn) => {
  fn();
  console.log(`  ✓ ${name}`);
};
console.log('journey-core');

ok('breakdown ranks costs and splits fixed vs flexible', () => {
  const b = J.breakdown([
    { name: 'Rent', monthly: 15000000, kind: 'fixed' },
    { name: 'Groceries', monthly: 4000000, kind: 'variable' },
    { name: 'Netflix', monthly: 260000, kind: 'subs' },
    { name: 'Gym', monthly: 1000000, kind: 'fixed' },
    { name: '', monthly: 0, kind: 'fixed' },
  ]);
  assert.deepStrictEqual(b.items.map((i) => i.name), ['Rent', 'Groceries', 'Gym', 'Netflix']);
  assert.strictEqual(b.total, 20260000);
  assert.strictEqual(b.fixed, 16000000);
  assert.strictEqual(b.flexible, 4260000);
  assert.ok(Math.abs(b.topShare - 20000000 / 20260000) < 1e-9);
});

ok('capacity: left, rate, yearly, goals gap, income needed', () => {
  const c = J.capacity({ income: 38000000, expenses: 29600000, goals: 11400000, flexible: 6000000 });
  assert.strictEqual(c.monthly, 8400000);
  assert.strictEqual(c.yearly, 100800000);
  assert.ok(Math.abs(c.rate - 8400000 / 38000000) < 1e-12);
  assert.strictEqual(c.goalsGap, 3000000);
  assert.strictEqual(c.trimTenPercent, 600000);
  assert.strictEqual(c.incomeNeededWithGoals, 41000000);
});

ok('snapshot: neutral readings, runway only with savings', () => {
  const s = J.snapshot({ income: 4000, fixed: 1800, expenses: 3000, savings: 9500 });
  assert.strictEqual(s.savingsRate, 0.25);
  assert.strictEqual(s.fixedShare, 0.45);
  assert.strictEqual(s.runwayMonths, 3);
  assert.strictEqual(J.snapshot({ income: 4000, fixed: 1800, expenses: 3000 }).runwayMonths, null);
});

ok('emergency fund: three targets, nothing chosen until the user picks', () => {
  const none = J.emergencyFund({ essentials: 12000000, saved: 20000000, monthly: 5000000 });
  assert.deepStrictEqual(none.targets.map((t) => t.target), [36000000, 72000000, 144000000]);
  assert.strictEqual(none.chosen, null);
  const six = J.emergencyFund({ essentials: 12000000, months: 6, saved: 20000000, monthly: 5000000 });
  assert.strictEqual(six.gap, 52000000);
  assert.strictEqual(six.monthsToBuild, 11); // 52 / 5 = 10.4 → 11
  const done = J.emergencyFund({ essentials: 1000, months: 3, saved: 5000, monthly: 0 });
  assert.ok(done.covered);
  assert.strictEqual(done.monthsToBuild, 0);
  assert.strictEqual(J.emergencyFund({ essentials: 1000, months: 3, saved: 0, monthly: 0 }).monthsToBuild, null);
});

ok('runway: rounds down, essentials stretch it, income can cover it', () => {
  const r = J.runway({ savings: 50000000, costs: 12000000, essentials: 8000000 });
  assert.strictEqual(r.months, 4); // 4.17
  assert.strictEqual(r.essentialsMonths, 6); // 6.25
  const withPayout = J.runway({ savings: 50000000, lumpSum: 30000000, costs: 12000000, essentials: 8000000 });
  assert.strictEqual(withPayout.months, 6);
  assert.strictEqual(withPayout.essentialsMonths, 10);
  const covered = J.runway({ savings: 1000, costs: 2000, income: 2500 });
  assert.ok(covered.incomeCovers);
  assert.strictEqual(covered.months, Infinity);
});

ok('runway with a fixed break: affordable or short, and time to close the gap', () => {
  const yes = J.runway({ savings: 120000000, costs: 15000000, duration: 6 });
  assert.ok(yes.affordable);
  assert.strictEqual(yes.breakCost, 90000000);
  assert.strictEqual(yes.leftAfter, 30000000);
  const no = J.runway({ savings: 50000000, costs: 15000000, duration: 6, capacity: 8400000 });
  assert.strictEqual(no.shortfall, 40000000);
  assert.strictEqual(no.monthsToSaveGap, 5); // 4.76 → 5
  const partTime = J.runway({ savings: 0, costs: 3000, income: 1000, duration: 3 });
  assert.strictEqual(partTime.breakCost, 6000);
});

ok('savings goal: reach date, deadline maths, on track', () => {
  const today = new Date(2026, 10, 9); // 9 Nov 2026
  const g = J.savingsGoal({ target: 50000000, saved: 10000000, monthly: 3000000, today });
  assert.strictEqual(g.months, 14); // 13.3 → 14
  assert.strictEqual(g.reachDate.getFullYear(), 2028);
  assert.strictEqual(g.reachDate.getMonth(), 0); // Jan 2028
  const d = J.savingsGoal({ target: 50000000, saved: 10000000, monthly: 3000000, deadline: '2027-11', today });
  assert.strictEqual(d.deadlineMonths, 12);
  assert.ok(Math.abs(d.requiredMonthly - 40000000 / 12) < 1e-6);
  assert.ok(!d.onTrack);
  const easy = J.savingsGoal({ target: 1000, saved: 0, monthly: 500, deadline: '2027-11', today });
  assert.ok(easy.onTrack);
  assert.strictEqual(J.savingsGoal({ target: 1000, saved: 0, monthly: 0, today }).months, null);
});

ok('income change: monthly and yearly difference, shortfall covered by savings', () => {
  const c = J.incomeChange({ income: 38000000, newIncome: 31700000, expenses: 29600000 });
  assert.strictEqual(c.leftNow, 8400000);
  assert.strictEqual(c.leftNew, 2100000);
  assert.strictEqual(c.diffYearly, -75600000);
  const short = J.incomeChange({ income: 38000000, newIncome: 26600000, expenses: 29600000, savings: 40000000 });
  assert.ok(short.short);
  assert.strictEqual(short.savingsCoverMonths, 13); // 40 / 3 = 13.3
});

ok('career change: transition cost and break-even', () => {
  const c = J.incomeChange({
    income: 6000, newIncome: 8000, expenses: 4000, savings: 20000,
    transition: { months: 4, income: 1000, oneOff: 3000 },
  });
  assert.strictEqual(c.transitionCost, 15000); // 4 × (4000 − 1000) + 3000
  assert.strictEqual(c.savingsAfterTransition, 5000);
  assert.strictEqual(c.breakEvenMonths, 8); // 15000 / 2000 = 7.5 → 8
  const lower = J.incomeChange({ income: 6000, newIncome: 5000, expenses: 4000, transition: { months: 2, income: 0, oneOff: 0 } });
  assert.strictEqual(lower.breakEvenMonths, null);
});

ok('bad inputs never throw or go negative', () => {
  assert.strictEqual(J.capacity({ income: 'x', expenses: undefined }).monthly, 0);
  assert.strictEqual(J.runway({ savings: -5, costs: NaN }).months, Infinity);
  assert.strictEqual(J.monthsUntil('nope'), null);
});
