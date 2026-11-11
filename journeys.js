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
    goalMonthly: () => ({
      value: budget().savingsMonthly / ({ weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1 }[value('goalFrequency') || 'monthly'] || 1),
      label: 'your Long-term savings plan',
    }),
    emergencySaved: () => ({ value: budget().savings, label: 'your savings' }),
    savings: () => ({ value: budget().savings, label: 'your budget' }),
    leftOver: () => ({ value: leftOverNow() || 0, label: 'your money left over' }),
  };

  /** Money left over each month from the budget, or null if not known. */
  function leftOverNow() {
    const m = lastBudget && lastBudget.model;
    return m && m.ok && m.leftOver != null ? m.leftOver : null;
  }

  /** A field's budget source; a preset can point a field elsewhere (trip → money left over). */
  function sourceOf(key) {
    const f = FIELDS[key];
    const tool = current && TOOLS[current.id];
    const p = tool && (tool.presets[current.presetKey] || tool.presets.default);
    return (p && p.sources && p.sources[key]) || (f && f.source) || null;
  }

  const FIELDS = {
    savings: { label: 'Money you can access', type: 'money', source: 'savings', help: 'Saved with your budget and used by every calculator.' },
    confirmedMoney: { label: 'Money you’ve been promised', type: 'money', help: 'Only amounts you’ve been told you’ll get, like final pay or a leave payout.' },
    uncertainMoney: { label: 'Money you might get', type: 'money', help: 'Not counted unless you tick the box below.' },
    includeUncertain: { label: 'Count the money I might get', type: 'toggle' },
    essentialsList: { label: 'Costs you must pay', type: 'essentials' },
    income: { label: 'Money coming in each month', type: 'money', source: 'income' },
    expenses: { label: 'Money going out each month', type: 'money', source: 'expenses' },
    essentials: { label: 'Costs you must pay each month', type: 'money', source: 'essentials' },
    cover: { label: 'Months of cover', type: 'choice', options: [3, 6, 9, 12], unit: 'months' },
    emergencySaved: { label: 'Already set aside', type: 'money', source: 'emergencySaved' },
    emergencyMonthly: { label: 'You can save each month', type: 'money', source: 'emergencyMonthly' },
    emergencyDeadline: { label: 'By when (optional)', type: 'month' },
    incomeDuring: { label: 'Money still coming in each month', type: 'money', help: 'Only money you can count on, like part-time work.' },
    duration: { label: 'Time off', type: 'choice', options: [3, 6, 12], unit: 'months' },
    goalMode: {
      label: 'What would you like to know?',
      type: 'choice',
      options: [['time', 'How long it will take'], ['amount', 'How much to save'], ['projection', 'How much I’ll have']],
      rebuild: true,
    },
    goalName: { label: 'What you’re saving for', type: 'text', placeholder: 'e.g. A trip home' },
    goalTarget: { label: 'How much you need', type: 'money' },
    goalSaved: { label: 'Saved so far', type: 'money' },
    goalContribution: { label: 'You can save', type: 'money', source: 'goalMonthly' },
    goalFrequency: { label: 'How often', type: 'choice', options: [['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']], default: 'monthly' },
    goalDeadline: { label: 'By when', type: 'month' },
    goalRate: { label: 'Interest per year (optional)', type: 'percent', help: 'Only if your savings earn interest. Leave blank if not.' },
    newIncome: { label: 'New money coming in each month', type: 'money', chips: [-10, -20, -30, -50] },
    transitionMonths: { label: 'Months before the new job pays', type: 'count', placeholder: '0' },
    transitionIncome: { label: 'Money coming in during that time, each month', type: 'money' },
    oneOff: { label: 'One-off costs (course, equipment)', type: 'money' },
    changeStart: { label: 'When it starts (optional)', type: 'month', help: 'Until then, you keep saving on what you earn now.' },
    breakOneOff: { label: 'One-off costs (optional)', type: 'money', help: 'Flights, a course, equipment: paid once, on top of the monthly costs.' },

    // Investing
    investStart: { label: 'Amount to invest now', type: 'money' },
    investContribution: { label: 'Adding regularly (optional)', type: 'money', amountChips: [100, 250, 500], leftOverChip: true },
    investFrequency: { label: 'How often', type: 'choice', options: [['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']], default: 'monthly' },
    investYears: { label: 'For how long', type: 'choice', options: [5, 10, 20, 30], unit: 'years', default: 10 },
    investReturn: { label: 'Expected return per year', type: 'percent', percentChips: [4, 6, 8, 10], help: 'Not guaranteed. Returns rise and fall from year to year.' },
    investFee: { label: 'Fees per year (optional)', type: 'percent', help: 'Taken off the return.' },
    investInflation: { label: 'Inflation per year (optional)', type: 'percent', help: 'Shows what the total would buy in today’s money.' },

    // Debt
    debtBalance: { label: 'How much you owe', type: 'money' },
    debtRate: { label: 'Interest per year', type: 'percent', help: 'Check your statement. Credit cards are often around 20%.' },
    debtPayment: { label: 'You pay each month', type: 'money' },
    debtExtra: { label: 'Extra each month (optional)', type: 'money', amountChips: [50, 100, 250], leftOverChip: true },

    // Home loan
    loanBalance: { label: 'Loan still owed', type: 'money' },
    loanRate: { label: 'Interest rate per year', type: 'percent' },
    loanPayment: { label: 'Your monthly repayment', type: 'money', help: 'Don’t know it? Leave it blank and enter the years left.' },
    loanYears: { label: 'Years left on the loan', type: 'count', placeholder: 'e.g. 25' },
    loanExtra: { label: 'Extra each month', type: 'money', amountChips: [100, 250, 500, 1000], leftOverChip: true },
    loanLump: { label: 'One-off extra payment (optional)', type: 'money' },

    // Moving
    moveCurrency: { label: 'Currency there', type: 'currency' },
    moveIncome: { label: 'Money coming in each month there', type: 'money', currencyFrom: 'moveCurrency', help: 'Leave blank if it stays the same.' },
    moveCosts: { label: 'Costs each month there', type: 'money', currencyFrom: 'moveCurrency', help: 'Rent, food, transport and everything else.' },
    moveUpfront: { label: 'Moving costs up front', type: 'money', help: 'Flights, shipping, bond, visas, setting up.' },

    // Comparing scenarios
    compareA: { label: 'Compare', type: 'scenario', default: 'current' },
    compareB: { label: 'With', type: 'scenario' },
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
    const src = sourceOf(key);
    if (src) return SOURCES[src]().value;
    if (f && f.default != null) return f.default;
    return null;
  }

  /** The currency a money field is typed in: its own (e.g. the place you'd move to) or the income currency. */
  function moneyCode(key) {
    const f = FIELDS[key];
    return (f && f.currencyFrom && value(f.currencyFrom)) || code();
  }

  function setValue(key, v) {
    // Savings live in the budget (Income tab), so every page and scenario agrees.
    if (key === 'savings' && window.BudgetSavings) {
      window.BudgetSavings.set(v, code());
      return;
    }
    store.values = store.values || {};
    if (v == null || v === '') delete store.values[key];
    else store.values[key] = { v, c: FIELDS[key].type === 'money' ? moneyCode(key) : undefined };
    saveStore();
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  function money(n, cur = code()) {
    const meta = getCurrencyMeta(cur);
    // Past a trillion, show 6 significant figures: the rest is floating-point noise.
    if (Math.abs(n) >= 1e12) {
      const f = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 5);
      n = Math.round(n / f) * f;
    }
    const abs = Math.abs(n);
    const digits = abs >= 100 || abs === 0 ? 0 : meta.decimals;
    const gap = /[A-Za-z]$/.test(meta.symbol) ? ' ' : '';
    // Comma grouping to match what people type in the fields.
    return `${n < 0 ? '−' : ''}${meta.symbol}${gap}${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }
  const pct = (x) => `${Math.round(x * 100)}%`;
  /** "3 years 6 months", "8 months", "1 year". */
  const yearsMonths = (m) => {
    const y = Math.floor(m / 12);
    const r = m % 12;
    const ys = y ? `${y} year${y === 1 ? '' : 's'}` : '';
    const ms = r ? `${r} month${r === 1 ? '' : 's'}` : '';
    return [ys, ms].filter(Boolean).join(' ') || '0 months';
  };
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
  /** Headline wording: "About 5 months", "Almost 6 months" (exact figure shown in the working). */
  const aboutMonths = (m) => {
    const whole = Math.floor(m);
    const frac = m - whole;
    if (frac >= 0.75) return `Almost ${months(whole + 1)}`;
    if (frac >= 0.25) return `About ${whole}½ months`;
    return `About ${months(whole)}`;
  };
  const dayTime = (d) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  /** Words and figures for one scenario, straight from its result. */
  function describeScenario(r, which, funds) {
    const lead = which === 'current'
      ? 'If you keep spending as you do today,'
      : 'If you spend only on the costs you must pay,';
    const out = { status: r.status, big: '—', date: '—' };
    switch (r.status) {
      case 'depleting':
        out.big = aboutMonths(r.months);
        out.date = partOfMonth(r.endDate);
        out.sentence = `${lead} your savings could last ${aboutMonths(r.months).toLowerCase()}.`;
        break;
      case 'under-month':
        out.big = r.days === 1 ? 'About 1 day' : `About ${r.days} days`;
        out.date = dayMonth(r.endDate);
        out.sentence = `${lead} your savings could last less than a month: about ${r.days} days.`;
        break;
      case 'decades':
        out.big = '50+ years';
        out.sentence = `${lead} your savings could last more than 50 years.`;
        break;
      case 'flat':
        out.big = 'Not used up';
        out.sentence = 'The money still coming in covers this spending, so your savings wouldn’t be used up.';
        break;
      case 'surplus':
        out.big = 'Not used up';
        out.sentence = `The money still coming in is ${money(r.surplus)} a month more than this spending, so your savings wouldn’t be used up.`;
        break;
      case 'no-funds':
        out.big = 'No savings';
        out.sentence = `With no savings entered, this spending leaves a gap of ${money(r.burn)} a month from the start.`;
        break;
      default:
        out.sentence = which === 'current' ? 'Add what you spend each month to see this.' : 'Choose the costs you must pay, below, to see this.';
    }
    const known = r.status !== 'invalid';
    out.rows = [
      ['Money going out', known ? money(r.expenses) : '—'],
      ['Money still coming in', known ? money(r.income) : '—'],
      [known && r.burn < 0 ? 'Extra each month' : 'Gap each month', known ? money(Math.abs(r.burn)) : '—'],
      ['Money you can access', money(funds)],
      ['How long it lasts', r.status === 'depleting' ? approxMonths(r.months) : out.big],
      ['Runs out around', out.date],
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
    if (!(gap > 0.5)) return 'The costs you must pay are about the same as what you spend today, so the two are close.';
    const extras = ctx.ess.items.filter((i) => !i.on && Number.isFinite(i.amount)).sort((a, b) => b.amount - a.amount).slice(0, 2).map((i) => i.name);
    return `The difference is ${money(gap)} a month of spending you haven’t marked as a must-pay cost${extras.length ? `, mainly ${extras.join(' and ')}` : ''}.`;
  }

  /** Uncertain money: always show what it changes. `effect(funds)` describes the other case. */
  function uncertainNote(ctx, effect) {
    const { f } = ctx;
    if (!(f.uncertain > 0)) return null;
    const other = effect(f.uncertainIncluded ? f.total - f.uncertain : f.withUncertain);
    return f.uncertainIncluded
      ? `This counts ${money(f.uncertain)} you might get.${other ? ` Without it, ${other}.` : ''}`
      : `Not counted: ${money(f.uncertain)} you might get.${other ? ` If it does arrive, ${other}.` : ''}`;
  }

  function scenarioAssumptions(ctx, extra = []) {
    const { f, spend, ess, income, today } = ctx;
    const own = savedValue('expenses');
    const counted = [`${money(f.now)} you can access`];
    if (f.confirmed) counted.push(`${money(f.confirmed)} promised`);
    if (f.uncertainIncluded) counted.push(`${money(f.uncertain)} you might get`);
    const fundsText = `${money(f.total)}${counted.length > 1 ? ` (${counted.join(' + ')})` : ''}${f.uncertain && !f.uncertainIncluded ? `. ${money(f.uncertain)} you might get is not counted` : ''}`;
    const rates = window.BudgetRates ? window.BudgetRates() : null;
    return [
      ['Calculated', dayTime(today)],
      ...extra,
      ['Money counted', fundsText],
      ['Spending today', Number.isFinite(spend) ? `${money(spend)} a month, ${own != null && own !== '' ? 'your figure' : 'from your budget'}` : '—'],
      ['Costs you must pay', ess.total != null ? `${money(ess.total)} a month, ${ess.count} cost${ess.count === 1 ? '' : 's'}` : '—'],
      ['Money still coming in', income ? `${money(income)} a month` : 'None entered'],
      ['Currency', convertedSomething && rates ? `${code()}. ${rates.text}` : code()],
    ];
  }

  function scenarioNotes(ctx, A, B, effect) {
    const notes = [];
    if (A.status !== 'invalid' && B.status !== 'invalid') notes.push(differenceNote(ctx));
    const u = uncertainNote(ctx, effect);
    if (u) notes.push(u);
    if (ctx.ess.unconfirmed > 0) notes.push('We’ve suggested which costs you must pay. Check them below.');
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
        { title: 'Keep spending as I do today', ...describeScenario(A, 'current', f.total) },
        { title: 'Spend only on what I need', ...describeScenario(B, 'essentials', f.total) },
      ],
      notes: scenarioNotes(ctx, A, B, (funds) => {
        const o = J.runwayScenario({ funds, expenses: spend, income, today });
        return o.status === 'depleting' ? `current spending would last about ${approxMonths(o.months)}` : o.status === 'under-month' ? `current spending would last about ${o.days} days` : null;
      }),
      figures: scenarioAssumptions(ctx),
      behindTitle: 'How this is worked out',
      footnote: 'These are estimates from the figures you’ve entered. Dates assume your spending and money coming in stay the same.',
    };
  }

  // ---------------------------------------------------------------------------
  // A fixed break (time off, leaving a job): current spending vs essentials
  // ---------------------------------------------------------------------------

  function describeBreak(r, which, funds, p) {
    const how = which === 'current' ? 'spending as you do today' : 'spending only on what you must pay';
    const out = { status: r.status, big: '—' };
    const n = r.months;
    const gapTime = r.monthsToSave ? `about ${months(r.monthsToSave)} at your current saving rate` : null;
    switch (r.status) {
      case 'covered-by-income':
        out.big = 'Covered';
        out.sentence = `The money still coming in would cover ${n} months ${how}, so the break wouldn’t use your savings.`;
        break;
      case 'affordable':
        out.big = p === 'leave' ? money(r.cost) : 'Yes';
        out.sentence = p === 'leave'
          ? `${n} months ${how} needs about ${money(r.cost)}. You already have enough, with ${money(r.leftAfter)} to spare.`
          : `${n} months ${how} could cost about ${money(r.cost)}. You’d have about ${money(r.leftAfter)} left afterwards.`;
        break;
      case 'short':
        out.big = p === 'leave' ? money(r.cost) : `${money(r.shortfall)} short`;
        out.sentence = p === 'leave'
          ? `${n} months ${how} needs about ${money(r.cost)}: ${money(r.shortfall)} more than you have${gapTime ? `, ${gapTime}` : ''}.`
          : `${n} months ${how} could cost about ${money(r.cost)}, ${money(r.shortfall)} more than your savings${gapTime ? `. That’s ${gapTime}` : ''}.`;
        break;
      default:
        out.sentence = which === 'current' ? 'Add what you spend each month to see this.' : 'Choose the costs you must pay, below, to see this.';
    }
    const known = r.status !== 'invalid';
    out.rows = [
      ['Money going out', known ? money(r.expenses) : '—'],
      ['Money still coming in', known ? money(r.income) : '—'],
      [known && r.burn < 0 ? 'Extra each month' : 'Gap each month', known ? money(Math.abs(r.burn)) : '—'],
      [`Cost of ${n || '—'} months`, known ? money(r.monthsCost != null ? r.monthsCost : r.cost) : '—'],
      ...(known && r.oneOff ? [['One-off costs', money(r.oneOff)]] : []),
      ['Money you can access', money(funds)],
      [r.status === 'short' ? 'Still needed' : 'Left afterwards', known ? money(r.status === 'short' ? r.shortfall : r.leftAfter) : '—'],
    ];
    if (r.status === 'short') out.rows.push(['Time to save the rest', r.monthsToSave ? months(r.monthsToSave) : '—']);
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
    const oneOff = Number(value('breakOneOff')) || 0;
    const essTotal = ess.count ? (ess.total == null ? NaN : ess.total) : null;
    const A = J.breakScenario({ funds: f.total, expenses: spend, income, months: n, capacity, oneOff });
    const B = essTotal != null ? J.breakScenario({ funds: f.total, expenses: essTotal, income, months: n, capacity, oneOff }) : { status: 'invalid' };
    const notes = scenarioNotes(ctx, A, B, (funds) => {
      const o = J.breakScenario({ funds, expenses: spend, income, months: n, capacity, oneOff });
      return o.status === 'affordable' ? `you’d have about ${money(o.leftAfter)} left on current spending` : o.status === 'short' ? `you’d be ${money(o.shortfall)} short on current spending` : null;
    });
    if (!capacity && (A.status === 'short' || B.status === 'short')) notes.push('Add your income to the budget to see how long it would take to save the gap.');

    // What if it lasts longer: how long the money would really last.
    const longest = J.runwayScenario({ funds: Math.max(0, f.total - oneOff), expenses: Number.isFinite(essTotal) && essTotal > 0 ? essTotal : spend, income });
    if (longest.status === 'depleting' && longest.months > n) {
      notes.push(`If it lasted longer, your money would run out after about ${approxMonths(longest.months)}${Number.isFinite(essTotal) && essTotal > 0 ? ', spending only on what you need' : ''}.`);
    } else if (longest.status === 'surplus' || longest.status === 'flat') {
      notes.push('The money still coming in covers what you need, so a longer break wouldn’t use up your savings.');
    }

    // 3, 6 and 12 months side by side.
    const LENGTHS = [3, 6, 12];
    const cell = (exp, m) => {
      if (exp == null || !Number.isFinite(exp)) return ['—', '—'];
      const r = J.breakScenario({ funds: f.total, expenses: exp, income, months: m, oneOff });
      if (r.status === 'invalid') return ['—', '—'];
      return [money(r.cost), r.status === 'short' ? `${money(r.shortfall)} short` : money(r.leftAfter)];
    };
    const ca = LENGTHS.map((m) => cell(spend, m));
    const cb = LENGTHS.map((m) => cell(essTotal, m));
    const table = {
      head: ['', ...LENGTHS.map((m) => `${m} months`)],
      rows: [
        ['Keep spending as today', '', '', '', 'is-total'],
        ['Cost', ...ca.map((c) => c[0]), 'is-sub'],
        ['Left afterwards', ...ca.map((c) => c[1]), 'is-sub'],
        ['Spend only on what I need', '', '', '', 'is-total'],
        ['Cost', ...cb.map((c) => c[0]), 'is-sub'],
        ['Left afterwards', ...cb.map((c) => c[1]), 'is-sub'],
      ],
    };
    return {
      table,
      scenarios: [
        { title: 'Keep spending as I do today', ...describeBreak(A, 'current', f.total, p) },
        { title: 'Spend only on what I need', ...describeBreak(B, 'essentials', f.total, p) },
      ],
      notes,
      figures: scenarioAssumptions(ctx, [['Length', months(n)], ...(oneOff ? [['One-off costs', money(oneOff)]] : []), ['Money left over now', capacity ? `${money(capacity)} a month, from your budget` : 'Not known']]),
      behindTitle: 'How this is worked out',
      footnote: 'These are estimates from the figures you’ve entered. They assume your spending and money coming in stay the same.',
    };
  }

  // ---------------------------------------------------------------------------
  // Tools: fields shown, and the answer they produce
  // ---------------------------------------------------------------------------

  const TOOLS = {
    understand: {
      name: 'Understand my money',
      icon: 'chart-pie',
      presets: {
        default: { q: 'Where does my money go each month?' },
        living: { q: 'How much does it really cost to live each month?' },
        year: { q: 'How much can I save over the next year?' },
        needed: { q: 'How much income do I need to cover my expenses?' },
        snapshot: { q: 'What does my financial situation look like?' },
      },
      fields: [],
      answer(p) {
        const m = lastBudget && lastBudget.model;
        if (m && !m.ok) {
          m.missingRates.forEach((c) => missingRates.add(c));
          return {};
        }
        if (m && m.converted) convertedSomething = true;
        const costsOnly = p === 'living' || p === 'needed';
        if (!m || (!m.complete.income && !costsOnly) || (costsOnly && !m.complete.costs)) {
          return {
            empty: { title: 'Your budget is empty', text: costsOnly ? 'Add what you spend each month to see this.' : 'Add the money you have coming in and going out to see where it goes.' },
            hideFields: true,
          };
        }
        const inn = m.moneyIn;
        const out = m.moneyOut;
        const left = m.leftOver;
        const yr = (x) => (x == null ? '—' : money(x * 12));
        const row = (label, x, cls = '') => [label, money(x), yr(x), cls];
        const rows = [];
        if (m.complete.income) {
          rows.push(row('Money coming in', inn.total, 'is-total'));
          if (inn.other.length) {
            rows.push(row('Take-home pay', inn.salary, 'is-sub'));
            if (inn.regular - inn.salary > 0.005) rows.push(row('Other money (reliable)', inn.regular - inn.salary, 'is-sub'));
            if (inn.notRegular > 0) rows.push(row('Other money (not regular)', inn.notRegular, 'is-sub'));
          }
        }
        rows.push(row('Money going out', out.total, 'is-total'));
        rows.push(row('Costs you must pay', out.essential, 'is-sub'));
        rows.push(row('Other spending', out.other, 'is-sub'));
        if (left != null) rows.push(row(left < 0 ? 'Short by' : 'Money left over', Math.abs(left), 'is-result'));

        let main;
        if (p === 'living') main = `Living costs you about ${money(out.total)} a month.`;
        else if (p === 'needed') main = `You need about ${money(out.total)} a month to cover your costs.`;
        else if (left < 0) main = `Your costs are ${money(-left)} a month more than your money coming in.`;
        else if (p === 'year') main = `You could have about ${money(left * 12)} left over this year.`;
        else main = `You have about ${money(left)} left over each month.`;

        const meaning = [];
        if (inn.total > 0) meaning.push(`${pct(out.essential / inn.total)} of your money coming in goes on costs you must pay.`);
        if (out.spread > 0) meaning.push(`This includes ${money(out.spread)} a month for bills you pay less often, spread across the year.`);
        if (inn.notRegular > 0) meaning.push(`${money(inn.notRegular)} a month of your money coming in isn’t regular, so this is an estimate.`);
        if (p === 'needed' && m.planned.total > 0) meaning.push(`Add ${money(m.planned.total)} if you also want to fund your savings & goals plan.`);
        else if (left > 0 && m.planned.total > 0) {
          meaning.push(m.planned.total <= left + 0.5
            ? `Your savings & goals plan of ${money(m.planned.total)} a month fits within what’s left over.`
            : `Your savings & goals plan is ${money(m.planned.total)} a month, more than what’s left over.`);
        }
        if (m.savings.accessible > 0 && out.total > 0) meaning.push(`The money you can access would cover about ${months(Math.floor(m.savings.accessible / out.total))} of costs.`);

        return {
          main,
          state: left == null ? '' : left < 0 ? 'bad' : 'good',
          table: { head: ['', 'Monthly', 'Yearly'], rows },
          behindTitle: 'How we worked it out',
          meaning: meaning.slice(0, 3),
          list: out.items
            .filter((i) => Number.isFinite(i.monthly))
            .sort((a, b) => b.monthly - a.monthly)
            .map((i) => ({ label: i.name, value: money(i.monthly), share: out.total ? i.monthly / out.total : 0, kind: i.essential ? 'fixed' : 'variable', tag: i.essential ? 'Must pay' : '' })),
          listTitle: 'Your costs, biggest first',
          next: left != null && left > 0
            ? { label: 'How much should I keep for emergencies?', href: '#tool/emergency' }
            : { label: 'Edit your budget', href: '#go/income' },
        };
      },
    },

    emergency: {
      name: 'Emergency fund',
      icon: 'life-buoy',
      presets: { default: { q: 'How much money should I keep for emergencies?' } },
      // Months of cover is chosen on the targets in the answer itself.
      fields: ['emergencySaved', 'emergencyMonthly', 'emergencyDeadline', 'essentialsList'],
      answer() {
        const ess = essentialsTotal();
        if (!ess) return { empty: { title: 'No costs you must pay yet', text: 'Add them below, or fill in your budget.' } };
        const per = value('emergencyMonthly');
        const r = J.emergencyFund({ essentials: ess, months: value('cover'), saved: value('emergencySaved'), monthly: per, deadline: value('emergencyDeadline') });
        const targets = r.targets.map((t) => ({ label: `${t.months} months`, value: money(t.target), key: t.months }));
        const coverNow = r.monthsCoveredNow ? (r.monthsCoveredNow >= 1 ? `about ${months(Math.floor(r.monthsCoveredNow))}` : 'less than a month') : null;
        const meaning = ['There’s no single right amount. It depends on things like how secure your income is and who relies on you.'];
        const next = { label: 'What would happen if I lost my job?', href: '#tool/runway/jobloss' };
        if (!r.chosen) {
          return {
            main: 'How many months of costs would you like to cover?',
            sub: `Your must-pay costs are ${money(ess)} a month.${coverNow ? ` What you’ve set aside covers ${coverNow}.` : ''}`,
            targets,
            meaning,
            next,
          };
        }
        const fig = [[`${money(ess)} × ${r.chosen} months`, money(r.target)], ['Already set aside', money(r.saved)]];
        if (coverNow) fig.push(['Covers today', coverNow]);
        if (r.covered) {
          return { main: `You have enough for ${r.chosen} months of costs.`, sub: `What you’ve set aside covers ${coverNow}.`, state: 'good', targets, figures: fig, meaning, next };
        }
        fig.push(['Still needed', money(r.gap)]);
        let sub;
        if (r.deadlineMonths) {
          const by = monthYear(J.addMonths(r.deadlineMonths));
          fig.push([`${money(r.gap)} ÷ ${months(r.deadlineMonths)}`, `${money(r.requiredMonthly)} a month`]);
          sub = r.onTrack
            ? `Saving ${money(per)} a month gets you there by ${by}.`
            : `To get there by ${by}, save about ${money(r.requiredMonthly)} a month.`;
        } else if (r.monthsToBuild != null) {
          fig.push([`${money(r.gap)} ÷ ${money(per)} a month`, months(r.monthsToBuild)]);
          sub = `At ${money(per)} a month, that’s about ${months(r.monthsToBuild)} (${fromToday(r.monthsToBuild)}).`;
        } else {
          sub = 'Add how much you can save each month, or a date, to see when.';
        }
        return { main: `Aim for ${money(r.target)}. You need ${money(r.gap)} more.`, sub, state: 'warn', targets, figures: fig, meaning, next };
      },
    },

    runway: {
      name: 'How long your savings will last',
      icon: 'hourglass',
      presets: {
        default: { q: 'How long could I manage without an income?', fields: ['savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], twoScenarios: true },
        timeoff: { q: 'Could I afford to take six months off?', fields: ['duration', 'breakOneOff', 'savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], defaults: { duration: 6 }, twoScenarios: 'break' },
        leave: { q: 'How much should I save before leaving my job?', fields: ['duration', 'breakOneOff', 'savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], defaults: { duration: 6 }, twoScenarios: 'break' },
        jobloss: { q: 'What would happen if I lost my job?', fields: ['savings', 'confirmedMoney', 'uncertainMoney', 'includeUncertain', 'incomeDuring', 'expenses', 'essentialsList'], twoScenarios: true },
      },
      answer(p, preset) {
        const a = preset.twoScenarios === 'break' ? twoScenarioBreak(p, preset) : twoScenarioRunway();
        if (!a.empty) {
          a.next = p === 'timeoff' || p === 'leave'
            ? { label: 'How long will it take me to save for something?', href: '#tool/goal' }
            : { label: 'How much should I keep for emergencies?', href: '#tool/emergency' };
        }
        return a;
      },
    },

    goal: {
      name: 'Savings goal',
      icon: 'target',
      presets: {
        default: { q: 'How long will it take me to save for something?' },
        // On your current budget: what you save defaults to your money left over.
        trip: { q: 'How long will it take to save for a trip?', fields: ['goalTarget', 'goalSaved', 'goalContribution', 'goalFrequency'], sources: { goalContribution: 'leftOver' }, mode: 'time', placeholder: 'A trip' },
        deposit: { q: 'How much should I save each month for a home deposit?', fields: ['goalTarget', 'goalSaved', 'goalDeadline', 'goalFrequency', 'goalRate'], mode: 'amount', placeholder: 'your deposit' },
      },
      fields: ['goalMode'],
      fieldsFor() {
        const mode = value('goalMode') || 'time';
        if (mode === 'amount') return ['goalMode', 'goalName', 'goalTarget', 'goalSaved', 'goalDeadline', 'goalFrequency', 'goalRate'];
        if (mode === 'projection') return ['goalMode', 'goalSaved', 'goalContribution', 'goalFrequency', 'goalDeadline', 'goalRate'];
        return ['goalMode', 'goalName', 'goalTarget', 'goalSaved', 'goalContribution', 'goalFrequency', 'goalRate'];
      },
      answer(p, preset) {
        const fixed = this.presets[p] || {};
        const mode = fixed.mode || value('goalMode') || 'time';
        const freq = value('goalFrequency') || 'monthly';
        const each = { weekly: 'a week', fortnightly: 'a fortnight', monthly: 'a month' }[freq];
        const rate = preset.fields.includes('goalRate') ? Number(value('goalRate')) || 0 : 0;
        const name = fixed.placeholder ? '' : String(value('goalName') || '').trim();
        const target = value('goalTarget');
        const what = name || (fixed.placeholder && target ? `${money(target)} for ${fixed.placeholder.replace(/^A /, 'a ')}` : target ? money(target) : 'your goal');
        const meaning = rate > 0 ? ['Interest is an estimate at the rate you entered. Rates can change.'] : [];
        const next = { label: 'How much should I keep for emergencies?', href: '#tool/emergency' };
        const m = lastBudget && lastBudget.model;
        const leftOver = m && m.ok && m.leftOver != null ? m.leftOver : null;

        if (mode === 'projection') {
          const g = J.goalProjection({ saved: value('goalSaved'), contribution: value('goalContribution'), frequency: freq, deadline: value('goalDeadline'), annualRate: rate });
          if (g.status !== 'ok') return { empty: { title: 'Pick a date', text: 'Choose when you’d like to know your total, below.' }, noBudgetLink: true };
          const fig = [['Saved now', money(g.saved)], [`Saving for ${months(g.months)}`, money(g.contributed)]];
          if (g.interest > 0.5) fig.push(['Interest', money(g.interest)]);
          fig.push(['Total', money(g.balance)]);
          return { main: `By ${monthYear(J.addMonths(g.months))} you could have about ${money(g.balance)}.`, state: 'good', figures: fig, behindTitle: 'How we worked it out', meaning, next };
        }

        if (!target) return { empty: { title: 'How much do you need?', text: 'Enter your target below.' }, noBudgetLink: true };

        if (mode === 'amount') {
          const g = J.goalContribution({ target, saved: value('goalSaved'), deadline: value('goalDeadline'), frequency: freq, annualRate: rate });
          if (g.status === 'no-date') return { empty: { title: 'Pick a date', text: 'Choose when you’d like to reach it, below.' }, noBudgetLink: true };
          if (g.status === 'reached') return { main: `You already have enough to reach ${what} by then.`, state: 'good', meaning, next };
          const fig = [['Still needed', money(g.gap)], ['Time', months(g.months)], [`${money(g.gap)} ÷ ${months(g.months)}`, `${money(g.monthly)} a month`]];
          const tooMuch = leftOver != null && g.monthly > leftOver + 0.5;
          return {
            main: `Save about ${money(g.perPeriod)} ${each} to reach ${what} by ${monthYear(J.addMonths(g.months))}.`,
            sub: tooMuch ? `That’s more than your money left over (${money(Math.max(0, leftOver))} a month). You could choose a later date or a smaller target.` : '',
            state: tooMuch ? 'warn' : 'good',
            figures: fig,
            behindTitle: 'How we worked it out',
            meaning,
            next,
          };
        }

        const g = J.goalTime({ target, saved: value('goalSaved'), contribution: value('goalContribution'), frequency: freq, annualRate: rate });
        if (g.status === 'reached') return { main: `You’ve already reached ${what}.`, state: 'good', meaning, next };
        if (g.status === 'no-saving') return { empty: { title: 'How much can you save?', text: 'Add an amount below to see when you’ll get there.' }, noBudgetLink: true };
        if (g.status === 'too-long') return { main: 'At this saving amount, it would take more than 100 years.', sub: 'You could save more each time, or set a smaller target.', state: 'warn', meaning, next };
        const fig = [['Still needed', money(g.gap)], ['Saving each month', money(g.monthly)], ['Time', months(g.months)]];
        if (g.interest > 0.5) fig.push(['Interest along the way', money(g.interest)]);
        // On your current budget: how much of what's left over this uses, and the fastest you could get there.
        if (leftOver > 0) {
          const share = g.monthly / leftOver;
          meaning.push(share > 1.005
            ? `That’s more than your money left over (${money(leftOver)} a month).`
            : `That uses ${pct(share)} of your money left over (${money(leftOver)} a month).`);
          if (share < 0.995) {
            const all = J.goalTime({ target, saved: value('goalSaved'), contribution: leftOver, annualRate: rate });
            if (all.status === 'ok' && all.months < g.months) meaning.push(`Saving all of it, you could get there by ${monthYear(all.reachDate)}.`);
          }
        }
        return {
          main: `You could reach ${what} by ${monthYear(g.reachDate)}.`,
          sub: `That’s about ${months(g.months)}, saving ${money(value('goalContribution'))} ${each}.`,
          state: 'good',
          figures: fig,
          behindTitle: 'How we worked it out',
          meaning,
          next,
        };
      },
    },

    income: {
      name: 'Change in income',
      icon: 'trending-down',
      presets: {
        default: { q: 'What happens if I earn less?', fields: ['newIncome', 'changeStart', 'income', 'expenses', 'savings'] },
        less: { q: 'Could I afford to work less?', fields: ['newIncome', 'changeStart', 'income', 'expenses', 'savings'], chips: [-20, -40, -50] },
        career: { q: 'Could I afford to change careers?', fields: ['newIncome', 'changeStart', 'transitionMonths', 'transitionIncome', 'oneOff', 'income', 'expenses', 'savings'], chips: [] },
      },
      answer(p) {
        const inc = value('income');
        const exp = value('expenses');
        const next = value('newIncome');
        if (!inc || !exp) return { empty: { title: 'No income or costs yet', text: 'Type them below, or fill in your budget.' } };
        if (next == null || next === '') return { empty: { title: p === 'career' ? 'What would the new role pay?' : 'What would you earn instead?', text: p === 'career' ? 'Enter the new monthly salary below.' : 'Enter it below, or tap a percentage.' }, noBudgetLink: true };
        const career = p === 'career';
        const startMonths = value('changeStart') ? J.monthsUntil(value('changeStart')) : 0;
        const c = J.incomeChange({
          income: inc, newIncome: next, expenses: exp, savings: value('savings'), startMonths,
          transition: career ? { months: value('transitionMonths'), income: value('transitionIncome'), oneOff: value('oneOff') } : null,
        });
        const fig = [
          [`Now: ${money(inc)} − ${money(exp)} costs`, money(c.leftNow)],
          [`New: ${money(next)} − ${money(exp)} costs`, money(c.leftNew)],
        ];
        // From a later date, savings keep building on today's income first.
        const from = startMonths ? monthYear(J.addMonths(startMonths)) : null;
        if (from) fig.push([`Savings by ${from}`, money(c.savingsAtChange)]);
        const meaning = [];
        if (from) meaning.push(`Until ${from} you keep saving on what you earn now, so you’d start with about ${money(c.savingsAtChange)}.`);
        const planned = lastBudget && lastBudget.model && lastBudget.model.ok ? lastBudget.model.planned.total : 0;
        if (planned > 0) {
          meaning.push(c.leftNew >= planned - 0.5
            ? `Your savings & goals plan of ${money(planned)} a month would still fit.`
            : `Your savings & goals plan of ${money(planned)} a month wouldn’t fit. You’d have ${money(Math.max(0, c.leftNew))} a month for it.`);
        }
        const nextStep = c.short ? { label: 'How long would my savings last?', href: '#tool/runway' } : { label: 'How long will it take me to save for something?', href: '#tool/goal' };
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
            behindTitle: 'How we worked it out',
            meaning,
            next: nextStep,
          };
        }
        if (c.short) {
          return {
            main: `You’d be ${money(-c.leftNew)} short each month.`,
            sub: c.savingsCoverMonths ? `Your savings would cover that for ${months(c.savingsCoverMonths)}${from ? ` from ${from}` : ''}.` : 'Add your savings below to see how long they’d last.',
            state: 'bad',
            figures: fig,
            behindTitle: 'How we worked it out',
            meaning,
            next: nextStep,
          };
        }
        return {
          main: `You’d have ${money(c.leftNew)} left a month, ${c.leftNew < c.leftNow ? 'down' : 'up'} from ${money(c.leftNow)}.`,
          sub: (c.diffYearly < 0 ? `${money(-c.diffYearly)} less a year` : `${money(c.diffYearly)} more a year`) + (from ? `, from ${from}.` : '.'),
          state: c.leftNew > 0 ? 'good' : 'warn',
          figures: fig,
          behindTitle: 'How we worked it out',
          meaning,
          next: nextStep,
        };
      },
    },

    invest: {
      name: 'Investment growth',
      icon: 'trending-up',
      presets: { default: { q: 'How much could my investment grow?' } },
      fields: ['investStart', 'investContribution', 'investFrequency', 'investYears', 'investReturn', 'investFee', 'investInflation'],
      answer() {
        const ret = value('investReturn');
        const freq = value('investFrequency') || 'monthly';
        const each = { weekly: 'a week', fortnightly: 'a fortnight', monthly: 'a month' }[freq];
        if (!(value('investStart') > 0) && !(value('investContribution') > 0)) {
          return { empty: { title: 'How much would you invest?', text: 'Enter an amount to invest now, or how much you’d add regularly.' }, noBudgetLink: true };
        }
        if (ret == null || ret === '') return { empty: { title: 'What return do you expect?', text: 'Enter a yearly return below, or tap one of the suggestions.' }, noBudgetLink: true };
        const g = J.investProjection({ start: value('investStart'), contribution: value('investContribution'), frequency: freq, years: value('investYears') || 10, annualReturn: ret, annualFee: value('investFee'), inflation: value('investInflation') });
        if (g.status !== 'ok') return { empty: { title: 'How much would you invest?', text: 'Enter an amount below.' }, noBudgetLink: true };
        const yrs = `${g.years} years`;
        const fee = Number(value('investFee')) || 0;
        const infl = Number(value('investInflation')) || 0;
        const fig = [];
        if (g.start) fig.push(['Invested now', money(g.start)]);
        if (g.monthly) fig.push([`Added over ${yrs}`, money(g.contributed - g.start)]);
        if (g.start && g.monthly) fig.push(['Total you put in', money(g.contributed)]);
        fig.push([`Growth at ${ret}%${fee ? ` less ${fee}% fees` : ''} a year`, money(g.growth)]);
        fig.push(['Total after ' + yrs, money(g.balance)]);
        if (infl) fig.push([`In today’s money (${infl}% inflation)`, money(g.real)]);
        const meaning = [
          `If returns averaged ${Math.max(0, ret - 2)}% instead, you’d have about ${money(g.lower)}. At ${ret + 2}%, about ${money(g.higher)}.`,
          'Returns aren’t guaranteed. Some years can lose money, especially over short periods.',
        ];
        if (infl) meaning.splice(1, 0, `In today’s money, ${money(g.balance)} would buy about what ${money(g.real)} buys now.`);
        const left = leftOverNow();
        const tooMuch = left != null && g.monthly > left + 0.5;
        return {
          main: `In ${yrs} you could have about ${money(g.balance)}.`,
          sub: tooMuch
            ? `Adding ${money(value('investContribution'))} ${each} is more than your money left over (${money(Math.max(0, left))} a month).`
            : g.growth >= 0.5
              ? `You’d put in ${money(g.contributed)}. Growth could add about ${money(g.growth)}.`
              : `That’s what you’d put in, with no growth at ${ret}%${fee ? ` after fees` : ''}.`,
          state: tooMuch ? 'warn' : 'good',
          figures: fig,
          behindTitle: 'How we worked it out',
          meaning,
          chart: {
            kind: 'stack',
            title: 'Your investment, year by year',
            labels: g.yearly.map((p) => `Yr ${p.year}`),
            tipLabel: (i) => `After ${g.yearly[i].year} year${g.yearly[i].year === 1 ? '' : 's'}`,
            series: [
              { name: 'Money you put in', values: g.yearly.map((p) => p.contributed) },
              { name: 'Growth', values: g.yearly.map((p) => Math.max(0, p.balance - p.contributed)) },
            ],
          },
          footnote: 'An estimate, not financial advice. It assumes the same return every year, worked out monthly, with money added at the end of each period. Taxes aren’t included.',
          next: { label: 'Do I have enough for emergencies first?', href: '#tool/emergency' },
        };
      },
    },

    debt: {
      name: 'Pay off debt',
      icon: 'credit-card',
      presets: { default: { q: 'How long will it take to pay off my debt?' } },
      fields: ['debtBalance', 'debtRate', 'debtPayment', 'debtExtra'],
      answer() {
        const balance = value('debtBalance');
        const pay = value('debtPayment');
        const extra = Number(value('debtExtra')) || 0;
        const rate = Number(value('debtRate')) || 0;
        if (!(balance > 0)) return { empty: { title: 'How much do you owe?', text: 'Enter the balance below. For several debts, add them together or check each one.' }, noBudgetLink: true };
        if (!(pay > 0)) return { empty: { title: 'How much do you pay each month?', text: 'Enter your monthly repayment below.' }, noBudgetLink: true };
        const now = J.payoff({ balance, annualRate: rate, payment: pay });
        const next = { label: 'How much should I keep for emergencies?', href: '#tool/emergency' };
        const meaning = [];
        if (rate >= 10) meaning.push('With several debts, paying extra on the one with the highest interest first usually saves the most.');
        meaning.push('Your repayments already count in your money going out, if they’re in your budget.');
        if (now.status === 'never' && !extra) {
          return {
            main: `At ${money(pay)} a month, this debt would never be paid off.`,
            sub: `Interest is about ${money(now.interestOnly)} a month, so you’d need to pay more than that to bring it down.`,
            state: 'bad',
            meaning,
            next,
          };
        }
        const card = (r, amount) => {
          const ok = r.status === 'ok';
          return {
            status: r.status,
            big: ok ? monthYear(r.endDate) : r.status === 'never' ? 'Never' : r.status === 'too-long' ? '100+ years' : '—',
            sentence: ok
              ? `Paying ${money(amount)} a month clears it in about ${yearsMonths(r.months)}.`
              : r.status === 'never' ? `${money(amount)} a month doesn’t cover the interest of ${money(r.interestOnly)}.` : 'This would take more than 100 years.',
            rows: [
              ['Each month', money(amount)],
              ['Time to pay off', ok ? yearsMonths(r.months) : '—'],
              ['Interest you’d pay', ok ? money(r.totalInterest) : '—'],
              ['Total you’d pay', ok ? money(r.totalPaid) : '—'],
            ],
          };
        };
        const balanceChart = (series) => {
          const len = Math.max(...series.map((s) => s.r.yearly.length));
          return {
            kind: 'lines',
            title: 'What you still owe',
            labels: Array.from({ length: len + 1 }, (_, i) => `Yr ${i}`),
            tipLabel: (i) => (i ? `After ${i} year${i === 1 ? '' : 's'}` : 'Today'),
            series: series.map((s) => ({ name: s.name, values: [s.r.balance, ...Array.from({ length: len }, (_, i) => (s.r.yearly[i] ? s.r.yearly[i].balance : null))] })),
          };
        };
        if (!extra) {
          return {
            main: `You could be debt-free by ${monthYear(now.endDate)}.`,
            sub: `That’s about ${yearsMonths(now.months)}, paying ${money(now.totalInterest)} in interest. Add an extra amount below to see how much sooner.`,
            state: 'good',
            figures: [['Owed now', money(balance)], ['Interest per year', `${rate}%`], ['Each month', money(pay)], ['Time to pay off', yearsMonths(now.months)], ['Interest you’d pay', money(now.totalInterest)]],
            behindTitle: 'How we worked it out',
            chart: balanceChart([{ name: `Paying ${money(pay)}`, r: now }]),
            meaning,
            footnote: 'Interest is worked out monthly at the rate you entered, with the same repayment each month. Fees and rate changes aren’t included.',
            next,
          };
        }
        const more = J.payoff({ balance, annualRate: rate, payment: pay, extra });
        const both = now.status === 'ok' && more.status === 'ok';
        return {
          main: both
            ? `Adding ${money(extra)} a month gets you debt-free ${yearsMonths(now.months - more.months)} sooner and saves ${money(now.totalInterest - more.totalInterest)} in interest.`
            : more.status === 'ok' ? `With ${money(extra)} extra a month, you could be debt-free by ${monthYear(more.endDate)}.` : `Even with ${money(extra)} extra, this debt wouldn’t be paid off.`,
          state: more.status === 'ok' ? 'good' : 'bad',
          scenarios: [
            { title: `Paying ${money(pay)} a month`, ...card(now, pay) },
            { title: `Paying ${money(pay + extra)} a month`, ...card(more, pay + extra) },
          ],
          chart: both ? balanceChart([{ name: `Paying ${money(pay)}`, r: now }, { name: `Paying ${money(pay + extra)}`, r: more }]) : null,
          meaning,
          footnote: 'Interest is worked out monthly at the rate you entered, with the same repayment each month. Fees and rate changes aren’t included.',
          next,
        };
      },
    },

    loan: {
      name: 'Home loan extra repayments',
      icon: 'home',
      presets: { default: { q: 'How much could I save by paying extra on my home loan?' } },
      fields: ['loanBalance', 'loanRate', 'loanPayment', 'loanYears', 'loanExtra', 'loanLump'],
      answer() {
        const balance = value('loanBalance');
        const rate = Number(value('loanRate')) || 0;
        const extra = Number(value('loanExtra')) || 0;
        const lump = Number(value('loanLump')) || 0;
        if (!(balance > 0)) return { empty: { title: 'How much is left on your loan?', text: 'Enter the amount still owed below.' }, noBudgetLink: true };
        const typedRate = value('loanRate');
        if (typedRate == null || typedRate === '') return { empty: { title: 'What’s your interest rate?', text: 'Enter it below. It’s on your loan statement or app.' }, noBudgetLink: true };
        const x = J.extraRepayment({ balance, annualRate: rate, payment: value('loanPayment'), years: value('loanYears'), extra, lumpSum: lump });
        if (x.paymentFrom === 'none') return { empty: { title: 'What do you repay each month?', text: 'Enter your monthly repayment, or the years left on the loan.' }, noBudgetLink: true };
        const pay = x.payment;
        if (x.base.status === 'never') {
          return { main: `At ${money(pay)} a month, the repayment doesn’t cover the interest (${money(x.base.interestOnly)} a month).`, sub: 'Check the repayment and rate, or enter the years left instead.', state: 'bad' };
        }
        const foot = 'Assumes the rate stays the same, with interest worked out monthly and monthly repayments. Your lender may work out interest daily or charge fees, so its figures can differ a little.';
        const meaning = ['Some loans, especially fixed-rate ones, limit extra repayments or charge for them. Check with your lender first.'];
        if (x.paymentFrom === 'years') meaning.push(`Your repayment is worked out as ${money(pay)} a month, from ${value('loanYears')} years left.`);
        const card = (r, monthly) => ({
          status: r.status,
          big: r.status === 'ok' ? monthYear(r.endDate) : r.status === 'paid' ? 'Paid off' : '—',
          sentence: r.status === 'ok' ? `Paid off in about ${yearsMonths(r.months)}.` : r.status === 'paid' ? 'The one-off payment clears the loan.' : '',
          rows: [
            ['Each month', money(monthly)],
            ...(r.lumpSum ? [['One-off payment', money(r.lumpSum)]] : []),
            ['Time left', r.status === 'ok' ? yearsMonths(r.months) : '—'],
            ['Interest you’d pay', r.status === 'ok' || r.status === 'paid' ? money(r.totalInterest) : '—'],
          ],
        });
        const chart = (series) => {
          const len = Math.max(...series.map((s) => (s.r.yearly || []).length));
          return {
            kind: 'lines',
            title: 'What you still owe',
            labels: Array.from({ length: len + 1 }, (_, i) => `Yr ${i}`),
            tipLabel: (i) => (i ? `After ${i} year${i === 1 ? '' : 's'}` : 'Today'),
            series: series.map((s) => ({ name: s.name, values: [s.start, ...Array.from({ length: len }, (_, i) => ((s.r.yearly || [])[i] ? s.r.yearly[i].balance : null))] })),
          };
        };
        if (!extra && !lump) {
          return {
            main: `You’re on track to pay off your loan by ${monthYear(x.base.endDate)}.`,
            sub: `That’s about ${yearsMonths(x.base.months)} and ${money(x.base.totalInterest)} in interest. Add an extra amount below to see what you’d save.`,
            state: 'good',
            figures: [['Owed now', money(balance)], ['Rate', `${rate}% a year`], ['Each month', money(pay)], ['Time left', yearsMonths(x.base.months)], ['Interest still to pay', money(x.base.totalInterest)]],
            behindTitle: 'How we worked it out',
            chart: chart([{ name: 'As you pay now', r: x.base, start: balance }]),
            meaning,
            footnote: foot,
          };
        }
        const how = [extra ? `${money(extra)} a month` : '', lump ? `a one-off ${money(lump)}` : ''].filter(Boolean).join(' and ');
        const ok = x.monthsSaved != null;
        const left = leftOverNow();
        if (extra && left != null && extra > left + 0.5) meaning.unshift(`${money(extra)} a month is more than your money left over (${money(Math.max(0, left))} a month).`);
        return {
          main: ok ? `Paying ${how} extra could save about ${yearsMonths(x.monthsSaved)}${x.interestSaved >= 0.5 ? ` and ${money(x.interestSaved)} in interest` : ''}.` : `Paying ${how} extra.`,
          state: ok ? 'good' : '',
          scenarios: [
            { title: 'As you pay now', ...card(x.base, pay) },
            { title: `With ${how} extra`, ...card(x.withExtra, pay + extra) },
          ],
          chart: ok && x.withExtra.status === 'ok' ? chart([{ name: 'As you pay now', r: x.base, start: balance }, { name: 'With the extra', r: x.withExtra, start: balance - lump }]) : null,
          meaning,
          footnote: foot,
        };
      },
    },

    move: {
      name: 'Moving somewhere new',
      icon: 'plane',
      presets: { default: { q: 'Could I afford to move somewhere new?' } },
      fields: ['moveCurrency', 'moveCosts', 'moveIncome', 'moveUpfront', 'savings', 'income', 'expenses'],
      answer() {
        const inc = value('income');
        const exp = value('expenses');
        const there = value('moveCosts');
        if (!there) return { empty: { title: 'What would it cost to live there?', text: 'Enter your monthly costs in the new place below.' }, noBudgetLink: true };
        if (!exp) return { empty: { title: 'What do you spend now?', text: 'Type your monthly costs below, or fill in your budget.' } };
        const newInc = value('moveIncome') || inc;
        const m = J.moveCompare({ incomeNow: inc, costsNow: exp, incomeNew: newInc, costsNew: there, upfront: value('moveUpfront'), savings: value('savings') });
        const cur = value('moveCurrency') || code();
        const left = (x) => (x < 0 ? `${money(-x)} short` : money(x));
        const rows = (now) => [
          ['Money coming in', money(now ? inc : newInc)],
          ['Money going out', money(now ? exp : there)],
          ['Left over each month', left(now ? m.leftNow : m.leftNew)],
          ...(now ? [] : [['Moving costs', money(m.upfront)]]),
          ['Savings in 6 months', money(now ? m.after[0].stay : m.after[0].move)],
          ['Savings in 12 months', money(now ? m.after[1].stay : m.after[1].move)],
        ];
        const meaning = [];
        if (m.short > 0) meaning.push(`You’d need ${money(m.short)} more for the move${m.monthsToSaveUpfront ? `, about ${months(m.monthsToSaveUpfront)} of saving` : ''}.`);
        if (m.paybackMonths) meaning.push(`The lower costs would make up for the move after about ${yearsMonths(m.paybackMonths)}.`);
        const d12 = m.after[1].move - m.after[1].stay;
        meaning.push(d12 >= 0 ? `After a year you’d have about ${money(d12)} more than if you stayed.` : `After a year you’d have about ${money(-d12)} less than if you stayed.`);
        if (m.lastsMonths) meaning.push(`Spending more than comes in, your savings would last about ${approxMonths(m.lastsMonths)} there.`);
        if (cur !== code()) meaning.push(`Converted from ${cur} at today’s rate. If the rate moves, so do these figures.`);
        const main = m.leftNew < 0
          ? `There, your costs would be ${money(-m.leftNew)} a month more than your money coming in.`
          : `There, you’d have about ${money(m.leftNew)} left over each month, ${m.change >= 0 ? `${money(m.change)} more` : `${money(-m.change)} less`} than now.`;
        return {
          main,
          state: m.leftNew < 0 || m.short > 0 ? 'warn' : 'good',
          scenarios: [
            { title: 'Stay', status: 'now', big: left(m.leftNow), sentence: 'Left over each month where you are.', rows: rows(true) },
            { title: 'Move', status: m.leftNew < 0 ? 'short' : 'ok', big: left(m.leftNew), sentence: m.short > 0 ? `The move costs ${money(m.upfront)}, ${money(m.short)} more than your savings.` : `After the move, you’d have ${money(m.afterMove)} of savings left.`, rows: rows(false) },
          ],
          meaning: meaning.slice(0, 4),
          footnote: 'Estimates from the figures you’ve entered, assuming they stay the same each month.',
          next: { label: 'Compare two full budgets side by side', href: '#tool/compare' },
        };
      },
    },

    compare: {
      name: 'Compare scenarios',
      icon: 'columns',
      presets: { default: { q: 'How do two of my budgets compare?' } },
      fields: ['compareA', 'compareB'],
      answer() {
        const S = window.BudgetScenarios;
        const list = S ? S.list() : [];
        if (!list.length) {
          return { empty: { title: 'No saved scenarios yet', text: 'Save your budget as a scenario, change it (a new city, a new job), and save it again. Then compare them here.' } };
        }
        const a = value('compareA') || 'current';
        const b = value('compareB');
        const nameOf = (id) => (id === 'current' ? 'My budget now' : (list.find((x) => x.id === id) || {}).name || 'Scenario');
        if (!b) return { empty: { title: 'Choose a scenario to compare', text: 'Pick one below.' }, noBudgetLink: true };
        const A = S.model(a, code());
        const B = S.model(b, code());
        if (!A || !B) return { empty: { title: 'Scenario not found', text: 'Choose another below.' }, noBudgetLink: true };
        [A, B].forEach((x) => {
          if (!x.ok) x.missingRates.forEach((c) => missingRates.add(c));
          if (x.converted) convertedSomething = true;
        });
        if (!A.ok || !B.ok) return {};
        const d = BudgetCore.compareModels(A, B);
        const v = (x) => (x == null ? '—' : money(x));
        const diff = (x) => (x == null ? '—' : x === 0 ? 'Same' : `${x > 0 ? '+' : '−'}${money(Math.abs(x))}`);
        const row = (label, x, y, cls = '') => [label, v(x), v(y), diff(x == null || y == null ? null : y - x), cls];
        const rows = [
          row('Money coming in', A.moneyIn.total, B.moneyIn.total, 'is-total'),
          row('Money going out', A.moneyOut.total, B.moneyOut.total, 'is-total'),
          row('Costs you must pay', A.moneyOut.essential, B.moneyOut.essential, 'is-sub'),
          row('Other spending', A.moneyOut.other, B.moneyOut.other, 'is-sub'),
          row('Money left over', A.leftOver, B.leftOver, 'is-result'),
          row('Left over in a year', A.leftOverYear, B.leftOverYear),
          row('Money you can access', A.savings.accessible, B.savings.accessible),
        ];
        const nA = nameOf(a);
        const nB = nameOf(b);
        let main;
        if (d.leftOver == null) main = `${nB} costs ${diff(d.moneyOut)} a month compared with ${nA}.`;
        else if (Math.abs(d.leftOver) < 0.5) main = `${nB} and ${nA} leave you about the same each month.`;
        else main = `${nB} leaves you ${money(Math.abs(d.leftOver))} ${d.leftOver > 0 ? 'more' : 'less'} each month than ${nA}.`;
        const meaning = [];
        if (d.leftOverYear) meaning.push(`That’s ${money(Math.abs(d.leftOverYear))} ${d.leftOverYear > 0 ? 'more' : 'less'} a year.`);
        if (A.converted || B.converted) meaning.push(`Both are shown in ${code()}, converted at today’s rates.`);
        // Biggest cost differences, by name.
        const byName = (m) => m.moneyOut.items.reduce((o, i) => ((o[i.name] = (o[i.name] || 0) + i.monthly), o), {});
        const ca = byName(A);
        const cb = byName(B);
        const changes = [...new Set([...Object.keys(ca), ...Object.keys(cb)])]
          .map((k) => ({ k, d: (cb[k] || 0) - (ca[k] || 0) }))
          .filter((x) => Math.abs(x.d) >= 1)
          .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
          .slice(0, 3);
        if (changes.length) meaning.push(`Biggest differences: ${changes.map((c) => `${c.k} ${c.d > 0 ? '+' : '−'}${money(Math.abs(c.d))}`).join(', ')}.`);
        return {
          main,
          state: d.leftOver == null ? '' : d.leftOver >= 0 ? 'good' : 'warn',
          table: { head: ['', nA, nB, 'Difference'], rows },
          behindTitle: 'Side by side, each month',
          meaning,
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
    return { fields: p.fields || (tool.fieldsFor ? tool.fieldsFor(key) : tool.fields), defaults: p.defaults || {}, q: p.q, chips: p.chips, twoScenarios: p.twoScenarios || false };
  }

  function fieldHint(key) {
    const f = FIELDS[key];
    if (key === 'savings') return { text: f.help };
    const own = savedValue(key);
    if (sourceOf(key)) {
      const src = SOURCES[sourceOf(key)]();
      const hasOwn = own != null && own !== '';
      if (hasOwn && src.value > 0 && Math.abs(own - src.value) > 0.5) {
        return { text: 'Your figure ·', reset: `Use ${src.label} (${money(src.value)})` };
      }
      if (!hasOwn && src.value > 0) return { text: `From ${src.label}.` };
      if (!hasOwn && f.help) return { text: f.help };
      return null;
    }
    if (f.currencyFrom && value(f.currencyFrom) && value(f.currencyFrom) !== code()) {
      return { text: `In ${value(f.currencyFrom)}.${f.help ? ` ${f.help}` : ''}` };
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
    sum.appendChild(el('span', 'ess-summary-label', 'Costs you must pay'));
    const total = el('span', 'ess-summary-total');
    total.id = 'essTotal';
    sum.appendChild(total);
    det.appendChild(sum);

    det.appendChild(el('p', 'ess-intro', 'We’ve suggested these from your budget, like rent, groceries and transport. Untick anything you could stop, change amounts, or add what’s missing.'));

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

    const add = el('button', 'ess-add', '+ Add a cost you must pay');
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

    if (f.type === 'currency' || f.type === 'scenario') {
      const sel = document.createElement('select');
      sel.id = id;
      sel.className = 'cell-input tool-select';
      if (f.type === 'currency') {
        if (typeof populateCurrencySelectOptions === 'function') populateCurrencySelectOptions(sel, value(key) || code());
        sel.value = value(key) || code();
      } else {
        const opts = [['current', 'My budget now'], ...(window.BudgetScenarios ? window.BudgetScenarios.list().map((x) => [x.id, x.name]) : [])];
        if (!value(key)) opts.unshift(['', 'Choose a saved scenario']);
        opts.forEach(([v, t]) => {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = t;
          sel.appendChild(o);
        });
        sel.value = value(key) || '';
      }
      sel.addEventListener('change', () => {
        setValue(key, sel.value || null);
        render(true);
      });
      wrap.appendChild(sel);
      const hint = el('p', 'tool-field-hint');
      hint.dataset.hintFor = key;
      wrap.appendChild(hint);
      return wrap;
    }

    if (f.type === 'choice') {
      label.removeAttribute('for');
      const group = el('div', 'segmented tool-choice');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', f.label);
      const raw = value(key) ?? preset.defaults[key] ?? f.default ?? (Array.isArray(f.options[0]) ? f.options[0][0] : 0);
      f.options.forEach((opt) => {
        const [val, text] = Array.isArray(opt) ? opt : [opt, `${opt} ${f.unit}`];
        const lab = el('label', 'segmented-option');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = id;
        input.value = String(val);
        input.checked = String(raw) === String(val);
        input.addEventListener('change', () => {
          setValue(key, val);
          $('toolTitle').textContent = titleFor(preset);
          render(Boolean(f.rebuild));
        });
        lab.appendChild(input);
        lab.appendChild(el('span', '', text));
        group.appendChild(lab);
      });
      if (f.options.length > 3) group.classList.add('tool-choice--wrap');
      wrap.appendChild(group);
      return wrap;
    }

    const inputWrap = el('div', f.type === 'money' ? 'money-input-wrap input-wrap' : 'input-wrap');
    const input = document.createElement('input');
    input.id = id;
    input.className = 'cell-input';
    input.dataset.key = key;
    if (f.type === 'money') {
      const cur = moneyCode(key);
      const sym = el('span', 'money-symbol', getCurrencyMeta(cur).symbol);
      sym.setAttribute('aria-hidden', 'true');
      if (f.currencyFrom) sym.dataset.currencyFrom = f.currencyFrom;
      inputWrap.appendChild(sym);
      attachAmountInputFormatting(input, () => getCurrencyMeta(moneyCode(key)).decimals);
      // Shown as typed, in its own currency (worked out in the income currency).
      const raw = f.currencyFrom && store.values && store.values[key];
      const v = raw ? raw.v : value(key);
      input.placeholder = '0';
      if (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) !== 0) {
        input.value = String(Math.round(Number(v) * 100) / 100);
        input.formatAmountValue();
      }
    } else if (f.type === 'month') {
      input.type = 'month';
      input.min = new Date().toISOString().slice(0, 7);
      input.value = value(key) || '';
    } else if (f.type === 'percent') {
      input.type = 'text';
      input.inputMode = 'decimal';
      input.placeholder = '0';
      input.value = value(key) || '';
      inputWrap.classList.add('percent-input-wrap');
      const pc = el('span', 'percent-suffix', '%');
      pc.setAttribute('aria-hidden', 'true');
      inputWrap.appendChild(pc);
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
      else if (f.type === 'percent') v = input.value.trim() === '' ? null : Math.min(100, Math.max(0, Number(input.value.replace(/[^0-9.]/g, '')) || 0));
      else v = input.value;
      setValue(key, v);
      render(false);
    });
    inputWrap.appendChild(input);
    wrap.appendChild(inputWrap);

    // Quick amounts: "+A$250", "My money left over (A$2,027)", "8%".
    if (f.amountChips || f.percentChips || f.leftOverChip) {
      const row = el('div', 'tool-chips');
      const chip = (text, v, aria) => {
        const b = el('button', 'tool-chip', text);
        b.type = 'button';
        if (aria) b.setAttribute('aria-label', aria);
        b.addEventListener('click', () => {
          setValue(key, v);
          render(true);
        });
        row.appendChild(b);
      };
      (f.amountChips || []).forEach((c) => chip(money(c).replace(/\.00$/, ''), c));
      (f.percentChips || []).forEach((c) => chip(`${c}%`, c));
      const left = leftOverNow();
      if (f.leftOverChip && left > 0) chip(`My money left over (${money(left)})`, Math.round(left * 100) / 100);
      if (row.children.length) wrap.appendChild(row);
    }

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
      // A headline can sit above the scenarios (e.g. "saves 6 years").
      if (!a.main) $('toolAnswer').hidden = true;
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

    renderChart(a.empty ? null : a.chart);

    // Behind the answer
    const fig = $('toolFigures');
    fig.innerHTML = '';
    (a.figures || []).forEach(([k, v]) => {
      const row = el('div', 'tool-figure');
      row.appendChild(el('dt', '', k));
      row.appendChild(el('dd', '', v));
      fig.appendChild(row);
    });
    // Monthly and yearly side by side ("How we worked it out").
    const table = $('toolTable');
    table.innerHTML = '';
    table.hidden = !a.table;
    if (a.table) {
      const thead = el('thead');
      const hr = el('tr');
      a.table.head.forEach((h, i) => {
        const th = el('th', i ? 'num' : '', h);
        th.scope = 'col';
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      const tbody = el('tbody');
      // Each row: label, one cell per column, then an optional class.
      const cols = a.table.head.length;
      a.table.rows.forEach((r) => {
        const tr = el('tr', r[cols] || '');
        const th = el('th', '', r[0]);
        th.scope = 'row';
        tr.appendChild(th);
        r.slice(1, cols).forEach((c) => tr.appendChild(el('td', 'num', c)));
        tbody.appendChild(tr);
      });
      table.classList.toggle('tool-table--wide', cols > 3);
      table.append(thead, tbody);
    }

    // What this means, and one next step.
    const meaning = $('toolMeaning');
    meaning.innerHTML = '';
    (a.meaning || []).forEach((t) => meaning.appendChild(el('li', '', t)));
    $('toolMeaningWrap').hidden = !(a.meaning && a.meaning.length) || Boolean(a.empty);
    const nextLink = $('toolNext');
    nextLink.hidden = !a.next || Boolean(a.empty);
    if (a.next) {
      nextLink.href = a.next.href;
      $('toolNextText').textContent = a.next.label;
    }

    $('toolListTitle').textContent = a.listTitle || '';
    $('toolListTitle').hidden = !(a.list && a.list.length && a.listTitle);
    const list = $('toolRankList');
    list.innerHTML = '';
    (a.list || []).forEach((r) => {
      const li = el('li', `tool-rank tool-rank--${r.kind}`);
      const top = el('div', 'tool-rank-top');
      const name = el('span', 'tool-rank-name', r.label);
      if (r.tag) name.appendChild(el('span', 'tool-rank-tag', r.tag));
      top.appendChild(name);
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
    $('toolBehind').hidden = Boolean(a.empty) || (!(a.figures && a.figures.length) && !a.table && !(a.list && a.list.length) && !(!a.scenarios && a.notes && a.notes.length));
    $('toolColumns').classList.toggle('is-single', $('toolBehind').hidden || $('toolAdjust').hidden);
    renderHints();
    updateEssentialsSummary();
  }

  // ---------------------------------------------------------------------------
  // Chart: stacked bars (investing) or lines (a loan balance), one column per
  // year, with a tooltip on hover/focus. Two series at most, always with a
  // legend; the same figures are in the table beside it.
  // ---------------------------------------------------------------------------

  const SVG = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const n = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  }
  const shortMoney = (n) => {
    const sym = getCurrencyMeta(code()).symbol;
    const a = Math.abs(n);
    const t = a >= 1e9 ? `${+(a / 1e9).toFixed(1)}b` : a >= 1e6 ? `${+(a / 1e6).toFixed(1)}m` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : `${Math.round(a)}`;
    return `${sym}${/[A-Za-z]$/.test(sym) ? ' ' : ''}${t}`;
  };

  // Motion: bars grow up from the baseline one after another; lines draw from
  // left to right. When a figure changes, the chart glides to the new values
  // instead of redrawing. It starts once the chart is on screen, and is
  // skipped for people who ask for less motion.
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const ENTER_MS = 700;
  const STAGGER_MS = 35;
  const TWEEN_MS = 420;
  let chartState = null; // { key, shown: values on screen, raf, observer }

  function renderChart(c) {
    const wrap = $('toolChart');
    if (!wrap) return;
    if (chartState && chartState.raf) cancelAnimationFrame(chartState.raf);
    if (chartState && chartState.observer) chartState.observer.disconnect();
    if (!c) {
      wrap.innerHTML = '';
      wrap.hidden = true;
      chartState = null;
      return;
    }
    wrap.hidden = false;
    const key = `${c.kind}|${c.title}|${c.series.map((x) => x.name).join('|')}`;
    const target = c.series.map((x) => x.values.slice());
    const same = chartState && chartState.key === key;

    if (!same) {
      wrap.innerHTML = '';
      wrap.appendChild(el('h2', 'tool-chart-title', c.title));
      const legend = el('ul', 'tool-chart-legend');
      c.series.forEach((x, i) => {
        const li = el('li', `is-s${i}`);
        li.appendChild(el('span', 'tool-chart-key'));
        li.appendChild(document.createTextNode(x.name));
        legend.appendChild(li);
      });
      wrap.appendChild(legend);
      const box = el('div', 'tool-chart-box');
      wrap.appendChild(box);
    } else {
      // Legend names can change with the amounts ("Paying A$650").
      wrap.querySelectorAll('.tool-chart-legend li').forEach((li, i) => {
        if (c.series[i]) li.lastChild.textContent = c.series[i].name;
      });
    }
    const box = wrap.querySelector('.tool-chart-box');
    const W = Math.max(280, Math.round(wrap.clientWidth - 40) || 640);
    const H = W < 500 ? 200 : 260;
    const geo = { W, H, pad: { l: 52, r: 8, t: 8, b: 26 } };
    const maxOf = (vals) => Math.max(1, ...c.labels.map((_, i) => (c.kind === 'stack' ? vals.reduce((a, s) => a + Math.max(0, s[i] || 0), 0) : Math.max(0, ...vals.map((s) => s[i] || 0)))));
    const targetMax = maxOf(target);
    const state = { key, shown: same ? chartState.shown : null, raf: null, observer: null };
    chartState = state;

    const finish = () => {
      state.shown = target;
      drawChart(box, c, target, targetMax, geo, { interactive: true });
    };
    if (reduceMotion()) return finish();

    if (same && state.shown) {
      // Glide from what's on screen to the new figures.
      const from = state.shown;
      const fromMax = maxOf(from);
      const t0 = performance.now();
      const step = (now) => {
        const k = ease(Math.min(1, (now - t0) / TWEEN_MS));
        const vals = target.map((s, si) => s.map((v, i) => {
          const a = from[si] && from[si][i];
          if (v == null) return null;
          if (a == null) return c.kind === 'stack' ? v * k : v;
          return a + (v - a) * k;
        }));
        state.shown = vals;
        drawChart(box, c, vals, fromMax + (targetMax - fromMax) * k, geo, {});
        if (k < 1) state.raf = requestAnimationFrame(step);
        else finish();
      };
      state.raf = requestAnimationFrame(step);
      return;
    }

    // First appearance: hold at the start until the chart is on screen.
    const start = () => {
      const n = c.labels.length;
      const total = c.kind === 'stack' ? ENTER_MS + STAGGER_MS * (n - 1) : ENTER_MS + 200;
      const t0 = performance.now();
      const step = (now) => {
        const ms = now - t0;
        if (c.kind === 'stack') {
          const vals = target.map((s) => s.map((v, i) => (v == null ? null : v * ease(Math.max(0, Math.min(1, (ms - STAGGER_MS * i) / ENTER_MS))))));
          state.shown = vals;
          drawChart(box, c, vals, targetMax, geo, {});
        } else {
          drawChart(box, c, target, targetMax, geo, { reveal: ease(Math.min(1, ms / (ENTER_MS + 200))) });
        }
        if (ms < total) state.raf = requestAnimationFrame(step);
        else finish();
      };
      state.raf = requestAnimationFrame(step);
    };
    const zero = target.map((s) => s.map((v) => (v == null ? null : 0)));
    if (c.kind === 'stack') drawChart(box, c, zero, targetMax, geo, {});
    else drawChart(box, c, target, targetMax, geo, { reveal: 0 });
    state.shown = c.kind === 'stack' ? zero : target;
    if ('IntersectionObserver' in window) {
      state.observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        state.observer.disconnect();
        state.observer = null;
        start();
      }, { threshold: 0.35 });
      state.observer.observe(box);
    } else start();
  }

  /** One frame of the chart. `reveal` (0–1) uncovers lines from the left. */
  function drawChart(box, c, vals, max, geo, { interactive = false, reveal = 1 }) {
    const { W, H, pad } = geo;
    const n = c.labels.length;
    const stacked = c.kind === 'stack';
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    const colW = (W - pad.l - pad.r) / n;
    const x = (i) => pad.l + colW * i + colW / 2;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tool-chart-svg', role: 'img', 'aria-label': c.title });

    // Gridlines and y labels (recessive).
    [0, 0.5, 1].forEach((f) => {
      const v = max * f;
      chart.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'tool-chart-grid' }));
      const t = svg('text', { x: pad.l - 6, y: y(v) + 4, class: 'tool-chart-axis', 'text-anchor': 'end' });
      t.textContent = shortMoney(v);
      chart.appendChild(t);
    });
    // X labels: thinned to fit, never colliding with the last one.
    const every = Math.ceil(n / Math.max(2, Math.floor((W - pad.l) / 52)));
    const labelled = (i) => i === n - 1 || (i % every === 0 && !(i && n - 1 - i < every));
    c.labels.forEach((l, i) => {
      if (!labelled(i)) return;
      const t = svg('text', { x: x(i), y: H - 8, class: 'tool-chart-axis', 'text-anchor': 'middle' });
      t.textContent = l;
      chart.appendChild(t);
    });

    const totals = c.labels.map((_, i) => vals.reduce((a, s) => a + Math.max(0, s[i] || 0), 0));
    if (stacked) {
      const bw = Math.max(2, Math.min(28, colW - 4));
      c.labels.forEach((_, i) => {
        let base = 0;
        vals.forEach((s, si) => {
          const v = Math.max(0, s[i] || 0);
          if (v <= 0) return;
          const top = y(base + v);
          const h = Math.max(0, y(base) - top - (base > 0 ? 2 : 0)); // 2px gap between segments
          chart.appendChild(svg('rect', { x: x(i) - bw / 2, y: top, width: bw, height: h, rx: si === vals.length - 1 ? 3 : 0, class: `tool-chart-bar is-s${si}` }));
          base += v;
        });
      });
    } else {
      const clipId = `chartClip${Math.random().toString(36).slice(2, 8)}`;
      if (reveal < 1) {
        const defs = svg('defs');
        const cp = svg('clipPath', { id: clipId });
        cp.appendChild(svg('rect', { x: 0, y: 0, width: pad.l + (W - pad.l) * reveal, height: H }));
        defs.appendChild(cp);
        chart.appendChild(defs);
      }
      vals.forEach((s, si) => {
        const pts = s.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
        const line = svg('polyline', { points: pts.join(' '), class: `tool-chart-line is-s${si}` });
        if (reveal < 1) line.setAttribute('clip-path', `url(#${clipId})`);
        chart.appendChild(line);
      });
    }
    chart.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'tool-chart-base' }));

    box.innerHTML = '';
    box.appendChild(chart);
    if (!interactive) return;

    // Hover/focus: one hit column per year, bigger than the marks.
    const tip = el('div', 'tool-chart-tip');
    tip.hidden = true;
    const cross = svg('line', { y1: pad.t, y2: H - pad.b, class: 'tool-chart-cross', visibility: 'hidden' });
    chart.appendChild(cross);
    c.labels.forEach((l, i) => {
      const hit = svg('rect', { x: pad.l + colW * i, y: pad.t, width: colW, height: H - pad.t - pad.b, class: 'tool-chart-hit', tabindex: labelled(i) ? '0' : '-1' });
      const label = c.tipLabel ? c.tipLabel(i) : l;
      hit.setAttribute('aria-label', `${label}: ${c.series.map((s, si) => (vals[si][i] == null ? null : `${s.name} ${money(vals[si][i])}`)).filter(Boolean).join(', ')}`);
      const showTip = () => {
        tip.innerHTML = '';
        tip.appendChild(el('strong', '', label));
        c.series.forEach((s, si) => {
          if (vals[si][i] == null) return;
          const row = el('span', `is-s${si}`);
          row.appendChild(el('span', 'tool-chart-key'));
          row.appendChild(document.createTextNode(`${s.name}: ${money(vals[si][i])}`));
          tip.appendChild(row);
        });
        if (stacked) tip.appendChild(el('span', 'tool-chart-tip-total', `Total: ${money(totals[i])}`));
        tip.hidden = false;
        tip.style.left = `${Math.min(70, Math.max(0, (x(i) / W) * 100 - 15))}%`;
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.setAttribute('visibility', 'visible');
      };
      const hide = () => {
        tip.hidden = true;
        cross.setAttribute('visibility', 'hidden');
      };
      hit.addEventListener('pointerenter', showTip);
      hit.addEventListener('focus', showTip);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('blur', hide);
      chart.appendChild(hit);
    });
    box.appendChild(tip);
  }

  /** "Could I afford to take six months off?" follows the length chosen. */
  function titleFor(preset) {
    // Savings goal: the question follows what you want to know.
    if (preset.fields.includes('goalMode')) {
      return {
        amount: 'How much should I save to reach my goal?',
        projection: 'How much will I have if I keep saving?',
      }[value('goalMode')] || preset.q;
    }
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
      s.textContent = getCurrencyMeta((s.dataset.currencyFrom && value(s.dataset.currencyFrom)) || code()).symbol;
    });
    renderAnswer();
  }

  // The three tools merged into "Understand my money" keep working as links.
  const ALIASES = {
    breakdown: { default: 'default', living: 'living' },
    capacity: { default: 'default', year: 'year', needed: 'needed' },
    snapshot: { default: 'snapshot' },
  };

  function show(id, presetKey) {
    if (ALIASES[id]) {
      const p = ALIASES[id][presetKey || 'default'] || 'default';
      history.replaceState(null, '', `#tool/understand${p === 'default' ? '' : `/${p}`}`);
      id = 'understand';
      presetKey = p;
    }
    if (!TOOLS[id]) return false;
    current = { id, presetKey: TOOLS[id].presets[presetKey] ? presetKey : 'default' };
    // A new page: its chart animates in from the start.
    renderChart(null);
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

  let lastWidth = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!current || window.innerWidth === lastWidth || $('toolChart').hidden) return;
      lastWidth = window.innerWidth;
      render(false);
    }, 150);
  });

  window.BudgetTools = { show, TOOLS, FIELDS, value };
  if (typeof recomputeAll === 'function') recomputeAll();
})();
