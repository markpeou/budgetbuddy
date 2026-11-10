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
  assert.deepStrictEqual(none.targets.map((t) => t.target), [36000000, 72000000, 108000000, 144000000]); // 3, 6, 9, 12 months
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

ok('runway end date counts from today, using the exact months', () => {
  const today = new Date(2026, 10, 9); // 9 Nov 2026
  const r = J.runway({ savings: 30000, costs: 3898 });
  assert.strictEqual(r.months, 7);
  assert.ok(Math.abs(r.exactMonths - 7.696) < 0.001);
  const end = J.dateAfter(r.exactMonths, today);
  assert.strictEqual(end.getFullYear(), 2027);
  // 7.7 months ≈ 234 days → 1 July 2027 (whole months alone said "June").
  assert.strictEqual(end.getMonth(), 6);
  assert.strictEqual(end.getDate(), 1);
  assert.strictEqual(J.dateAfter(Infinity, today), null);
});

// ---------------------------------------------------------------------------
// Job loss / runway accuracy (brief: Journey Accuracy & UX Improvements)
// ---------------------------------------------------------------------------
console.log('job loss accuracy');
const BC = require('../budget-core.js');

const ROWS = [
  { name: 'Rent', kind: 'fixed', monthly: 1800 },
  { name: 'Gym membership', kind: 'fixed', monthly: 60 },
  { name: 'Groceries', kind: 'variable', monthly: 700 },
  { name: 'Transport', kind: 'variable', monthly: 200 },
  { name: 'Dining out', kind: 'variable', monthly: 300 },
  { name: 'Netflix', kind: 'subs', monthly: 20 },
];

ok('essentials: fixed costs only', () => {
  const e = J.essentials([{ name: 'Rent', kind: 'fixed', monthly: 1800 }, { name: 'Internet', kind: 'fixed', monthly: 80 }]);
  assert.strictEqual(e.total, 1880);
  assert.strictEqual(e.count, 2);
});

ok('essentials: variable costs only — necessities are not dropped for being variable', () => {
  const e = J.essentials([{ name: 'Groceries', kind: 'variable', monthly: 700 }, { name: 'Fuel', kind: 'variable', monthly: 150 }, { name: 'Dining out', kind: 'variable', monthly: 300 }]);
  assert.strictEqual(e.total, 850);
  assert.deepStrictEqual(e.items.map((i) => i.on), [true, true, false]);
});

ok('essentials: fixed and variable combined; a fixed choice (gym) is not assumed essential', () => {
  const e = J.essentials(ROWS);
  assert.strictEqual(e.total, 1800 + 700 + 200); // rent, groceries, transport
  assert.strictEqual(e.items.find((i) => i.name === 'Gym membership').on, false);
  assert.strictEqual(e.unconfirmed, ROWS.length); // all still suggestions
});

ok('essentials: zero essential costs', () => {
  const e = J.essentials([{ name: 'Dining out', kind: 'variable', monthly: 300 }]);
  assert.strictEqual(e.total, 0);
  assert.strictEqual(e.count, 0);
  assert.strictEqual(J.essentials([]).total, 0);
});

ok('essentials: missing classification falls back to a suggestion by name', () => {
  const e = J.essentials([{ name: 'Electricity', monthly: 90 }, { name: 'Mystery', monthly: 40 }]);
  assert.deepStrictEqual(e.items.map((i) => i.on), [true, false]);
  assert.ok(e.items.every((i) => !i.confirmed));
});

ok('essentials: user ticks, unticks, edits amounts and adds missing costs', () => {
  const saved = {
    items: {
      'variable:groceries': { amount: 500 },
      'variable:transport': { on: false },
      'fixed:gym membership': { on: true },
    },
    extras: [{ id: 'x', name: 'Medication', amount: 45 }],
  };
  const e = J.essentials(ROWS, saved);
  assert.strictEqual(e.total, 1800 + 500 + 60 + 45);
  const g = e.items.find((i) => i.name === 'Groceries');
  assert.ok(g.edited && g.budgetAmount === 700 && g.amount === 500);
  assert.strictEqual(e.items.find((i) => i.name === 'Transport').confirmed, true);
});

ok('essentials: an unconverted included cost blocks the total (no guessing)', () => {
  const e = J.essentials([{ name: 'Rent', kind: 'fixed', monthly: NaN }, { name: 'Groceries', kind: 'variable', monthly: 700 }]);
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.total, null);
  // …but an unconverted cost the user excluded doesn't block anything.
  const e2 = J.essentials([{ name: 'Rent', kind: 'fixed', monthly: NaN }], { items: { 'fixed:rent': { on: false } } });
  assert.strictEqual(e2.ok, true);
  assert.strictEqual(e2.total, 0);
});

