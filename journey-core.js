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
  function emergencyFund({ essentials, months, saved, monthly, options = [3, 6, 12] }) {
    const ess = num(essentials);
    const have = num(saved);
    const per = num(monthly);
    const targets = options.map((m) => ({ months: m, target: ess * m }));
    if (!months) return { targets, chosen: null };
    const target = ess * months;
    const gap = Math.max(0, target - have);
    return {
      targets,
      chosen: months,
      target,
      saved: have,
      gap,
      covered: gap === 0 && target > 0,
      monthsToBuild: gap > 0 && per > 0 ? Math.ceil(gap / per) : gap === 0 ? 0 : null,
      monthsCoveredNow: ess ? have / ess : null,
    };
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

  return { breakdown, capacity, snapshot, emergencyFund, runway, savingsGoal, incomeChange, monthsUntil, addMonths, dateAfter };
});
