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
    if (current) render();
  });

  function code() {
    return (lastBudget && lastBudget.incomeCode) || (typeof getIncomeCurrency === 'function' ? getIncomeCurrency() : 'USD');
  }

  function toCode(amount, from) {
    if (!from || from === code()) return amount;
    const v = typeof convert === 'function' ? convert(amount, from, code()) : NaN;
    return Number.isFinite(v) ? v : amount;
  }

  /** Planner expense rows as monthly amounts in the income currency. */
  function budgetRows() {
    const out = [];
    const kinds = [
      ['fixedExpensesBody', 'fixed'],
      ['variableExpensesBody', 'variable'],
      ['subscriptionsBody', 'subs'],
    ];
    kinds.forEach(([id, kind]) => {
      const tbody = $(id);
      if (!tbody) return;
      tbody.querySelectorAll('tr.expense-row').forEach((tr) => {
        const name = (tr.querySelector('.expense-name-input') || {}).value || '';
        const amt = parseAmount((tr.querySelector('.expense-amount-input') || {}).value || '');
        const freq = (tr.querySelector('.expense-freq-select') || {}).value || 'monthly';
        const cur = (tr.querySelector('.expense-currency-select') || {}).value || code();
        const monthly = toCode(frequencyToMonthly(amt, freq), cur);
        if (monthly > 0) out.push({ name, monthly, kind });
      });
    });
    return out;
  }

  function splitMonthly(id) {
    if (typeof currentSplits === 'undefined' || !lastBudget) return 0;
    const s = currentSplits.find((x) => x.id === id);
    return s ? (lastBudget.income || 0) * (Number(s.percent) || 0) / 100 : 0;
  }

  function budget() {
    const b = lastBudget || {};
    const n = (x) => (Number.isFinite(x) ? x : 0);
    const fixed = n(b.fixed);
    const expenses = fixed + n(b.variable) + n(b.subs);
    return {
      has: n(b.income) > 0 || expenses > 0,
      income: n(b.income),
      fixed,
      expenses,
      goals: n(b.goals),
      emergencyMonthly: splitMonthly('emergency'),
      savingsMonthly: splitMonthly('savings'),
    };
  }

  // ---------------------------------------------------------------------------
  // Fields
  // ---------------------------------------------------------------------------

  /** Budget-linked defaults, with the words shown under the field. */
  const SOURCES = {
    income: () => ({ value: budget().income, label: 'your budget' }),
    expenses: () => ({ value: budget().expenses, label: 'your budget' }),
    essentials: () => ({ value: budget().fixed, label: 'your fixed costs' }),
    emergencyMonthly: () => ({ value: budget().emergencyMonthly, label: 'your Emergency fund split' }),
    goalMonthly: () => ({ value: budget().savingsMonthly, label: 'your Long-term savings split' }),
    emergencySaved: () => ({ value: savedValue('savings'), label: 'your savings balance' }),
  };

  const FIELDS = {
    savings: { label: 'Savings you could use', type: 'money', help: 'Used by every calculator.' },
    income: { label: 'Monthly income', type: 'money', source: 'income' },
    expenses: { label: 'Monthly costs', type: 'money', source: 'expenses' },
    essentials: { label: 'Essential monthly costs', type: 'money', source: 'essentials' },
    cover: { label: 'Months of cover', type: 'choice', options: [3, 6, 12], unit: 'months' },
    emergencySaved: { label: 'Already set aside', type: 'money', source: 'emergencySaved' },
    emergencyMonthly: { label: 'Adding each month', type: 'money', source: 'emergencyMonthly' },
    incomeDuring: { label: 'Income you’d still have each month', type: 'money', help: 'e.g. part-time work' },
    lumpSum: { label: 'Payout or other one-off money', type: 'money', help: 'e.g. redundancy pay' },
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
    const digits = abs >= 100 ? 0 : meta.decimals;
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
      fields: ['essentials', 'emergencySaved', 'emergencyMonthly'],
      answer() {
        const ess = value('essentials');
        if (!ess) return { empty: { title: 'No essential costs yet', text: 'Type your essential monthly costs below, or fill in your budget.' } };
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
        default: { q: 'How long could I manage without an income?', fields: ['savings', 'expenses', 'essentials', 'incomeDuring'] },
        timeoff: { q: 'Could I afford to take six months off?', fields: ['duration', 'savings', 'expenses', 'incomeDuring'], defaults: { duration: 6 } },
        leave: { q: 'How much should I save before leaving my job?', fields: ['duration', 'savings', 'expenses', 'incomeDuring'], defaults: { duration: 6 } },
        jobloss: { q: 'What would happen if I lost my job?', fields: ['savings', 'lumpSum', 'expenses', 'essentials', 'incomeDuring'] },
      },
      answer(p, preset) {
        const costs = value('expenses');
        if (!costs) return { empty: { title: 'No monthly costs yet', text: 'Type your costs and savings below, or fill in your budget.' } };
        const duration = preset.fields.includes('duration') ? Number(value('duration') || preset.defaults.duration) : 0;
        const b = budget();
        const r = J.runway({
          savings: value('savings'),
          costs,
          essentials: preset.fields.includes('essentials') ? value('essentials') : 0,
          income: value('incomeDuring'),
          lumpSum: preset.fields.includes('lumpSum') ? value('lumpSum') : 0,
          duration,
          capacity: Math.max(0, b.income - b.expenses),
        });
        if (r.incomeCovers) return { main: 'Your other income covers your costs.', sub: 'Your savings would stay untouched.', state: 'good' };
        if (duration) {
          const fig = [[`${money(r.monthlyBurn)} × ${duration} months`, money(r.breakCost)], ['Your savings', money(r.pot)]];
          if (!r.pot && p !== 'leave') return { main: `${duration} months off would cost ${money(r.breakCost)}.`, sub: 'Add your savings below to see if you can afford it.', figures: fig.slice(0, 1) };
          if (r.monthsToSaveGap) fig.push([`${money(r.shortfall)} ÷ ${money(Math.max(0, b.income - b.expenses))} saved a month`, months(r.monthsToSaveGap)]);
          if (p === 'leave') {
            return {
              main: `You need ${money(r.breakCost)} for ${duration} months without pay.`,
              sub: r.affordable ? 'You already have enough.' : `${money(r.shortfall)} to go${r.monthsToSaveGap ? `, about ${months(r.monthsToSaveGap)} of saving` : ''}.`,
              state: r.affordable ? 'good' : 'warn',
              figures: fig,
            };
          }
          return {
            main: r.affordable ? `Yes. You’d have ${money(r.leftAfter)} left after ${duration} months off.` : `Not yet. You’re ${money(r.shortfall)} short.`,
            sub: r.affordable ? '' : r.monthsToSaveGap ? `About ${months(r.monthsToSaveGap)} of saving at your current rate.` : '',
            state: r.affordable ? 'good' : 'warn',
            figures: fig,
          };
        }
        if (!r.pot) return { empty: { title: 'No savings entered', text: 'Add your savings below to see how long they’d last.' } };
        const end = J.dateAfter(r.exactMonths);
        const lump = p === 'jobloss' && value('lumpSum') > 0;
        const fig = [
          [`${money(r.pot)} ÷ ${money(r.monthlyBurn)} a month`, `${r.exactMonths.toFixed(1)} months`],
          ['Counting from', `today, ${dayMonth(new Date())}`],
        ];
        return {
          main: `${lump ? 'Your savings and payout' : 'Your savings'} would last ${months(r.months)}, until ${partOfMonth(end)}.`,
          sub: r.essentialsMonths != null && r.essentialsMonths > r.months ? `Cut back to essentials and it’s ${months(r.essentialsMonths)}.` : '',
          state: r.months >= 6 ? 'good' : 'warn',
          figures: fig,
        };
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

  let current = null; // { id, presetKey }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function presetOf(id, key) {
    const tool = TOOLS[id];
    const p = (tool && tool.presets[key]) || tool.presets.default;
    return { fields: p.fields || tool.fields, defaults: p.defaults || {}, q: p.q, chips: p.chips };
  }

  function fieldHint(key) {
    const f = FIELDS[key];
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

  function buildField(key, preset) {
    const f = FIELDS[key];
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
      if (v != null && v !== '' && Number(v) !== 0) {
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
    const a = tool.answer(presetKey, preset) || {};

    // Empty: one clear card that says so, instead of an answer.
    const empty = $('toolEmpty');
    empty.hidden = !a.empty;
    $('toolAnswer').hidden = Boolean(a.empty);
    if (a.empty) {
      $('toolEmptyTitle').textContent = a.empty.title;
      $('toolEmptyText').textContent = a.empty.text;
      $('toolEmptyLink').hidden = Boolean(a.noBudgetLink);
    }
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
    const notes = $('toolNotes');
    notes.innerHTML = '';
    (a.notes || []).forEach((n) => notes.appendChild(el('li', '', n)));
    $('toolBehind').hidden = Boolean(a.empty) || (!(a.figures && a.figures.length) && !(a.list && a.list.length) && !(a.notes && a.notes.length));
    $('toolColumns').classList.toggle('is-single', $('toolBehind').hidden || $('toolAdjust').hidden);
    renderHints();
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
      $('toolTitle').textContent = preset.q;
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

  window.BudgetTools = { show, TOOLS, FIELDS, value };
  if (typeof recomputeAll === 'function') recomputeAll();
})();