const T = new Date(2026, 10, 10); // 10 Nov 2026

ok('runway: positive monthly cash burn', () => {
  const r = J.runwayScenario({ funds: 30000, expenses: 3898, income: 0, today: T });
  assert.strictEqual(r.status, 'depleting');
  assert.ok(Math.abs(r.months - 7.696) < 0.001);
  assert.strictEqual(r.endDate.getMonth(), 6); // July 2027
});

ok('runway: zero monthly cash burn — funds not being used', () => {
  const r = J.runwayScenario({ funds: 30000, expenses: 3000, income: 3000, today: T });
  assert.strictEqual(r.status, 'flat');
  assert.strictEqual(r.months, undefined);
  assert.strictEqual(r.endDate, undefined);
});

ok('runway: negative monthly cash burn — income exceeds spending', () => {
  const r = J.runwayScenario({ funds: 30000, expenses: 2000, income: 2500, today: T });
  assert.strictEqual(r.status, 'surplus');
  assert.strictEqual(r.surplus, 500);
});

ok('runway: zero available funds — no division by zero', () => {
  const r = J.runwayScenario({ funds: 0, expenses: 3000, income: 0, today: T });
  assert.strictEqual(r.status, 'no-funds');
  assert.strictEqual(r.months, undefined);
});

ok('runway: less than one month', () => {
  const r = J.runwayScenario({ funds: 1000, expenses: 3000, income: 0, today: T });
  assert.strictEqual(r.status, 'under-month');
  assert.strictEqual(r.days, 10); // 0.333 × 30.44
});

ok('runway: large available funds — no absurd dates', () => {
  const r = J.runwayScenario({ funds: 50000000, expenses: 3000, income: 0, today: T });
  assert.strictEqual(r.status, 'decades');
  assert.strictEqual(r.months, null);
  const big = J.runwayScenario({ funds: 1000000, expenses: 3000, income: 0, today: T });
  assert.strictEqual(big.status, 'depleting');
  assert.ok(Number.isFinite(big.months) && big.endDate.getFullYear() === 2054);
});

ok('runway: remaining income partially covers spending', () => {
  const r = J.runwayScenario({ funds: 12000, expenses: 4000, income: 1000, today: T });
  assert.strictEqual(r.burn, 3000);
  assert.strictEqual(r.months, 4);
});

ok('runway: missing or invalid inputs never produce a number', () => {
  for (const bad of [{ funds: NaN, expenses: 1 }, { funds: 1, expenses: undefined }, { funds: 1, expenses: 'x' }, { funds: -5, expenses: 100 }]) {
    assert.strictEqual(J.runwayScenario(bad).status, 'invalid');
  }
});

ok('one-off payments: confirmed included, uncertain excluded unless chosen', () => {
  const f = J.availableFunds({ now: 20000, confirmed: 8000, uncertain: 5000 });
  assert.strictEqual(f.total, 28000);
  assert.strictEqual(f.withUncertain, 33000);
  assert.strictEqual(f.uncertainIncluded, false);
  assert.strictEqual(J.availableFunds({ now: 20000, confirmed: 8000, uncertain: 5000, includeUncertain: true }).total, 33000);
});

ok('one-off payments: none, and zero', () => {
  assert.strictEqual(J.availableFunds({ now: 20000 }).total, 20000);
  const z = J.availableFunds({ now: 20000, confirmed: 0, uncertain: 0, includeUncertain: true });
  assert.strictEqual(z.total, 20000);
  assert.strictEqual(z.uncertainIncluded, false);
});

const RATES = { VND: 1, AUD: 0.0000588, USD: 0.000038 };
const conv = (rates) => (a, f, t) => BC.convert(a, f, t, rates);

ok('currency: same currency', () => {
  assert.deepStrictEqual(J.sumInCurrency([{ amount: 1000, currency: 'AUD' }], 'AUD', conv(null)), { ok: true, total: 1000, missing: [] });
});

ok('currency: valid conversion rate', () => {
  const r = J.sumInCurrency([{ amount: 1000000, currency: 'VND' }], 'AUD', conv(RATES));
  assert.ok(r.ok && Math.abs(r.total - 58.8) < 0.001);
});

ok('currency: missing rate is reported, never treated as converted', () => {
  const r = J.sumInCurrency([{ amount: 1000, currency: 'AUD' }, { amount: 1000, currency: 'VND' }], 'AUD', conv(null));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.total, null); // not 2000
  assert.deepStrictEqual(r.missing, ['VND']);
});

