/**
 * Journey calculators: small, pure arithmetic on monthly figures that all
 * share one currency. No DOM — the page (journeys.js) turns results into words.
 *
 * Conventions: amounts are monthly unless named otherwise; NaN/negative inputs
 * are treated as 0; "months" results are whole months rounded the way a person
 * would say them (runway rounds down, time-to-reach rounds up).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JourneyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const num = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0);
  const signed = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

  /** Months between today and a deadline (YYYY-MM or YYYY-MM-DD); at least 1. */
  function monthsUntil(deadline, today = new Date()) {
    const m = String(deadline || '').match(/^(\d{4})-(\d{2})/);
    if (!m) return null;
    const months = (Number(m[1]) - today.getFullYear()) * 12 + (Number(m[2]) - 1 - today.getMonth());
    return Math.max(1, months);
  }

  /** The calendar month `months` from today, as a Date on the 1st. */
  function addMonths(months, today = new Date()) {
    return new Date(today.getFullYear(), today.getMonth() + Math.round(months), 1);
  }

  const DAYS_PER_MONTH = 365.25 / 12;

  /** The day money runs out: today + a fractional number of months. */
  function dateAfter(months, today = new Date()) {
    if (!Number.isFinite(months)) return null;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() + Math.round(months * DAYS_PER_MONTH));
    return d;
  }

  // ---------------------------------------------------------------------------
  // Understand my money
  // ---------------------------------------------------------------------------

  /**
   * @param {Array<{name:string, monthly:number, kind:'fixed'|'variable'|'subs'}>} rows
   */
  function breakdown(rows) {
    const items = (rows || [])
      .map((r) => ({ name: String(r.name || '').trim() || 'Unnamed', monthly: num(r.monthly), kind: r.kind }))
      .filter((r) => r.monthly > 0)
      .sort((a, b) => b.monthly - a.monthly);
    const total = items.reduce((s, r) => s + r.monthly, 0);
    items.forEach((r) => {
      r.share = total ? r.monthly / total : 0;
    });
    const fixed = items.filter((r) => r.kind === 'fixed').reduce((s, r) => s + r.monthly, 0);
    const top = items.slice(0, 3);
    return {
      items,
      total,
      fixed,
      flexible: total - fixed,
      top,
      topShare: total ? top.reduce((s, r) => s + r.monthly, 0) / total : 0,
    };
  }

  /** What's genuinely left after all costs, and whether planned goals fit. */
  function capacity({ income, expenses, goals = 0, flexible = 0 }) {
    const inc = num(income);
    const exp = num(expenses);
    const left = inc - exp;
    const planned = num(goals);
    return {
      monthly: left,
      yearly: left * 12,
      rate: inc ? left / inc : 0,
      goalsGap: planned > Math.max(0, left) ? planned - Math.max(0, left) : 0,
      trimTenPercent: num(flexible) * 0.1,
      incomeNeeded: exp,
      incomeNeededWithGoals: exp + planned,
    };
  }

  /** Four neutral readings. */
  function snapshot({ income, fixed, expenses, biggest, savings }) {
    const inc = num(income);
    const exp = num(expenses);
    const sav = num(savings);
    return {
      savingsRate: inc ? (inc - exp) / inc : null,
      fixedShare: inc ? num(fixed) / inc : null,
      biggest: biggest || null,
      runwayMonths: sav > 0 && exp > 0 ? Math.floor(sav / exp) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Safety net
  // ---------------------------------------------------------------------------

  /** Targets for each cover option, and progress toward the chosen one. */
  /**
   * Targets for each cover option, how many months current savings cover, and
   * (once a cover is chosen) the gap, time to build it, or — with a target
   * date — what to save each month. No option is treated as "right".
   */
  function emergencyFund({ essentials, months, saved, monthly, deadline, options = [3, 6, 9, 12], today = new Date() }) {
    const ess = num(essentials);
    const have = num(saved);
    const per = num(monthly);
    const targets = options.map((m) => ({ months: m, target: ess * m }));
    const monthsCoveredNow = ess ? have / ess : null;
    if (!months) return { targets, chosen: null, saved: have, monthsCoveredNow };
    const target = ess * months;
    const gap = Math.max(0, target - have);
    const out = {
      targets,
      chosen: months,
      target,
      saved: have,
      gap,
      covered: gap === 0 && target > 0,
      monthsToBuild: gap > 0 && per > 0 ? Math.ceil(gap / per) : gap === 0 ? 0 : null,
      monthsCoveredNow,
    };
    const until = monthsUntil(deadline, today);
    if (until && gap > 0) {
      out.deadlineMonths = until;
      out.requiredMonthly = gap / until;
      out.onTrack = per > 0 && per >= out.requiredMonthly - 0.005;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Savings goals: three ways to ask, optional interest, any saving frequency
  // ---------------------------------------------------------------------------

  const PER_MONTH = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1 };
  const GOAL_MAX_MONTHS = 1200; // 100 years: beyond this, "not reachable"

  /** A weekly/fortnightly/monthly amount as a monthly amount. */
  function monthlyEquivalent(amount, frequency = 'monthly') {
    return num(amount) * (PER_MONTH[frequency] || 1);
  }

  /** Optional interest: a yearly % paid monthly on the balance. 0 = none. */
  const monthlyRate = (annualRate) => Math.max(0, Number(annualRate) || 0) / 100 / 12;

  /** Balance after `months` of saving (interest added monthly, then the saving). */
  function growBalance(start, monthly, months, annualRate = 0) {
    const r = monthlyRate(annualRate);
    let b = num(start);
    for (let i = 0; i < months; i++) b = b * (1 + r) + monthly;
    return b;
  }

  /** 1. "I have a target. How long will it take?" */
  function goalTime({ target, saved = 0, contribution = 0, frequency = 'monthly', annualRate = 0, today = new Date() }) {
    const tgt = num(target);
    const have = num(saved);
    const per = monthlyEquivalent(contribution, frequency);
    const r = monthlyRate(annualRate);
    if (!tgt) return { status: 'invalid' };
    if (have >= tgt) return { status: 'reached', target: tgt, saved: have, gap: 0, months: 0 };
    if (per <= 0 && (r === 0 || have === 0)) return { status: 'no-saving', target: tgt, saved: have, gap: tgt - have };
    let b = have;
    let m = 0;
    while (b < tgt - 0.005 && m < GOAL_MAX_MONTHS) {
      b = b * (1 + r) + per;
      m++;
    }
    if (b < tgt - 0.005) return { status: 'too-long', target: tgt, saved: have, gap: tgt - have, monthly: per };
    return { status: 'ok', target: tgt, saved: have, gap: tgt - have, monthly: per, months: m, reachDate: addMonths(m, today), interest: Math.max(0, b - have - per * m) };
  }

  /** 2. "I have a target date. How much should I save?" */
  function goalContribution({ target, saved = 0, deadline, frequency = 'monthly', annualRate = 0, today = new Date() }) {
    const tgt = num(target);
    const have = num(saved);
    if (!tgt) return { status: 'invalid' };
    const n = monthsUntil(deadline, today);
    if (!n) return { status: 'no-date', target: tgt, saved: have };
    const r = monthlyRate(annualRate);
    const grown = have * Math.pow(1 + r, n);
    if (grown >= tgt) return { status: 'reached', target: tgt, saved: have, months: n, gap: 0 };
    const monthly = r === 0 ? (tgt - have) / n : ((tgt - grown) * r) / (Math.pow(1 + r, n) - 1);
    return {
      status: 'ok',
      target: tgt,
      saved: have,
      months: n,
      gap: tgt - have,
      monthly,
      perPeriod: monthly / (PER_MONTH[frequency] || 1),
      frequency,
    };
  }

  /** 3. "I can save this much. How much will I have?" */
  function goalProjection({ saved = 0, contribution = 0, frequency = 'monthly', deadline, months, annualRate = 0, today = new Date() }) {
    const n = months != null ? Math.max(0, Math.round(num(months))) : monthsUntil(deadline, today);
    if (!n) return { status: 'no-date' };
    const per = monthlyEquivalent(contribution, frequency);
    const have = num(saved);
    const balance = growBalance(have, per, n, annualRate);
    const contributed = per * n;
    return { status: 'ok', months: n, saved: have, monthly: per, contributed, interest: Math.max(0, balance - have - contributed), balance };
  }

  /**
   * How long savings last, or (with `duration`) whether they cover a fixed break.
   * `income` is money still coming in during the period; `lumpSum` a one-off
   * (redundancy payout); `capacity` what you can save per month today.
   */
  function runway({ savings, costs, essentials, income = 0, lumpSum = 0, duration = 0, capacity = 0 }) {
    const pot = num(savings) + num(lumpSum);
    const burn = num(costs) - num(income);
    const burnEssentials = num(essentials) - num(income);
    const months = (b) => (b <= 0 ? Infinity : Math.floor(pot / b));
    const out = {
      pot,
      monthlyBurn: Math.max(0, burn),
      months: months(burn),
      exactMonths: burn <= 0 ? Infinity : pot / burn,
      essentialsMonths: num(essentials) > 0 ? months(burnEssentials) : null,
      incomeCovers: burn <= 0,
    };
    if (duration > 0) {
      const cost = Math.max(0, burn) * duration;
      const left = pot - cost;
      out.duration = duration;
      out.breakCost = cost;
      out.leftAfter = left;
      out.affordable = left >= 0;
      out.shortfall = left < 0 ? -left : 0;
      out.monthsToSaveGap = left < 0 && num(capacity) > 0 ? Math.ceil(-left / num(capacity)) : left < 0 ? null : 0;
    }
    return out;
  }

  /** When you'll reach a target, or what it takes to hit a deadline. */
  function savingsGoal({ target, saved, monthly, deadline, today = new Date() }) {
    const tgt = num(target);
    const have = num(saved);
    const per = num(monthly);
    const gap = Math.max(0, tgt - have);
    const out = { target: tgt, saved: have, gap, monthly: per, reached: tgt > 0 && gap === 0 };
    out.months = gap === 0 ? 0 : per > 0 ? Math.ceil(gap / per) : null;
    out.reachDate = out.months != null ? addMonths(out.months, today) : null;
    const until = monthsUntil(deadline, today);
    if (until) {
      out.deadlineMonths = until;
      out.requiredMonthly = gap / until;
      out.extraNeeded = Math.max(0, out.requiredMonthly - per);
      out.onTrack = out.extraNeeded <= 0.005;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Big life change
  // ---------------------------------------------------------------------------

  /**
   * Compare what's left each month now vs on a new income, with an optional
   * transition (months at reduced income plus one-off costs) before it starts.
   */
  function incomeChange({ income, newIncome, expenses, savings = 0, transition = null }) {
    const exp = num(expenses);
    const now = num(income) - exp;
    const next = num(newIncome) - exp;
    const out = {
      leftNow: now,
      leftNew: next,
      diffMonthly: next - now,
      diffYearly: (next - now) * 12,
      short: next < 0,
      savingsCoverMonths: next < 0 && num(savings) > 0 ? Math.floor(num(savings) / -next) : next < 0 ? 0 : null,
    };
    if (transition && num(transition.months) > 0) {
      const t = num(transition.months);
      const cost = Math.max(0, exp - num(transition.income)) * t + num(transition.oneOff);
      out.transitionMonths = t;
      out.transitionCost = cost;
      out.savingsAfterTransition = signed(num(savings) - cost);
      out.breakEvenMonths = next > now && cost > 0 ? Math.ceil(cost / (next - now)) : null;
    } else if (transition && num(transition.oneOff) > 0) {
      const cost = num(transition.oneOff);
      out.transitionMonths = 0;
      out.transitionCost = cost;
      out.savingsAfterTransition = signed(num(savings) - cost);
      out.breakEvenMonths = next > now ? Math.ceil(cost / (next - now)) : null;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Essential costs: suggested from the budget, always confirmable by the user
  // ---------------------------------------------------------------------------

  // Suggestions and keys come from the shared budget model (budget-core.js).
  const BC = typeof module === 'object' && module.exports ? require('./budget-core.js') : (typeof self !== 'undefined' ? self : this).BudgetCore;
  const suggestEssential = (name, kind) => BC.suggestEssential(name, kind);
  const essentialKey = (row) => BC.essentialKey(row);
  const legacyKey = (row) => `${row.kind || 'other'}:${String(row.name || '').trim().toLowerCase()}`;

  /**
   * The essentials list and its total.
   * @param {Array<{name, kind, monthly}>} rows  budget costs, monthly, already
   *   in the target currency (NaN when a conversion failed)
   * @param {{items?: Record<string,{on?:boolean, amount?:number}>, extras?: Array<{id,name,amount}>}} saved
   */
  function essentials(rows, saved = {}) {
    const choices = saved.items || {};
    const items = (rows || []).map((r) => {
      const key = essentialKey(r);
      const c = choices[key] || choices[legacyKey(r)] || {};
      const suggested = suggestEssential(r.name, r.kind);
      const budgetAmount = Number(r.monthly);
      const edited = c.amount != null && Number.isFinite(Number(c.amount));
      return {
        key,
        name: String(r.name || '').trim() || 'Unnamed cost',
        kind: r.kind,
        budgetAmount,
        amount: edited ? Math.max(0, Number(c.amount)) : budgetAmount,
        on: typeof c.on === 'boolean' ? c.on : suggested,
        confirmed: typeof c.on === 'boolean',
        suggested,
        edited,
      };
    });
    const extras = (saved.extras || [])
      .map((x) => ({ id: x.id, name: String(x.name || '').trim() || 'Other essential', amount: Math.max(0, Number(x.amount) || 0) }));
    const included = items.filter((i) => i.on);
    const unconverted = included.filter((i) => !Number.isFinite(i.amount));
    const total = unconverted.length
      ? null
      : included.reduce((s, i) => s + i.amount, 0) + extras.reduce((s, x) => s + x.amount, 0);
    return {
      items,
      extras,
      total,
      ok: unconverted.length === 0,
      count: included.length + extras.length,
      unconfirmed: items.filter((i) => !i.confirmed).length,
    };
  }

  // ---------------------------------------------------------------------------
  // Runway scenarios
  // ---------------------------------------------------------------------------

  /** Funds split by how certain they are. Uncertain money is opt-in. */
  function availableFunds({ now = 0, confirmed = 0, uncertain = 0, includeUncertain = false }) {
    const a = num(now);
    const b = num(confirmed);
    const c = num(uncertain);
    return {
      now: a,
      confirmed: b,
      uncertain: c,
      total: a + b + (includeUncertain ? c : 0),
      withUncertain: a + b + c,
      uncertainIncluded: Boolean(includeUncertain) && c > 0,
    };
  }

  const MAX_MONTHS = 600; // 50 years: beyond this a date is meaningless

  /**
   * One runway scenario. Never returns Infinity, NaN or a date it can't stand
   * behind; `status` says which case applies:
   *   invalid    — an input is missing or unconverted
   *   surplus    — income still coming in is more than spending
   *   flat       — income exactly covers spending; funds aren't used
   *   no-funds   — spending exceeds income and there's nothing to draw on
   *   under-month — funds last less than a month
   *   depleting  — funds last `months` months, until `endDate`
   *   decades    — more than 50 years
   */
  function runwayScenario({ funds, expenses, income = 0, today = new Date() }) {
    const f = Number(funds);
    const e = Number(expenses);
    const i = Number(income) || 0;
    if (![f, e, i].every(Number.isFinite) || e < 0 || f < 0 || i < 0) return { status: 'invalid' };
    const burn = Math.round((e - i) * 100) / 100;
    const base = { funds: f, expenses: e, income: i, burn };
    if (burn < 0) return { ...base, status: 'surplus', surplus: -burn };
    if (burn === 0) return { ...base, status: 'flat' };
    if (f <= 0) return { ...base, status: 'no-funds' };
    const months = f / burn;
    if (months > MAX_MONTHS) return { ...base, status: 'decades', months: null };
    const endDate = dateAfter(months, today);
    if (months < 1) return { ...base, status: 'under-month', months, days: Math.max(0, Math.floor(months * DAYS_PER_MONTH)), endDate };
    return { ...base, status: 'depleting', months, endDate };
  }

  // ---------------------------------------------------------------------------
  // Currency: add amounts in different currencies without ever guessing
  // ---------------------------------------------------------------------------

  /**
   * @param {Array<{amount:number, currency:string}>} entries
   * @param {string} target
   * @param {(amount, from, to) => number} convertFn  NaN when no valid rate
   * @returns {{ok:boolean, total:number|null, missing:string[]}}
   */
  function sumInCurrency(entries, target, convertFn) {
    const missing = [];
    let total = 0;
    for (const e of entries || []) {
      const amt = Number(e.amount);
      if (!Number.isFinite(amt) || amt === 0) continue;
      const from = e.currency || target;
      const v = from === target ? amt : convertFn(amt, from, target);
      if (!Number.isFinite(v)) {
        if (!missing.includes(from)) missing.push(from);
        continue;
      }
      total += v;
    }
    return missing.length ? { ok: false, total: null, missing } : { ok: true, total, missing };
  }

  // ---------------------------------------------------------------------------
  // A fixed break (time off, leaving a job): can the funds cover N months?
  // ---------------------------------------------------------------------------

  /**
   * @returns {{status:'invalid'|'covered-by-income'|'affordable'|'short', ...}}
   *   capacity = what can be saved per month today (for "months to close the gap")
   */
  function breakScenario({ funds, expenses, income = 0, months, capacity = 0 }) {
    const f = Number(funds);
    const e = Number(expenses);
    const i = Number(income) || 0;
    const m = Number(months);
    if (![f, e, i, m].every(Number.isFinite) || e < 0 || f < 0 || i < 0 || m <= 0) return { status: 'invalid' };
    const burn = Math.round((e - i) * 100) / 100;
    const base = { funds: f, expenses: e, income: i, burn, months: m };
    if (burn <= 0) return { ...base, status: 'covered-by-income', cost: 0, leftAfter: f };
    const cost = burn * m;
    const left = f - cost;
    if (left >= 0) return { ...base, status: 'affordable', cost, leftAfter: left };
    const shortfall = -left;
    const cap = Number(capacity);
    return {
      ...base,
      status: 'short',
      cost,
      shortfall,
      monthsToSave: Number.isFinite(cap) && cap > 0 ? Math.ceil(shortfall / cap) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // How old are the exchange rates?
  // ---------------------------------------------------------------------------

  const STALE_RATE_DAYS = 3;

  /** Age of a set of rates, and whether it's old enough to warn about. */
  function ratesAge(fetchedAt, now = new Date()) {
    const t = fetchedAt instanceof Date ? fetchedAt.getTime() : Date.parse(fetchedAt);
    if (!Number.isFinite(t)) return { known: false, days: null, stale: true };
    const days = Math.max(0, Math.floor((now.getTime() - t) / 86400000));
    return { known: true, days, stale: days > STALE_RATE_DAYS };
  }

  return {
    breakScenario, ratesAge, STALE_RATE_DAYS,
    goalTime, goalContribution, goalProjection, monthlyEquivalent, growBalance,
    breakdown, capacity, snapshot, emergencyFund, runway, savingsGoal, incomeChange, monthsUntil, addMonths, dateAfter,
    suggestEssential, essentialKey, essentials, availableFunds, runwayScenario, sumInCurrency, MAX_MONTHS,
  };
});
