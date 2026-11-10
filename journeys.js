/**
 * Journey calculators: one page per tool at #tool/<id>[/<preset>].
 *
 * Every page has the same shape:
 *   1. The answer — one sentence, one number
 *   2. Behind the answer — the figures that produce it
 *   3. Change the numbers — the levers, editable in place
 *
 * Figures fill in from the budget planner (same data, same currency) but can
 * be typed straight in, so no journey needs a budget first. The maths lives in
 * journey-core.js; this file only gathers inputs and writes the words.
 */
(function () {
  'use strict';

  const J = window.JourneyCore;
  if (!J) return;

  const STORE_KEY = 'budgetBuddyTools_v1';
  let current = null; // the calculator on screen: { id, presetKey }
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Saved values (per browser): the shared savings balance and any figure the
  // user typed over a budget value. Stored with its currency so a later change
  // of income currency converts rather than reinterprets it.
  // ---------------------------------------------------------------------------

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  let store = loadStore();
  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      /* per-viewer convenience */
    }
  }

  // ---------------------------------------------------------------------------
  // Budget context (from the planner)
  // ---------------------------------------------------------------------------

  let lastBudget = null;
  document.addEventListener('budget:recompute', (e) => {
    lastBudget = e.detail;
    if (!current) return;
    // Typing in a calculator field can update the budget (e.g. savings):
    // refresh the answer without rebuilding the field being typed in.
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#toolFields');
    render(!typing);
  });

  function code() {
    return (lastBudget && lastBudget.incomeCode) || (typeof getIncomeCurrency === 'function' ? getIncomeCurrency() : 'USD');
  }

  // Currencies that couldn't be converted while working out the current
  // answer. Never fall back to the unconverted number: 1,000 VND is not
  // 1,000 AUD. An answer that touched a missing rate is put on hold instead.
  let missingRates = new Set();
  let convertedSomething = false;

  function toCode(amount, from) {
    if (!from || from === code() || !Number(amount)) return amount;
    const v = typeof convert === 'function' ? convert(amount, from, code()) : NaN;
    if (!Number.isFinite(v)) {
      missingRates.add(from);
      return NaN;
    }
    convertedSomething = true;
    return v;
  }

  /** Costs as monthly amounts in the income currency, from the shared model. */
  function budgetRows() {
    const m = lastBudget && lastBudget.model;
    if (!m) return [];
    // Unconverted costs stay in the list as NaN so they can't silently drop out.
    if (!m.ok) m.missingRates.forEach((c) => missingRates.add(c));
    if (m.converted) convertedSomething = true;
    return m.moneyOut.items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, currency: i.currency, monthly: i.monthly }));
  }

  function splitMonthly(id) {
    const m = lastBudget && lastBudget.model;
    if (!m) return 0;
    const item = m.planned.items.find((x) => x.id === id);
    return item && Number.isFinite(item.monthly) ? item.monthly : 0;
  }

  function budget() {
    const m = lastBudget && lastBudget.model;
    if (!m) return { has: false, income: 0, fixed: 0, expenses: 0, goals: 0, savings: 0, emergencyMonthly: 0, savingsMonthly: 0 };
    // Missing rates: totals are unknown (not zero), and the answer goes on hold.
    if (!m.ok) m.missingRates.forEach((c) => missingRates.add(c));
    if (m.converted) convertedSomething = true;
    const v = (x) => (m.ok && Number.isFinite(x) ? x : m.ok ? 0 : NaN);
    return {
      has: m.complete.income || m.complete.costs,
      income: v(m.moneyIn.total),
      fixed: v(m.moneyOut.fixed),
      expenses: v(m.moneyOut.total),
      goals: v(m.planned.total),
      savings: v(m.savings.accessible),
      emergencyMonthly: splitMonthly('emergency'),
      savingsMonthly: splitMonthly('savings'),
    };
  }

  // ---------------------------------------------------------------------------
  // Essential costs: suggested from the budget (fixed costs and necessities
  // such as groceries or transport), confirmed and edited by the user.
  // Shared by the runway and emergency fund calculators.
  // ---------------------------------------------------------------------------

  // Essential choices belong to the budget (and so to each scenario): the
  // planner owns them via window.BudgetEssentials.
  function essStore() {
    const e = window.BudgetEssentials ? window.BudgetEssentials.get() : (store.essentials = store.essentials || {});
    e.items = e.items || {};
    e.extras = e.extras || [];
    return e;
  }

  /** Save an essentials change: into the budget draft (and scenario prompt). */
  function saveEss() {
    if (window.BudgetEssentials) window.BudgetEssentials.changed();
    else saveStore();
  }

  // One-off move: the savings figure used to live only in the calculators.
  if (window.BudgetSavings && store.values && store.values.savings && !window.BudgetSavings.get()) {
    const old = store.values.savings;
    if (old && Number(old.v) > 0) window.BudgetSavings.set(old.v, old.c);
    delete store.values.savings;
    saveStore();
  }

  // One-off move: choices made before essentials were saved per scenario.
  if (window.BudgetEssentials && store.essentials && window.BudgetEssentials.isEmpty()) {
    window.BudgetEssentials.set(store.essentials);
    delete store.essentials;
    saveStore();
    window.BudgetEssentials.changed();
  }

  function essentialsList() {
    const saved = essStore();
    const items = {};
    Object.entries(saved.items).forEach(([k, c]) => {
      items[k] = { on: c.on, amount: c.amount ? toCode(c.amount.v, c.amount.c) : undefined };
    });
    const extras = saved.extras.map((x) => ({ id: x.id, name: x.name, amount: x.amount ? toCode(x.amount.v, x.amount.c) : 0 }));
    return J.essentials(budgetRows(), { items, extras });
  }

  function essentialsTotal() {
    const e = essentialsList();
    return e.total == null ? NaN : e.total;
  }

  // ---------------------------------------------------------------------------
  // Fields
  // ---------------------------------------------------------------------------

  /** Budget-linked defaults, with the words shown under the field. */
  const SOURCES = {
    income: () => ({ value: budget().income, label: 'your budget' }),
    expenses: () => ({ value: budget().expenses, label: 'your budget' }),
    essentials: () => ({ value: essentialsTotal(), label: 'your essentials list' }),
    emergencyMonthly: () => ({ value: budget().emergencyMonthly, label: 'your Emergency fund split' }),
    goalMonthly: () => ({ value: budget().savingsMonthly, label: 'your Long-term savings split' }),
    emergencySaved: () => ({ value: budget().savings, label: 'your savings' }),
    savings: () => ({ value: budget().savings, label: 'your budget' }),
  };

  const FIELDS = {
    savings: { label: 'Money you can access now', type: 'money', source: 'savings', help: 'Saved with your budget and used by every calculator.' },
    confirmedMoney: { label: 'Confirmed money coming', type: 'money', help: 'Only what you’ve been told you’ll get, e.g. final pay or leave payout.' },
    uncertainMoney: { label: 'Uncertain or estimated money', type: 'money', help: 'Left out of the results unless you include it.' },
    includeUncertain: { label: 'Include uncertain money in the results', type: 'toggle' },
    essentialsList: { label: 'Essential costs', type: 'essentials' },
    income: { label: 'Monthly income', type: 'money', source: 'income' },
    expenses: { label: 'Monthly spending', type: 'money', source: 'expenses' },
    essentials: { label: 'Essential monthly costs', type: 'money', source: 'essentials' },
    cover: { label: 'Months of cover', type: 'choice', options: [3, 6, 12], unit: 'months' },
    emergencySaved: { label: 'Already set aside', type: 'money', source: 'emergencySaved' },
    emergencyMonthly: { label: 'Adding each month', type: 'money', source: 'emergencyMonthly' },
    incomeDuring: { label: 'Reliable income you’d still have each month', type: 'money', help: 'Only money you can count on, e.g. part-time work.' },
    duration: { label: 'Time off', type: 'choice', options: [3, 6, 12], unit: 'months' },
    goalName: { label: 'What you’re saving for', type: 'text', placeholder: 'e.g. A trip home' },
    goalTarget: { label: 'Target', type: 'money' },
    goalSaved: { label: 'Saved so far', type: 'money' },
    goalMonthly: { label: 'Saving each month', type: 'money', source: 'goalMonthly' },
    goalDeadline: { label: 'By when (optional)', type: 'month' },
    newIncome: { label: 'New monthly income', type: 'money', chips: [-10, -20, -30, -50] },
    transitionMonths: { label: 'Months before the new role pays', type: 'count', placeholder: '0' },
    transitionIncome: { label: 'Income during that time, each month', type: 'money' },
    oneOff: { label: 'One-off costs (course, equipment)', type: 'money' },
  };

  function savedValue(key) {
    const v = store.values && store.values[key];
    if (!v) return null;
    if (typeof v === 'object' && 'v' in v) return FIELDS[key] && FIELDS[key].type === 'money' ? toCode(v.v, v.c) : v.v;
    return v;
  }

  /** A field's value: the user's own figure if they typed one, else the budget's. */
  function value(key) {
    const own = savedValue(key);
    if (own != null && own !== '') return own;
    const f = FIELDS[key];
    if (f && f.source) return SOURCES[f.source]().value;
    if (f && f.default != null) return f.default;
    return null;
  }

  function setValue(key, v) {
    // Savings live in the budget (Income tab), so every page and scenario agrees.
    if (key === 'savings' && window.BudgetSavings) {
      window.BudgetSavings.set(v, code());
      return;
    }
    store.values = store.values || {};
    if (v == null || v === '') delete store.values[key];
    else store.values[key] = { v, c: FIELDS[key].type === 'money' ? code() : undefined };
    saveStore();
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  function money(n) {
    const meta = getCurrencyMeta(code());
    const abs = Math.abs(n);
    const digits = abs >= 100 || abs === 0 ? 0 : meta.decimals;
    const gap = /[A-Za-z]$/.test(meta.symbol) ? ' ' : '';
    // Comma grouping to match what people type in the fields.
    return `${n < 0 ? '−' : ''}${meta.symbol}${gap}${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }
  const pct = (x) => `${Math.round(x * 100)}%`;
  const months = (m) => (m === Infinity ? 'indefinitely' : `${m} month${m === 1 ? '' : 's'}`);
  // Words are English, so dates are too (a Vietnamese phone shouldn't get “tháng 1 năm 2027” mid-sentence).
  const monthYear = (d) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const fromToday = (m) => monthYear(J.addMonths(m));
  /** "early July 2027" — honest precision for a date months away. */
  const partOfMonth = (d) => (d ? `${d.getDate() <= 10 ? 'early' : d.getDate() <= 20 ? 'mid' : 'late'} ${monthYear(d)}` : 'indefinitely');
  const dayMonth = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ---------------------------------------------------------------------------
  // Runway: current spending vs essentials only
  // ---------------------------------------------------------------------------

  const approxMonths = (m) => `${(Math.round(m * 10) / 10).toFixed(1)} months`;
  const dayTime = (d) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  /** Words and figures for one scenario, straight from its result. */
  function describeScenario(r, which, funds) {
    const lead = which === 'current'
      ? 'Based on your current spending and the funds you’ve entered,'
      : 'If you reduced spending to the essential costs you’ve selected,';
    const out = { status: r.status, big: '—', date: '—' };
    switch (r.status) {
      case 'depleting':
        out.big = `About ${approxMonths(r.months)}`;
        out.date = partOfMonth(r.endDate);
        out.sentence = `${lead} your money could last about ${approxMonths(r.months)}.`;
        break;
      case 'under-month':
        out.big = r.days === 1 ? 'About 1 day' : `About ${r.days} days`;
        out.date = dayMonth(r.endDate);
        out.sentence = `${lead} your money could last less than a month: about ${r.days} days.`;
        break;
      case 'decades':
        out.big = '50+ years';
        out.sentence = `${lead} your money could last more than 50 years at this level.`;
        break;
      case 'flat':
        out.big = 'Not drawn down';
        out.sentence = 'Your reliable income matches this spending, so your funds wouldn’t be used up.';
        break;
      case 'surplus':
        out.big = 'Not drawn down';
        out.sentence = `Your reliable income is ${money(r.surplus)} a month more than this spending, so your funds wouldn’t be used up.`;
        break;
      case 'no-funds':
        out.big = 'No funds';
        out.sentence = `With no funds entered, this spending leaves a gap of ${money(r.burn)} a month from the start.`;
        break;
      default:
        out.sentence = which === 'current' ? 'Add your monthly spending to see this.' : 'Choose your essential costs below to see this.';
    }
    const known = r.status !== 'invalid';
    out.rows = [
      ['Monthly spending', known ? money(r.expenses) : '—'],
      ['Reliable income', known ? money(r.income) : '—'],
      [known && r.burn < 0 ? 'Monthly surplus' : 'Monthly shortfall', known ? money(Math.abs(r.burn)) : '—'],
      ['Available funds', money(funds)],
      ['Runway', out.big],
      ['Runs out', out.date],
    ];
    return out;
  }

  /** Inputs shared by every two-scenario page. */
  function scenarioInputs() {
    return {
      spend: value('expenses'),
      income: value('incomeDuring') || 0,
      ess: essentialsList(),
      f: J.availableFunds({
        now: value('savings'),
        confirmed: value('confirmedMoney'),
        uncertain: value('uncertainMoney'),
        includeUncertain: Boolean(value('includeUncertain')),
      }),
      today: new Date(),
    };
  }

  /** What drives the difference between the scenarios, from the figures. */
  function differenceNote(ctx) {
    const gap = ctx.spend - ctx.ess.total;
    if (!(gap > 0.5)) return 'Your essential costs are about the same as your current spending, so the two scenarios are close.';
    const extras = ctx.ess.items.filter((i) => !i.on && Number.isFinite(i.amount)).sort((a, b) => b.amount - a.amount).slice(0, 2).map((i) => i.name.toLowerCase());
    return `The difference comes from ${money(gap)} a month of spending you haven’t marked essential${extras.length ? `, mainly ${extras.join(' and ')}` : ''}.`;
  }

  /** Uncertain money: always show what it changes. `effect(funds)` describes the other case. */
  function uncertainNote(ctx, effect) {
    const { f } = ctx;
    if (!(f.uncertain > 0)) return null;
    const other = effect(f.uncertainIncluded ? f.total - f.uncertain : f.withUncertain);
    return f.uncertainIncluded
      ? `Includes ${money(f.uncertain)} you’re not sure of.${other ? ` Without it, ${other}.` : ''}`
      : `Not included: ${money(f.uncertain)} of uncertain money.${other ? ` If it does arrive, ${other}.` : ''}`;
  }

  function scenarioAssumptions(ctx, extra = []) {
    const { f, spend, ess, income, today } = ctx;
    const own = savedValue('expenses');
    const counted = [`${money(f.now)} available now`];
    if (f.confirmed) counted.push(`${money(f.confirmed)} confirmed`);
    if (f.uncertainIncluded) counted.push(`${money(f.uncertain)} uncertain`);
    const fundsText = `${money(f.total)}${counted.length > 1 ? ` (${counted.join(' + ')})` : ''}${f.uncertain && !f.uncertainIncluded ? `. ${money(f.uncertain)} uncertain, not included` : ''}`;
    const rates = window.BudgetRates ? window.BudgetRates() : null;
    return [
      ['Calculated', dayTime(today)],
      ...extra,
      ['Starting funds', fundsText],
      ['Current spending', Number.isFinite(spend) ? `${money(spend)} a month, ${own != null && own !== '' ? 'your figure' : 'from your budget'}` : '—'],
      ['Essential spending', ess.total != null ? `${money(ess.total)} a month, ${ess.count} cost${ess.count === 1 ? '' : 's'}` : '—'],
      ['Reliable income', income ? `${money(income)} a month` : 'None entered'],
      ['Currency', convertedSomething && rates ? `${code()}. ${rates.text}` : code()],
    ];
  }

  function scenarioNotes(ctx, A, B, effect) {
    const notes = [];
    if (A.status !== 'invalid' && B.status !== 'invalid') notes.push(differenceNote(ctx));
    const u = uncertainNote(ctx, effect);
    if (u) notes.push(u);
    if (ctx.ess.unconfirmed > 0) notes.push('Which costs count as essential is our suggestion until you check it. Review them below.');
    return notes;
  }

  function twoScenarioRunway() {
    const ctx = scenarioInputs();
    const { spend, income, ess, f, today } = ctx;
    if (!spend && !ess.total) return { empty: { title: 'No monthly spending yet', text: 'Type your spending below, or fill in your budget.' } };

    const A = J.runwayScenario({ funds: f.total, expenses: spend, income, today });
    const B = ess.count ? J.runwayScenario({ funds: f.total, expenses: ess.total == null ? NaN : ess.total, income, today }) : { status: 'invalid' };
    return {
      scenarios: [
        { title: 'Current spending', ...describeScenario(A, 'current', f.total) },
        { title: 'Essentials only', ...describeScenario(B, 'essentials', f.total) },
      ],
      notes: scenarioNotes(ctx, A, B, (funds) => {
        const o = J.runwayScenario({ funds, expenses: spend, income, today });
        return o.status === 'depleting' ? `current spending would last about ${approxMonths(o.months)}` : o.status === 'under-month' ? `current spending would last about ${o.days} days` : null;
      }),
      figures: scenarioAssumptions(ctx),
      behindTitle: 'How this is worked out',
      footnote: 'Estimates from the figures you’ve entered. Dates assume your spending and income stay the same each month.',
    };
  }

  // ---------------------------------------------------------------------------
  // A fixed break (time off, leaving a job): current spending vs essentials
  // ---------------------------------------------------------------------------

  function describeBreak(r, which, funds, p) {
    const how = which === 'current' ? 'on your current spending' : 'on the essential costs you’ve selected';
    const out = { status: r.status, big: '—' };
    const n = r.months;
    const gapTime = r.monthsToSave ? `about ${months(r.monthsToSave)} at your current saving rate` : null;
    switch (r.status) {
      case 'covered-by-income':
        out.big = 'Covered';
        out.sentence = `Your reliable income would cover ${n} months ${how}, so the break wouldn’t use your funds.`;
        break;
      case 'affordable':
        out.big = p === 'leave' ? money(r.cost) : 'Yes';
        out.sentence = p === 'leave'
          ? `To cover ${n} months ${how} you’d need about ${money(r.cost)}. You already have enough, with ${money(r.leftAfter)} to spare.`
          : `${n} months ${how} would cost about ${money(r.cost)}. You’d have about ${money(r.leftAfter)} left afterwards.`;
        break;
      case 'short':
        out.big = p === 'leave' ? money(r.cost) : `${money(r.shortfall)} short`;
        out.sentence = p === 'leave'
          ? `To cover ${n} months ${how} you’d need about ${money(r.cost)}: ${money(r.shortfall)} more than you have${gapTime ? `, ${gapTime}` : ''}.`
          : `${n} months ${how} would cost about ${money(r.cost)}, ${money(r.shortfall)} more than your funds${gapTime ? `. That’s ${gapTime}` : ''}.`;
        break;
      default:
        out.sentence = which === 'current' ? 'Add your monthly spending to see this.' : 'Choose your essential costs below to see this.';
    }
    const known = r.status !== 'invalid';
    out.rows = [
      ['Monthly spending', known ? money(r.expenses) : '—'],
      ['Reliable income', known ? money(r.income) : '—'],
      [known && r.burn < 0 ? 'Monthly surplus' : 'Monthly shortfall', known ? money(Math.abs(r.burn)) : '—'],
      [`Cost of ${n || '—'} months`, known ? money(r.cost) : '—'],
      ['Available funds', money(funds)],
      [r.status === 'short' ? 'Short by' : 'Left afterwards', known ? money(r.status === 'short' ? r.shortfall : r.leftAfter) : '—'],
    ];
    if (r.status === 'short') out.rows.push(['Time to save the gap', r.monthsToSave ? months(r.monthsToSave) : '—']);
    return out;
  }

  function twoScenarioBreak(p, preset) {
    const ctx = scenarioInputs();
    const { spend, income, ess, f } = ctx;
    if (!spend && !ess.total) return { empty: { title: 'No monthly spending yet', text: 'Type your spending below, or fill in your budget.' } };
    const n = Number(value('duration') || preset.defaults.duration || 6);
    const b = budget();
    // What you can put aside each month today, to close any gap.
    const capacity = b.income > 0 && Number.isFinite(b.expenses) ? Math.max(0, b.income - b.expenses) : 0;
    const A = J.breakScenario({ funds: f.total, expenses: spend, income, months: n, capacity });
    const B = ess.count ? J.breakScenario({ funds: f.total, expenses: ess.total == null ? NaN : ess.total, income, months: n, capacity }) : { status: 'invalid' };
    const notes = scenarioNotes(ctx, A, B, (funds) => {
      const o = J.breakScenario({ funds, expenses: spend, income, months: n, capacity });
      return o.status === 'affordable' ? `you’d have about ${money(o.leftAfter)} left on current spending` : o.status === 'short' ? `you’d be ${money(o.shortfall)} short on current spending` : null;
    });
    if (!capacity && (A.status === 'short' || B.status === 'short')) notes.push('Add your income to the budget to see how long it would take to save the gap.');
    return {
      scenarios: [
        { title: 'Current spending', ...describeBreak(A, 'current', f.total, p) },
        { title: 'Essentials only', ...describeBreak(B, 'essentials', f.total, p) },
      ],
      notes,
      figures: scenarioAssumptions(ctx, [['Length', months(n)], ['Saving now', capacity ? `${money(capacity)} a month, from your budget` : 'Not known']]),
      behindTitle: 'How this is worked out',
      footnote: 'Estimates from the figures you’ve entered. Assumes your spending and income stay the same each month.',
    };
  }

  // ---------------------------------------------------------------------------
  // Tools: fields shown, and the answer they produce
  // ---------------------------------------------------------------------------

  const TOOLS = {
    breakdown: {
      name: 'Spending breakdown',
      icon: 'chart-pie',
      presets: {
        default: { q: 'Where does my money go each month?' },
        living: { q: 'How much does it really cost to live each month?' },
      },
      fields: [],
      answer(p) {
        const b = J.breakdown(budgetRows());
        if (!b.total) return { empty: { title: 'No costs yet', text: 'Add your costs to the budget and they’ll be ranked here.' } };
        const names = b.top.map((r) => r.name.toLowerCase());
        const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
        return {
          main: p === 'living'
            ? `Living costs you ${money(b.total)} a month.`
            : `${b.top.length === 1 ? 'One cost takes' : `${b.top.length} costs take`} ${pct(b.topShare)} of your spending: ${list}.`,
          figures: [
            ['Fixed', money(b.fixed)],
            ['Flexible (you can change these)', money(b.flexible)],
            ['Total a month', money(b.total)],
            ['Total a year', money(b.total * 12)],
          ],
          list: b.items.map((r) => ({ label: r.name, value: money(r.monthly), share: r.share, kind: r.kind })),
        };
      },
    },

    capacity: {
      name: 'Savings capacity',
      icon: 'coins',
      presets: {
        default: { q: 'How much can I realistically save?' },
        year: { q: 'How much can I save over the next year?' },
        needed: { q: 'How much income do I need to cover my expenses?' },
      },
      fields: ['income', 'expenses'],
      answer(p) {
        const inc = value('income');
        const exp = value('expenses');
        const b = budget();
        const flexible = Math.max(0, b.expenses - b.fixed);
        const c = J.capacity({ income: inc, expenses: exp, goals: b.goals, flexible });
        if (p === 'needed') {
          if (!exp) return { empty: { title: 'No costs yet', text: 'Type your monthly costs below, or fill in your budget.' } };
          return {
            main: `You need ${money(c.incomeNeeded)} a month to cover your costs.`,
            sub: b.goals > 0 ? `${money(c.incomeNeededWithGoals)} with your savings & goals.` : '',
            state: inc ? (inc >= c.incomeNeeded ? 'good' : 'warn') : '',
            figures: inc ? [[`${money(inc)} income − ${money(exp)} costs`, money(inc - exp)]] : [],
          };
        }
        if (!inc) return { empty: { title: 'No income yet', text: 'Type your income and costs below, or fill in your budget.' } };
        if (c.monthly <= 0) {
          return {
            main: `Your costs are ${money(-c.monthly)} a month more than you earn.`,
            state: 'bad',
            figures: [[`${money(inc)} income − ${money(exp)} costs`, money(c.monthly)]],
          };
        }
        const notes = [];
        if (c.goalsGap > 0) notes.push(`Your savings & goals plan ${money(b.goals)} a month: ${money(c.goalsGap)} more than you have.`);
        if (c.trimTenPercent > 0) notes.push(`Cut flexible spending by 10% to save ${money(c.trimTenPercent)} more a month.`);
        return {
          main: p === 'year'
            ? `You could save ${money(c.yearly)} over the next year.`
            : `You can save ${money(c.monthly)} a month, ${pct(c.rate)} of your income.`,
          state: 'good',
          figures: [
            [`${money(inc)} income − ${money(exp)} costs`, `${money(c.monthly)} a month`],
            ['× 12', `${money(c.yearly)} a year`],
          ],
          notes,
        };
      },
    },

    snapshot: {
      name: 'Money snapshot',
      icon: 'activity',
      presets: { default: { q: 'What does my financial situation look like?' } },
      fields: ['savings'],
      answer() {
        const b = budget();
        if (!b.income) return { empty: { title: 'Your budget is empty', text: 'Fill in your income and costs to see your snapshot.' }, hideFields: true };
        const top = J.breakdown(budgetRows()).items[0];
        const s = J.snapshot({ income: b.income, fixed: b.fixed, expenses: b.expenses, biggest: top, savings: value('savings') });
        const kept = s.savingsRate;
        return {
          main: kept >= 0 ? `You keep ${pct(kept)} of what you earn.` : `You spend ${pct(-kept)} more than you earn.`,
          state: kept >= 0 ? 'good' : 'bad',
          tiles: [
            { label: 'Fixed costs', value: pct(s.fixedShare), note: 'of your income' },
            { label: 'Biggest cost', value: s.biggest ? money(s.biggest.monthly) : '—', note: s.biggest ? s.biggest.name : 'None yet' },
            { label: 'Runway', value: s.runwayMonths != null ? months(s.runwayMonths) : '—', note: s.runwayMonths != null ? 'without income' : 'Add savings below' },
          ],
        };
      },
    },

    emergency: {
      name: 'Emergency fund',
      icon: 'life-buoy',
      presets: { default: { q: 'How much should I have in an emergency fund?' } },
      // Months of cover is chosen on the three targets in the answer itself.
      fields: ['emergencySaved', 'emergencyMonthly', 'essentialsList'],
      answer() {
        const ess = essentialsTotal();
        if (!ess) return { empty: { title: 'No essential costs yet', text: 'Add them below, or fill in your budget.' } };
        const per = value('emergencyMonthly');
        const r = J.emergencyFund({ essentials: ess, months: value('cover'), saved: value('emergencySaved'), monthly: per });
        const targets = r.targets.map((t) => ({ label: `${t.months} months`, value: money(t.target), key: t.months }));
        if (!r.chosen) return { main: 'How many months would you like covered?', sub: `Your essentials are ${money(ess)} a month.`, targets };
        const fig = [[`${money(ess)} × ${r.chosen} months`, money(r.target)], ['Set aside', `− ${money(r.saved)}`]];
        if (r.covered) return { main: `You’re covered for ${r.chosen} months.`, sub: `${money(r.saved)} would last about ${Math.floor(r.monthsCoveredNow)} months.`, state: 'good', targets, figures: fig };
        if (r.monthsToBuild != null) fig.push([`${money(r.gap)} ÷ ${money(per)} a month`, months(r.monthsToBuild)]);
        return {
          main: `${money(r.gap)} to go to reach ${money(r.target)}.`,
          sub: r.monthsToBuild != null ? `About ${months(r.monthsToBuild)} at your current rate, by ${fromToday(r.monthsToBuild)}.` : 'Add a monthly amount below to see when.',
          state: 'warn',
          targets,
          figures: fig,
        };
      },
    },

    runway: {
      name: 'Financial runway',
      icon: 'hourglass',
      presets: {
        default: { q: 'How long could I manage without an income?', fields: ['savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], twoScenarios: true },
        timeoff: { q: 'Could I afford to take six months off?', fields: ['duration', 'savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], defaults: { duration: 6 }, twoScenarios: 'break' },
        leave: { q: 'How much should I save before leaving my job?', fields: ['duration', 'savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], defaults: { duration: 6 }, twoScenarios: 'break' },
        jobloss: { q: 'What would happen if I lost my job?', fields: ['savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], twoScenarios: true },
      },
      answer(p, preset) {
        return preset.twoScenarios === 'break' ? twoScenarioBreak(p, preset) : twoScenarioRunway();
      },
    },

    goal: {
      name: 'Savings goal',
      icon: 'target',
      presets: { default: { q: 'How can I reach my savings goal?' } },
      fields: ['goalName', 'goalTarget', 'goalSaved', 'goalMonthly', 'goalDeadline'],
      answer() {
        const target = value('goalTarget');
        if (!target) return { empty: { title: 'No target yet', text: 'Enter what you’re saving for and how much below.' } };
        const name = String(value('goalName') || '').trim();
        const g = J.savingsGoal({ target, saved: value('goalSaved'), monthly: value('goalMonthly'), deadline: value('goalDeadline') });
        const what = name || money(target);
        if (g.reached) return { main: `You’ve already reached ${what}.`, state: 'good' };
        if (g.deadlineMonths) {
          const by = monthYear(J.addMonths(g.deadlineMonths));
          const fig = [[`${money(g.gap)} ÷ ${months(g.deadlineMonths)}`, `${money(g.requiredMonthly)} a month`]];
          if (g.onTrack) return { main: `You’re on track to reach ${what} by ${monthYear(g.reachDate)}.`, sub: `Ahead of your ${by} deadline.`, state: 'good', figures: fig };
          return {
            main: `Save ${money(g.requiredMonthly)} a month to reach ${what} by ${by}.`,
            sub: g.monthly > 0 ? `${money(g.extraNeeded)} more than now.` : '',
            state: 'warn',
            figures: fig,
          };
        }
        if (g.months == null) return { empty: { title: 'How much each month?', text: 'Add a monthly amount below to see when you’ll get there.' } };
        return {
          main: `You’ll reach ${what} by ${monthYear(g.reachDate)}.`,
          state: 'good',
          figures: [[`${money(g.gap)} ÷ ${money(g.monthly)} a month`, months(g.months)]],
        };
      },
    },

    income: {
      name: 'Income change',
      icon: 'trending-down',
      presets: {
        default: { q: 'What happens if my income decreases?', fields: ['newIncome', 'income', 'expenses', 'savings'] },
        less: { q: 'Could I afford to work less?', fields: ['newIncome', 'income', 'expenses', 'savings'], chips: [-20, -40, -50] },
        career: { q: 'Could I afford to change careers?', fields: ['newIncome', 'transitionMonths', 'transitionIncome', 'oneOff', 'income', 'expenses', 'savings'], chips: [] },
      },
      answer(p) {
        const inc = value('income');
        const exp = value('expenses');
        const next = value('newIncome');
        if (!inc || !exp) return { empty: { title: 'No income or costs yet', text: 'Type them below, or fill in your budget.' } };
        if (next == null || next === '') return { empty: { title: p === 'career' ? 'What would the new role pay?' : 'What would you earn instead?', text: p === 'career' ? 'Enter the new monthly salary below.' : 'Enter it below, or tap a percentage.' }, noBudgetLink: true };
        const career = p === 'career';
        const c = J.incomeChange({
          income: inc, newIncome: next, expenses: exp, savings: value('savings'),
          transition: career ? { months: value('transitionMonths'), income: value('transitionIncome'), oneOff: value('oneOff') } : null,
        });
        const fig = [
          [`Now: ${money(inc)} − ${money(exp)} costs`, money(c.leftNow)],
          [`New: ${money(next)} − ${money(exp)} costs`, money(c.leftNew)],
        ];
        if (career && c.transitionCost != null) {
          const t = c.transitionMonths;
          const costFig = t ? [[`${t} months × ${money(Math.max(0, exp - (value('transitionIncome') || 0)))} shortfall`, money(c.transitionCost - (value('oneOff') || 0))]] : [];
          if (value('oneOff') > 0) costFig.push(['One-off costs', money(value('oneOff'))]);
          const ahead = c.breakEvenMonths ? ` Ahead after ${months(c.breakEvenMonths)} in the new role.` : '';
          const cover = value('savings') > 0 && c.savingsAfterTransition < 0 ? ` Your savings are ${money(-c.savingsAfterTransition)} short.` : '';
          return {
            main: `The switch costs ${money(c.transitionCost)}.`,
            sub: (c.short ? `Then you’d be ${money(-c.leftNew)} short each month.` : `Then you’d have ${money(c.leftNew)} a month left.`) + ahead + cover,
            state: c.short || c.savingsAfterTransition < 0 ? 'warn' : 'good',
            figures: [...costFig, ...fig],
          };
        }
        if (c.short) {
          return {
            main: `You’d be ${money(-c.leftNew)} short each month.`,
            sub: c.savingsCoverMonths ? `Your savings would cover that for ${months(c.savingsCoverMonths)}.` : 'Add your savings below to see how long they’d last.',
            state: 'bad',
            figures: fig,
          };
        }
        return {
          main: `You’d have ${money(c.leftNew)} left a month, down from ${money(c.leftNow)}.`,
          sub: c.diffYearly < 0 ? `${money(-c.diffYearly)} less a year.` : `${money(c.diffYearly)} more a year.`,
          state: c.leftNew > 0 ? 'good' : 'warn',
          figures: fig,
        };
      },
    },
  };

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------


  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function presetOf(id, key) {
    const tool = TOOLS[id];
    const p = (tool && tool.presets[key]) || tool.presets.default;
    return { fields: p.fields || tool.fields, defaults: p.defaults || {}, q: p.q, chips: p.chips, twoScenarios: p.twoScenarios || false };
  }

  function fieldHint(key) {
    const f = FIELDS[key];
    if (key === 'savings') return { text: f.help };
    const own = savedValue(key);
    if (f.source) {
      const src = SOURCES[f.source]();
      const hasOwn = own != null && own !== '';
      if (hasOwn && src.value > 0 && Math.abs(own - src.value) > 0.5) {
        return { text: 'Your figure ·', reset: `Use ${src.label} (${money(src.value)})` };
      }
      if (!hasOwn && src.value > 0) return { text: `From ${src.label}.` };
      if (!hasOwn && f.help) return { text: f.help };
      return null;
    }
    return f.help ? { text: f.help } : null;
  }

  let essOpen = false; // keep the essentials list open across re-renders

  /** The essentials list: tick, edit, reset or add costs; total updates live. */
  function buildEssentials() {
    const wrap = el('div', 'tool-field tool-field--essentials');
    const det = document.createElement('details');
    det.className = 'ess';
    det.open = essOpen;
    det.addEventListener('toggle', () => {
      essOpen = det.open;
    });
    const sum = el('summary', 'ess-summary');
    sum.appendChild(el('span', 'ess-summary-label', 'Essential costs'));
    const total = el('span', 'ess-summary-total');
    total.id = 'essTotal';
    sum.appendChild(total);
    det.appendChild(sum);

    det.appendChild(el('p', 'ess-intro', 'Suggested from your budget: fixed costs and necessities like groceries and transport. Untick what doesn’t apply, change amounts, or add what’s missing.'));

    const list = essentialsList();
    const ul = el('ul', 'ess-list');
    const sym = getCurrencyMeta(code()).symbol;

    const moneyInput = (value, label, onInput) => {
      const w = el('div', 'money-input-wrap input-wrap ess-amount');
      const sp = el('span', 'money-symbol', sym);
      sp.setAttribute('aria-hidden', 'true');
      w.appendChild(sp);
      const inp = document.createElement('input');
      inp.className = 'cell-input';
      inp.setAttribute('aria-label', label);
      attachAmountInputFormatting(inp, () => getCurrencyMeta(code()).decimals);
      inp.placeholder = '0';
      if (Number.isFinite(value) && value > 0) {
        inp.value = String(Math.round(value * 100) / 100);
        inp.formatAmountValue();
      }
      inp.addEventListener('input', () => onInput(inp.value.trim() === '' ? null : parseAmount(inp.value)));
      w.appendChild(inp);
      return w;
    };

    list.items.forEach((item) => {
      const li = el('li', 'ess-item' + (item.on ? '' : ' is-off'));
      const lab = el('label', 'ess-check');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.on;
      cb.addEventListener('change', () => {
        const st = essStore();
        st.items[item.key] = { ...(st.items[item.key] || {}), on: cb.checked };
        saveEss();
        li.classList.toggle('is-off', !cb.checked);
        li.querySelector('.ess-tag')?.remove();
        render(false);
      });
      lab.appendChild(cb);
      const text = el('span', 'ess-check-text');
      text.appendChild(el('span', 'ess-name', item.name));
      if (!item.confirmed) text.appendChild(el('span', 'ess-tag', 'Suggested'));
      lab.appendChild(text);
      li.appendChild(lab);
      li.appendChild(
        moneyInput(item.amount, `${item.name}, essential amount per month`, (v) => {
          const st = essStore();
          const prev = st.items[item.key] || {};
          if (v == null) delete prev.amount;
          else prev.amount = { v, c: code() };
          st.items[item.key] = prev;
          saveEss();
          const edited = v != null && Math.abs(v - item.budgetAmount) > 0.005;
          let meta = li.querySelector('.ess-meta');
          if (edited && !meta && Number.isFinite(item.budgetAmount)) li.appendChild(essMeta(item));
          else if (!edited && meta) meta.remove();
          render(false);
        })
      );
      if (item.edited && Number.isFinite(item.budgetAmount)) li.appendChild(essMeta(item));
      ul.appendChild(li);
    });

    function essMeta(item) {
      const meta = el('p', 'ess-meta', `Budget: ${money(item.budgetAmount)} `);
      const reset = el('button', 'tool-reset', 'Reset');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        const st = essStore();
        if (st.items[item.key]) delete st.items[item.key].amount;
        saveEss();
        render(true);
      });
      meta.appendChild(reset);
      return meta;
    }

    essStore().extras.forEach((x, i) => {
      const li = el('li', 'ess-item ess-extra');
      const name = document.createElement('input');
      name.type = 'text';
      name.className = 'cell-input ess-extra-name';
      name.placeholder = 'e.g. Medication';
      name.setAttribute('aria-label', 'Essential cost name');
      name.value = x.name || '';
      name.addEventListener('input', () => {
        essStore().extras[i].name = name.value;
        saveEss();
      });
      li.appendChild(name);
      li.appendChild(
        moneyInput(x.amount ? toCode(x.amount.v, x.amount.c) : NaN, `${x.name || 'Added cost'}, amount per month`, (v) => {
          essStore().extras[i].amount = v == null ? null : { v, c: code() };
          saveEss();
          render(false);
        })
      );
      const rm = el('button', 'ess-remove', '✕');
      rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${x.name || 'this cost'}`);
      rm.addEventListener('click', () => {
        essStore().extras.splice(i, 1);
        saveEss();
        render(true);
      });
      li.appendChild(rm);
      ul.appendChild(li);
    });
    det.appendChild(ul);
    if (!list.items.length && !essStore().extras.length) {
      det.appendChild(el('p', 'ess-intro', 'No budget costs yet. Add essential costs here, or fill in your budget.'));
    }

    const add = el('button', 'ess-add', '+ Add an essential cost');
    add.type = 'button';
    add.addEventListener('click', () => {
      essStore().extras.push({ id: `x${Date.now()}`, name: '', amount: null });
      saveEss();
      essOpen = true;
      render(true);
      const names = document.querySelectorAll('.ess-extra-name');
      if (names.length) names[names.length - 1].focus();
    });
    const actions = el('div', 'ess-actions');
    actions.appendChild(add);
    if (list.unconfirmed > 0) {
      // Explicit confirmation: suggestions become the user's own choices.
      const ok = el('button', 'ess-confirm', 'These are right');
      ok.type = 'button';
      ok.addEventListener('click', () => {
        const st = essStore();
        essentialsList().items.forEach((i) => {
          st.items[i.key] = { ...(st.items[i.key] || {}), on: i.on };
        });
        saveEss();
        render(true);
      });
      actions.appendChild(ok);
    }
    det.appendChild(actions);
    wrap.appendChild(det);
    return wrap;
  }

  function updateEssentialsSummary() {
    const t = $('essTotal');
    if (!t) return;
    const e = essentialsList();
    t.textContent = e.total == null ? '—' : `${money(e.total)} a month · ${e.count} cost${e.count === 1 ? '' : 's'}`;
  }

  function buildField(key, preset) {
    const f = FIELDS[key];
    if (f.type === 'essentials') return buildEssentials();
    if (f.type === 'toggle') {
      const wrap = el('div', 'tool-field tool-field--toggle');
      const lab = el('label', 'tool-toggle');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `tf-${key}`;
      cb.checked = Boolean(value(key));
      cb.addEventListener('change', () => {
        setValue(key, cb.checked ? true : null);
        render(false);
      });
      lab.appendChild(cb);
      lab.appendChild(el('span', '', f.label));
      wrap.appendChild(lab);
      return wrap;
    }
    const wrap = el('div', `tool-field tool-field--${f.type}`);
    const id = `tf-${key}`;
    const label = el('label', 'tool-field-label', f.label);
    label.htmlFor = id;
    wrap.appendChild(label);

    if (f.type === 'choice') {
      label.removeAttribute('for');
      const group = el('div', 'segmented tool-choice');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', f.label);
      const chosen = Number(value(key) || preset.defaults[key] || 0);
      f.options.forEach((opt) => {
        const lab = el('label', 'segmented-option');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = id;
        input.value = String(opt);
        input.checked = chosen === opt;
        input.addEventListener('change', () => {
          setValue(key, opt);
          $('toolTitle').textContent = titleFor(preset);
          render(false);
        });
        lab.appendChild(input);
        lab.appendChild(el('span', '', `${opt} ${f.unit}`));
        group.appendChild(lab);
      });
      wrap.appendChild(group);
      return wrap;
    }

    const inputWrap = el('div', f.type === 'money' ? 'money-input-wrap input-wrap' : 'input-wrap');
    const input = document.createElement('input');
    input.id = id;
    input.className = 'cell-input';
    input.dataset.key = key;
    if (f.type === 'money') {
      const sym = el('span', 'money-symbol', getCurrencyMeta(code()).symbol);
      sym.setAttribute('aria-hidden', 'true');
      inputWrap.appendChild(sym);
      attachAmountInputFormatting(input, () => getCurrencyMeta(code()).decimals);
      const v = value(key);
      input.placeholder = '0';
      if (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) !== 0) {
        input.value = String(Math.round(Number(v) * 100) / 100);
        input.formatAmountValue();
      }
    } else if (f.type === 'month') {
      input.type = 'month';
      input.min = new Date().toISOString().slice(0, 7);
      input.value = value(key) || '';
    } else if (f.type === 'count') {
      input.type = 'text';
      input.inputMode = 'numeric';
      input.placeholder = f.placeholder || '';
      input.value = value(key) || '';
    } else {
      input.type = 'text';
      input.placeholder = f.placeholder || '';
      input.value = value(key) || '';
    }
    input.addEventListener('input', () => {
      let v;
      if (f.type === 'money') v = input.value.trim() === '' ? null : parseAmount(input.value);
      else if (f.type === 'count') v = input.value.trim() === '' ? null : Math.max(0, Math.round(Number(input.value.replace(/\D/g, '')) || 0));
      else v = input.value;
      setValue(key, v);
      render(false);
    });
    inputWrap.appendChild(input);
    wrap.appendChild(inputWrap);

    const chips = key === 'newIncome' ? (preset.chips || f.chips) : null;
    if (chips && chips.length) {
      const row = el('div', 'tool-chips');
      chips.forEach((c) => {
        const b = el('button', 'tool-chip', `${c}%`);
        b.type = 'button';
        b.setAttribute('aria-label', `${Math.abs(c)}% less than now`);
        b.addEventListener('click', () => {
          const base = value('income');
          if (!base) return;
          const v = Math.round(base * (1 + c / 100));
          setValue('newIncome', v);
          render(true);
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
    }

    const hint = el('p', 'tool-field-hint');
    hint.dataset.hintFor = key;
    wrap.appendChild(hint);
    return wrap;
  }

  function renderHints() {
    document.querySelectorAll('[data-hint-for]').forEach((p) => {
      const h = fieldHint(p.dataset.hintFor);
      p.textContent = '';
      if (!h) return;
      p.appendChild(document.createTextNode(h.text + ' '));
      if (h.reset) {
        const b = el('button', 'tool-reset', h.reset);
        b.type = 'button';
        b.addEventListener('click', () => {
          setValue(p.dataset.hintFor, null);
          render(true);
        });
        p.appendChild(b);
      }
    });
  }

  function renderAnswer() {
    const { id, presetKey } = current;
    const tool = TOOLS[id];
    const preset = presetOf(id, presetKey);
    missingRates = new Set();
    convertedSomething = false;
    let a = tool.answer(presetKey, preset) || {};
    // Any figure that needed a rate we don't have: hold the answer, say why.
    if (missingRates.size) a = onHold([...missingRates]);

    // Empty: one clear card that says so, instead of an answer.
    const empty = $('toolEmpty');
    empty.hidden = !a.empty;
    $('toolAnswer').hidden = Boolean(a.empty);
    if (a.empty) {
      $('toolEmptyTitle').textContent = a.empty.title;
      $('toolEmptyText').textContent = a.empty.text;
      $('toolEmptyLink').hidden = Boolean(a.noBudgetLink);
    }
    $('toolEmptyRetry').hidden = !a.retry;
    empty.dataset.kind = a.hold ? 'hold' : '';

    // Two scenarios side by side (stacked on phones), instead of one answer.
    const sc = $('toolScenarios');
    sc.innerHTML = '';
    sc.hidden = !a.scenarios;
    if (a.scenarios) {
      $('toolAnswer').hidden = true;
      a.scenarios.forEach((x, i) => {
        const card = el('section', `tool-scenario tool-scenario--${i === 0 ? 'current' : 'essentials'}`);
        card.dataset.status = x.status;
        card.appendChild(el('h2', 'tool-scenario-title', x.title));
        card.appendChild(el('p', 'tool-scenario-big', x.big));
        card.appendChild(el('p', 'tool-scenario-text', x.sentence));
        const dl = el('dl', 'tool-figures tool-scenario-figures');
        x.rows.forEach(([k, v]) => {
          const row = el('div', 'tool-figure');
          row.appendChild(el('dt', '', k));
          row.appendChild(el('dd', '', v));
          dl.appendChild(row);
        });
        card.appendChild(dl);
        sc.appendChild(card);
      });
    }
    // Old exchange rates: say so wherever converted amounts were used.
    const rates = window.BudgetRates ? window.BudgetRates() : null;
    const stale = $('toolStale');
    const showStale = Boolean(!a.empty && convertedSomething && rates && rates.available && rates.age && rates.age.stale);
    stale.hidden = !showStale;
    if (showStale) {
      $('toolStaleText').textContent = rates.age.known
        ? `Exchange rates are ${rates.age.days} days old${rates.cached ? ' (a saved copy)' : ''}, so amounts converted from other currencies may be off.`
        : 'We don’t know how old these exchange rates are, so converted amounts may be off.';
    }

    $('toolBehindTitle').textContent = a.behindTitle || 'Behind the answer';
    $('toolFootnote').textContent = a.footnote || '';
    $('toolFootnote').hidden = !a.footnote;
    $('toolAdjust').hidden = !presetOf(current.id, current.presetKey).fields.length || Boolean(a.hideFields);
    $('toolSource').hidden = Boolean(a.empty); // the empty card already links to the budget

    const card = $('toolAnswer');
    card.dataset.state = a.state || '';
    $('toolAnswerMain').textContent = a.main || '';
    $('toolAnswerSub').textContent = a.sub || '';
    $('toolAnswerSub').hidden = !a.sub;

    // Emergency fund: the three targets, tap to choose.
    const targets = $('toolTargets');
    targets.innerHTML = '';
    targets.hidden = !a.targets;
    if (a.targets) {
      const chosen = Number(value('cover') || 0);
      a.targets.forEach((t) => {
        const b = el('button', 'tool-target' + (chosen === t.key ? ' is-active' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(chosen === t.key));
        b.appendChild(el('span', 'tool-target-label', t.label));
        b.appendChild(el('strong', 'tool-target-value', t.value));
        b.addEventListener('click', () => {
          setValue('cover', t.key);
          render(true);
        });
        targets.appendChild(b);
      });
    }

    // Snapshot tiles
    const tiles = $('toolTiles');
    tiles.innerHTML = '';
    tiles.hidden = !a.tiles;
    (a.tiles || []).forEach((t) => {
      const d = el('div', 'tool-tile');
      d.appendChild(el('span', 'tool-tile-label', t.label));
      d.appendChild(el('strong', 'tool-tile-value', t.value));
      d.appendChild(el('span', 'tool-tile-note', t.note));
      tiles.appendChild(d);
    });

    // Behind the answer
    const fig = $('toolFigures');
    fig.innerHTML = '';
    (a.figures || []).forEach(([k, v]) => {
      const row = el('div', 'tool-figure');
      row.appendChild(el('dt', '', k));
      row.appendChild(el('dd', '', v));
      fig.appendChild(row);
    });
    const list = $('toolRankList');
    list.innerHTML = '';
    (a.list || []).forEach((r) => {
      const li = el('li', `tool-rank tool-rank--${r.kind}`);
      const top = el('div', 'tool-rank-top');
      top.appendChild(el('span', 'tool-rank-name', r.label));
      top.appendChild(el('span', 'tool-rank-value', `${r.value} · ${pct(r.share)}`));
      li.appendChild(top);
      const bar = el('div', 'tool-rank-bar');
      const fill = el('span');
      fill.style.width = `${Math.max(2, r.share * 100)}%`;
      bar.appendChild(fill);
      li.appendChild(bar);
      list.appendChild(li);
    });
    // Scenario notes (what drives the difference, uncertain money) sit under
    // the two scenarios; other notes go with the working.
    const notes = $('toolNotes');
    const scNotes = $('toolScenarioNotes');
    notes.innerHTML = '';
    scNotes.innerHTML = '';
    (a.notes || []).forEach((n) => (a.scenarios ? scNotes : notes).appendChild(el('li', '', n)));
    scNotes.hidden = !(a.scenarios && a.notes && a.notes.length);
    $('toolBehind').hidden = Boolean(a.empty) || (!(a.figures && a.figures.length) && !(a.list && a.list.length) && !(!a.scenarios && a.notes && a.notes.length));
    $('toolColumns').classList.toggle('is-single', $('toolBehind').hidden || $('toolAdjust').hidden);
    renderHints();
    updateEssentialsSummary();
  }

  /** "Could I afford to take six months off?" follows the length chosen. */
  function titleFor(preset) {
    if (!preset.fields.includes('duration') || !/\bsix months\b/.test(preset.q)) return preset.q;
    const words = { 3: 'three', 6: 'six', 12: 'twelve' };
    const n = Number(value('duration') || preset.defaults.duration || 6);
    return preset.q.replace('six months', `${words[n] || n} months`);
  }

  /** The answer needs a rate we don't have: say which, keep the figures, offer a retry. */
  function onHold(codes) {
    const list = codes.length > 1 ? `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)}` : codes[0];
    const r = window.BudgetRates ? window.BudgetRates() : {};
    if (r.loading) {
      return { hold: true, empty: { title: 'Loading exchange rates…', text: `Needed to convert ${list} to ${code()}.` }, noBudgetLink: true };
    }
    return {
      hold: true,
      retry: true,
      noBudgetLink: true,
      empty: {
        title: `Can’t convert ${list} to ${code()} yet`,
        text: 'Without an exchange rate this answer would be wrong, so it’s on hold. Your figures are kept, and it updates as soon as rates load.',
      },
    };
  }

  /** Full render (fields + answer), or just the answer while someone is typing. */
  function render(rebuildFields = true) {
    if (!current) return;
    const { id, presetKey } = current;
    const tool = TOOLS[id];
    const preset = presetOf(id, presetKey);

    if (rebuildFields) {
      $('toolKicker').textContent = tool.name;
      $('toolIcon').innerHTML = typeof icon === 'function' ? icon(tool.icon, { size: 18 }) : '';
      $('toolTitle').textContent = titleFor(preset);
      const fields = $('toolFields');
      fields.innerHTML = '';
      preset.fields.forEach((k) => fields.appendChild(buildField(k, preset)));
      $('toolSourceCode').textContent = code();
    }
    // Keep money symbols in step with the income currency.
    document.querySelectorAll('#toolFields .money-symbol').forEach((s) => {
      s.textContent = getCurrencyMeta(code()).symbol;
    });
    renderAnswer();
  }

  function show(id, presetKey) {
    if (!TOOLS[id]) return false;
    current = { id, presetKey: TOOLS[id].presets[presetKey] ? presetKey : 'default' };
    // Seed preset defaults the user hasn't set (e.g. six months off → 6).
    const preset = presetOf(id, current.presetKey);
    Object.entries(preset.defaults).forEach(([k, v]) => {
      if (savedValue(k) == null) setValue(k, v);
    });
    const back = $('toolBack');
    back.href = current.presetKey === 'default' && !fromJourney ? '#calculators' : '#journeys';
    back.textContent = back.href.endsWith('#calculators') ? '← Calculators' : '← Financial journeys';
    render(true);
    return true;
  }

  // Links from Home or Journeys send the back link to Journeys; from Calculators, back there.
  let fromJourney = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#tool/"]');
    if (a) fromJourney = Boolean(a.closest('#view-journeys, #view-home'));
  });

  // "Edit budget" remembers where to come back to.
  const editLink = $('toolEditBudget');
  if (editLink) {
    editLink.addEventListener('click', () => {
      try {
        sessionStorage.setItem('budgetBuddyReturn', JSON.stringify({ hash: location.hash, q: $('toolTitle').textContent }));
      } catch (e) {
        /* ignore */
      }
    });
  }
  const needsLink = $('toolEmptyLink');
  if (needsLink) {
    needsLink.addEventListener('click', () => {
      try {
        sessionStorage.setItem('budgetBuddyReturn', JSON.stringify({ hash: location.hash, q: $('toolTitle').textContent }));
      } catch (e) {
        /* ignore */
      }
    });
  }

  const staleRetry = $('toolStaleRetry');
  if (staleRetry) {
    staleRetry.addEventListener('click', () => {
      const r = window.BudgetRates && window.BudgetRates();
      if (r && r.retry) r.retry();
    });
  }

  const retry = $('toolEmptyRetry');
  if (retry) {
    retry.addEventListener('click', () => {
      const r = window.BudgetRates && window.BudgetRates();
      if (r && r.retry) r.retry();
      render(false);
    });
  }

  window.BudgetTools = { show, TOOLS, FIELDS, value };
  if (typeof recomputeAll === 'function') recomputeAll();
})();