ok('currency: invalid rates (0, negative, text, NaN) are rejected', () => {
  for (const bad of [0, -1, 'abc', NaN, null]) {
    const r = J.sumInCurrency([{ amount: 500, currency: 'USD' }], 'AUD', conv({ ...RATES, USD: bad }));
    assert.strictEqual(r.ok, false, `rate ${bad}`);
    assert.deepStrictEqual(r.missing, ['USD']);
  }
});

ok('currency: cached rates convert exactly like live ones', () => {
  const cached = JSON.parse(JSON.stringify(RATES)); // as restored from storage
  const live = J.sumInCurrency([{ amount: 2000000, currency: 'VND' }], 'AUD', conv(RATES));
  const fromCache = J.sumInCurrency([{ amount: 2000000, currency: 'VND' }], 'AUD', conv(cached));
  assert.strictEqual(fromCache.total, live.total);
});

ok('currency: multiple expense currencies', () => {
  const r = J.sumInCurrency([
    { amount: 1000, currency: 'AUD' },
    { amount: 17007000, currency: 'VND' }, // ≈ A$1,000
    { amount: 100, currency: 'USD' },
  ], 'AUD', conv(RATES));
  assert.ok(r.ok);
  assert.ok(Math.abs(r.total - (1000 + 1000.01 + 100 * 0.0000588 / 0.000038)) < 0.1);
  const partial = J.sumInCurrency([{ amount: 1000, currency: 'AUD' }, { amount: 5, currency: 'EUR' }, { amount: 5, currency: 'GBP' }], 'AUD', conv(RATES));
  assert.deepStrictEqual(partial.missing, ['EUR', 'GBP']);
});

// ---------------------------------------------------------------------------
// Time off / leaving a job, and stale exchange rates
// ---------------------------------------------------------------------------
console.log('time off and rate age');

ok('break: affordable, with what is left', () => {
  const r = J.breakScenario({ funds: 25000, expenses: 3080, income: 0, months: 6 });
  assert.strictEqual(r.status, 'affordable');
  assert.strictEqual(r.cost, 18480);
  assert.strictEqual(r.leftAfter, 6520);
});

ok('break: short, and months to close the gap at the current saving rate', () => {
  const r = J.breakScenario({ funds: 10000, expenses: 3080, income: 0, months: 6, capacity: 2920 });
  assert.strictEqual(r.status, 'short');
  assert.strictEqual(r.shortfall, 8480);
  assert.strictEqual(r.monthsToSave, 3); // 2.9 → 3
  assert.strictEqual(J.breakScenario({ funds: 0, expenses: 3000, months: 3 }).monthsToSave, null); // no saving rate known
});

ok('break: income during the break covers spending', () => {
  const r = J.breakScenario({ funds: 0, expenses: 2000, income: 2500, months: 6 });
  assert.strictEqual(r.status, 'covered-by-income');
  assert.strictEqual(r.cost, 0);
});

ok('break: partial income lowers the cost', () => {
  assert.strictEqual(J.breakScenario({ funds: 0, expenses: 3000, income: 1000, months: 3 }).cost, 6000);
});

ok('break: invalid inputs never produce a number', () => {
  for (const bad of [{ funds: NaN, expenses: 1, months: 6 }, { funds: 1, expenses: 1, months: 0 }, { funds: 1, expenses: undefined, months: 6 }]) {
    assert.strictEqual(J.breakScenario(bad).status, 'invalid');
  }
});

ok('rates age: fresh, stale after 3 days, unknown treated as stale', () => {
  const now = new Date('2026-11-10T08:00:00Z');
  assert.deepStrictEqual(J.ratesAge(new Date('2026-11-09T08:00:00Z'), now), { known: true, days: 1, stale: false });
  assert.strictEqual(J.ratesAge('2026-11-07T07:59:00Z', now).stale, false); // 3 days
  assert.deepStrictEqual(J.ratesAge('2026-10-29T08:00:00Z', now), { known: true, days: 12, stale: true });
  assert.strictEqual(J.ratesAge(null, now).stale, true);
});

// ---------------------------------------------------------------------------
// Phase 2: emergency fund target date; savings goals three ways
// ---------------------------------------------------------------------------
console.log('emergency fund and savings goals');
const T2 = new Date(2026, 10, 10);

ok('emergency fund: 3, 6, 9 and 12 months; months covered today', () => {
  const e = J.emergencyFund({ essentials: 2000, saved: 5000 });
  assert.deepStrictEqual(e.targets.map((t) => t.months), [3, 6, 9, 12]);
  assert.strictEqual(e.monthsCoveredNow, 2.5);
  assert.strictEqual(e.chosen, null);
});

ok('emergency fund: target date gives what to save each month', () => {
  const e = J.emergencyFund({ essentials: 2000, months: 6, saved: 5000, monthly: 500, deadline: '2027-11', today: T2 });
  assert.strictEqual(e.gap, 7000);
  assert.strictEqual(e.deadlineMonths, 12);
  assert.ok(Math.abs(e.requiredMonthly - 583.33) < 0.01);
  assert.strictEqual(e.onTrack, false);
  assert.strictEqual(J.emergencyFund({ essentials: 2000, months: 6, saved: 5000, monthly: 600, deadline: '2027-11', today: T2 }).onTrack, true);
});

ok('goal time: simple, no interest', () => {
  const g = J.goalTime({ target: 10000, saved: 1000, contribution: 500, today: T2 });
  assert.strictEqual(g.status, 'ok');
  assert.strictEqual(g.months, 18);
  assert.strictEqual(g.reachDate.getFullYear(), 2028);
  assert.strictEqual(g.reachDate.getMonth(), 4); // May 2028
});

ok('goal time: weekly and fortnightly saving', () => {
  assert.strictEqual(J.goalTime({ target: 5200, contribution: 100, frequency: 'weekly', today: T2 }).months, 12); // 433.33 a month
  assert.strictEqual(J.goalTime({ target: 2600, contribution: 100, frequency: 'fortnightly', today: T2 }).months, 12);
});

ok('goal time: optional interest shortens it, and is reported', () => {
  const plain = J.goalTime({ target: 20000, saved: 0, contribution: 500, today: T2 });
  const withRate = J.goalTime({ target: 20000, saved: 0, contribution: 500, annualRate: 5, today: T2 });
  assert.strictEqual(plain.months, 40);
  assert.ok(withRate.months < plain.months);
  assert.ok(withRate.interest > 0);
});

ok('goal time: already reached, no saving, and out of reach', () => {
  assert.strictEqual(J.goalTime({ target: 1000, saved: 1500 }).status, 'reached');
  assert.strictEqual(J.goalTime({ target: 1000, saved: 0, contribution: 0 }).status, 'no-saving');
  assert.strictEqual(J.goalTime({ target: 1e9, saved: 0, contribution: 1 }).status, 'too-long');
  assert.strictEqual(J.goalTime({ target: 0 }).status, 'invalid');
});

ok('goal contribution: what to save by a date, with and without interest', () => {
  const plain = J.goalContribution({ target: 10000, saved: 0, deadline: '2028-11', today: T2 });
  assert.strictEqual(plain.months, 24);
  assert.ok(Math.abs(plain.monthly - 416.67) < 0.01);
  const r = 0.05 / 12;
  const expected = (10000 * r) / (Math.pow(1 + r, 24) - 1);
  const withRate = J.goalContribution({ target: 10000, saved: 0, deadline: '2028-11', annualRate: 5, today: T2 });
  assert.ok(Math.abs(withRate.monthly - expected) < 0.01);
  const weekly = J.goalContribution({ target: 10000, saved: 0, deadline: '2028-11', frequency: 'weekly', today: T2 });
  assert.ok(Math.abs(weekly.perPeriod - 416.67 / (52 / 12)) < 0.01);
});

ok('goal contribution: already enough, and no date', () => {
  assert.strictEqual(J.goalContribution({ target: 1000, saved: 1000, deadline: '2027-06', today: T2 }).status, 'reached');
  assert.strictEqual(J.goalContribution({ target: 1000, saved: 0, today: T2 }).status, 'no-date');
});

ok('goal projection: how much you will have', () => {
  const p = J.goalProjection({ saved: 1000, contribution: 100, months: 12 });
  assert.strictEqual(p.balance, 2200);
  assert.strictEqual(p.interest, 0);
  const r = 0.05 / 12;
  const withRate = J.goalProjection({ saved: 0, contribution: 100, months: 12, annualRate: 5 });
  assert.ok(Math.abs(withRate.balance - 100 * ((Math.pow(1 + r, 12) - 1) / r)) < 0.01); // 1,227.89
  assert.strictEqual(J.goalProjection({ saved: 0, contribution: 100 }).status, 'no-date');
  const json = JSON.stringify([J.goalTime({ target: 5, contribution: NaN }), J.goalProjection({ months: 'x' })]);
  assert.ok(!/NaN|Infinity/.test(json));
});
