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
    savings: { label: 'Savings you could use', type: 'money', help: 'One figure, shared by every calculator.' },
    income: { label: 'Monthly income', type: 'money', source: 'income' },
    expenses: { label: 'Monthly costs', type: 'money', source: 'expenses' },
    essentials: { label: 'Essential monthly costs', type: 'money', source: 'essentials', help: 'Your fixed costs.' },
    cover: { label: 'Months of cover', type: 'choice', options: [3, 6, 12], unit: 'months' },
    emergencySaved: { label: 'Already set aside', type: 'money', source: 'emergencySaved' },
    emergencyMonthly: { label: 'Adding each month', type: 'money', source: 'emergencyMonthly' },
    incomeDuring: { label: 'Income you’d still have each month', type: 'money', help: 'Part-time work, rent from a room, benefits.' },
    lumpSum: { label: 'Payout or other one-off money', type: 'money', help: 'Redundancy pay, a final payslip, a tax refund.' },
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

  // ---------------------------------------------------------------------------
  // Tools: fields shown, and the answer they produce
  // ---------------------------------------------------------------------------

  const TOOLS = {
    breakdown: {
      name: 'Spending breakdown',
      presets: {
        default: { q: 'Where does my money go each month?' },
        living: { q: 'How much does it really cost to live each month?' },
      },
      fields: [],
      needsBudget: 'Add your costs in the budget planner and they’ll be ranked here.',
      answer(p) {
        const b = J.breakdown(budgetRows());
        if (!b.total) return { main: 'Add your regular costs to see where your money goes.', state: '' };
        const names = b.top.map((r) => r.name.toLowerCase());
        const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
        const main = p === 'living'
          ? `Living costs you ${money(b.total)} a month.`
          : `Your ${b.top.length === 1 ? 'biggest cost takes' : `${b.top.length} biggest costs take`} ${pct(b.topShare)} of your spending: ${list}.`;
        return {
          main,
          sub: `${money(b.flexible)} a month is flexible — that’s the part you can change quickly.`,
          figures: [
            ['Total each month', money(b.total)],
            ['Fixed (essentials)', money(b.fixed)],
            ['Flexible (variable + subscriptions)', money(b.flexible)],
            ['Each year', money(b.total * 12)],
          ],
          list: b.items.map((r) => ({ label: r.name, value: money(r.monthly), share: r.share, kind: r.kind })),
        };
      },
    },

    capacity: {
      name: 'Savings capacity',
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
          if (!exp) return { main: 'Add your monthly costs to see the income you need.' };
          return {
            main: `You need ${money(c.incomeNeeded)} a month to cover your costs.`,
            sub: b.goals > 0 ? `${money(c.incomeNeededWithGoals)} if you also want to fund your savings & goals.` : '',
            state: inc ? (inc >= c.incomeNeeded ? 'good' : 'warn') : '',
            figures: [
              ['Monthly costs', money(exp)],
              ['Savings & goals planned', money(b.goals)],
              ...(inc ? [['Your income now', money(inc)], [inc >= exp ? 'Room to spare' : 'Short by', money(Math.abs(inc - exp))]] : []),
            ],
          };
        }
        if (!inc) return { main: 'Add your monthly income to see what you can save.' };
        if (c.monthly <= 0) {
          return {
            main: `Your costs are ${money(-c.monthly)} a month more than you earn.`,
            sub: 'There’s nothing left to save until income rises or costs come down.',
            state: 'bad',
            figures: [['Monthly income', money(inc)], ['Monthly costs', money(exp)]],
          };
        }
        const main = p === 'year'
          ? `You could save ${money(c.yearly)} over the next year.`
          : `You can save ${money(c.monthly)} a month — ${pct(c.rate)} of your income.`;
        const sub = p === 'year'
          ? `That’s ${money(c.monthly)} a month, ${pct(c.rate)} of your income.`
          : `That’s ${money(c.yearly)} a year.`;
        const figures = [
          ['Monthly income', money(inc)],
          ['Monthly costs', `− ${money(exp)}`],
          ['Left each month', money(c.monthly)],
        ];
        const notes = [];
        if (c.goalsGap > 0) notes.push(`Your savings & goals split plans ${money(b.goals)} a month — ${money(c.goalsGap)} more than you have left.`);
        if (c.trimTenPercent > 0) notes.push(`Trimming flexible spending by 10% would add ${money(c.trimTenPercent)} a month.`);
        return { main, sub, state: 'good', figures, notes };
      },
    },

    snapshot: {
      name: 'Money snapshot',
      presets: { default: { q: 'What does my financial situation look like?' } },
      fields: ['savings'],
      needsBudget: 'Fill in your income and costs in the budget planner to see your snapshot.',
      answer() {
        const b = budget();
        if (!b.income) return { main: 'Add your income and costs to see your snapshot.' };
        const top = J.breakdown(budgetRows()).items[0];
        const s = J.snapshot({ income: b.income, fixed: b.fixed, expenses: b.expenses, biggest: top, savings: value('savings') });
        const kept = s.savingsRate;
        return {
          main: kept >= 0 ? `You keep ${pct(kept)} of what you earn.` : `You spend ${pct(-kept)} more than you earn.`,
          sub: `Fixed costs take ${pct(s.fixedShare)} of your income.`,
          state: kept >= 0 ? 'good' : 'bad',
          tiles: [
            { label: 'Savings rate', value: pct(kept), note: 'of income left after all costs' },
            { label: 'Locked in', value: pct(s.fixedShare), note: 'of income goes to fixed costs' },
            { label: 'Biggest cost', value: s.biggest ? money(s.biggest.monthly) : '—', note: s.biggest ? s.biggest.name : 'No costs yet' },
            { label: 'Runway', value: s.runwayMonths != null ? months(s.runwayMonths) : '—', note: s.runwayMonths != null ? 'your savings would cover' : 'Add savings below to see this' },
          ],
        };
      },
    },

    emergency: {
      name: 'Emergency fund',
      presets: { default: { q: 'How much should I have in an emergency fund?' } },
      // Months of cover is chosen on the three targets in the answer itself.
      fields: ['essentials', 'emergencySaved', 'emergencyMonthly'],
      answer() {
        const ess = value('essentials');
        if (!ess) return { main: 'Add your essential monthly costs to see your target.' };
        const r = J.emergencyFund({ essentials: ess, months: value('cover'), saved: value('emergencySaved'), monthly: value('emergencyMonthly') });
        const targets = r.targets.map((t) => ({ label: `${t.months} months`, value: money(t.target), key: t.months }));
        if (!r.chosen) {
          return {
            main: `Your essentials cost ${money(ess)} a month.`,
            sub: 'Choose how many months you’d like covered.',
            targets,
          };
        }
        const fig = [
          [`Target (${r.chosen} months of essentials)`, money(r.target)],
          ['Already set aside', money(r.saved)],
          ['Still to go', money(r.gap)],
        ];
        if (r.covered) {
          return { main: `You’re covered: ${money(r.saved)} is more than ${r.chosen} months of essentials.`, sub: r.monthsCoveredNow ? `It would cover about ${Math.floor(r.monthsCoveredNow)} months.` : '', state: 'good', targets, figures: fig };
        }
        const when = r.monthsToBuild != null
          ? `About ${months(r.monthsToBuild)} at ${money(value('emergencyMonthly'))} a month — by ${fromToday(r.monthsToBuild)}.`
          : 'Set an amount to add each month to see when you’d get there.';
        return { main: `Aim for ${money(r.target)}. You have ${money(r.saved)}, so ${money(r.gap)} to go.`, sub: when, state: 'warn', targets, figures: fig };
      },
    },

    runway: {
      name: 'Financial runway',
      presets: {
        default: { q: 'How long could I manage without an income?', fields: ['savings', 'expenses', 'essentials', 'incomeDuring'] },
        timeoff: { q: 'Could I afford to take six months off?', fields: ['duration', 'savings', 'expenses', 'incomeDuring'], defaults: { duration: 6 } },
        leave: { q: 'How much should I save before leaving my job?', fields: ['duration', 'savings', 'expenses', 'incomeDuring'], defaults: { duration: 6 } },
        jobloss: { q: 'What would happen if I lost my job?', fields: ['savings', 'lumpSum', 'expenses', 'essentials', 'incomeDuring'] },
      },
      answer(p, preset) {
        const costs = value('expenses');
        if (!costs) return { main: 'Add your monthly costs to see how long your savings would last.' };
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
        if (r.incomeCovers) {
          return { main: 'The income you’d still have covers your costs.', sub: 'Your savings wouldn’t need to be touched.', state: 'good', figures: [['Monthly costs', money(costs)], ['Income you’d still have', money(value('incomeDuring'))]] };
        }
        if (duration && !r.pot && p !== 'leave') {
          return {
            main: `${duration} months off would cost ${money(r.breakCost)}.`,
            sub: 'Add your savings below to see if you could afford it.',
            figures: [[`${duration} months of costs`, money(r.breakCost)]],
          };
        }
        if (duration) {
          const fig = [
            [`${duration} months of costs`, money(r.breakCost)],
            ['Savings you could use', money(r.pot)],
            [r.affordable ? 'Left afterwards' : 'Short by', money(Math.abs(r.leftAfter))],
          ];
          if (p === 'leave') {
            return {
              main: `Save ${money(r.breakCost)} to cover ${duration} months without pay.`,
              sub: r.affordable ? `You have ${money(r.pot)} — that’s already enough.` : `You have ${money(r.pot)}, so ${money(r.shortfall)} to go${r.monthsToSaveGap ? ` — about ${months(r.monthsToSaveGap)} at your current rate` : ''}.`,
              state: r.affordable ? 'good' : 'warn',
              figures: fig,
            };
          }
          return {
            main: r.affordable
              ? `Yes — ${duration} months off costs ${money(r.breakCost)} and you have ${money(r.pot)}.`
              : `Not yet — you’re ${money(r.shortfall)} short for ${duration} months off.`,
            sub: r.affordable
              ? `You’d have ${money(r.leftAfter)} left when you’re back.`
              : r.monthsToSaveGap ? `That’s about ${months(r.monthsToSaveGap)} of saving at your current rate.` : 'Add your income in the budget to see how long it would take to save.',
            state: r.affordable ? 'good' : 'warn',
            figures: fig,
          };
        }
        if (!r.pot) return { main: 'Add your savings to see how long they’d last.', figures: [['Monthly costs', money(costs)]] };
        const main = p === 'jobloss' && value('lumpSum') > 0
          ? `With ${money(value('savings'))} saved plus ${money(value('lumpSum'))}, you could cover ${months(r.months)}.`
          : `Your savings would last ${months(r.months)}${r.months > 0 && r.months !== Infinity ? ` — until ${fromToday(r.months)}` : ''}.`;
        const sub = r.essentialsMonths != null && r.essentialsMonths > r.months
          ? `Cutting back to essentials stretches that to ${months(r.essentialsMonths)}.`
          : '';
        return {
          main,
          sub,
          state: r.months >= 6 ? 'good' : 'warn',
          figures: [
            ['Savings you could use', money(r.pot)],
            ['Going out each month', money(r.monthlyBurn)],
            ...(r.essentialsMonths != null ? [['Essentials only', `${money(Math.max(0, value('essentials') - (value('incomeDuring') || 0)))} a month`]] : []),
          ],
        };
      },
    },

    goal: {
      name: 'Savings goal',
      presets: { default: { q: 'How can I reach my savings goal?' } },
      fields: ['goalName', 'goalTarget', 'goalSaved', 'goalMonthly', 'goalDeadline'],
      answer() {
        const target = value('goalTarget');
        if (!target) return { main: 'Enter a target to see when you’ll reach it.' };
        const name = String(value('goalName') || '').trim();
        const g = J.savingsGoal({ target, saved: value('goalSaved'), monthly: value('goalMonthly'), deadline: value('goalDeadline') });
        const what = name ? name : money(target);
        const fig = [['Target', money(target)], ['Saved so far', money(g.saved)], ['Still to go', money(g.gap)], ['Saving each month', money(g.monthly)]];
        if (g.reached) return { main: `You’ve already reached ${what}.`, state: 'good', figures: fig };
        if (g.deadlineMonths) {
          const by = monthYear(J.addMonths(g.deadlineMonths));
          if (g.onTrack) {
            return { main: `You’re on track: at ${money(g.monthly)} a month you’ll reach ${what} by ${monthYear(g.reachDate)}.`, sub: `That’s before your ${by} deadline.`, state: 'good', figures: fig };
          }
          return {
            main: `To reach ${what} by ${by}, save ${money(g.requiredMonthly)} a month.`,
            sub: g.monthly > 0 ? `That’s ${money(g.extraNeeded)} more than you’re saving now.` : `That’s ${months(g.deadlineMonths)} from now.`,
            state: 'warn',
            figures: [...fig, ['Needed each month', money(g.requiredMonthly)]],
          };
        }
        if (g.months == null) return { main: 'Set how much you’ll save each month to see when you’ll get there.', figures: fig };
        return { main: `You’ll reach ${what} by ${monthYear(g.reachDate)}.`, sub: `${months(g.months)} at ${money(g.monthly)} a month.`, state: 'good', figures: fig };
      },
    },

    income: {
      name: 'Income change',
      presets: {
        default: { q: 'What happens if my income decreases?', fields: ['newIncome', 'income', 'expenses', 'savings'] },
        less: { q: 'Could I afford to work less?', fields: ['newIncome', 'income', 'expenses', 'savings'], chips: [-20, -40, -50] },
        career: { q: 'Could I afford to change careers?', fields: ['newIncome', 'transitionMonths', 'transitionIncome', 'oneOff', 'income', 'expenses', 'savings'], chips: [] },
      },
      answer(p, preset) {
        const inc = value('income');
        const exp = value('expenses');
        const next = value('newIncome');
        if (!inc || !exp) return { main: 'Add your current income and costs to compare.' };
        if (next == null || next === '') return { main: p === 'career' ? 'Enter the salary you’d expect in the new role.' : 'Enter the income you’d have instead, or pick a change.' };
        const career = p === 'career';
        const c = J.incomeChange({
          income: inc, newIncome: next, expenses: exp, savings: value('savings'),
          transition: career ? { months: value('transitionMonths'), income: value('transitionIncome'), oneOff: value('oneOff') } : null,
        });
        const fig = [
          ['Left each month now', money(c.leftNow)],
          ['Left each month on the new income', money(c.leftNew)],
          ['Difference each year', money(c.diffYearly)],
        ];
        if (career && c.transitionCost != null) {
          fig.unshift(['Cost of the switch', money(c.transitionCost)]);
          const after = c.short
            ? `Afterwards you’d be ${money(-c.leftNew)} short each month.`
            : `Afterwards you’d have ${money(c.leftNew)} a month left (vs ${money(c.leftNow)} now).`;
          const extra = c.breakEvenMonths ? ` You’d be ahead after ${months(c.breakEvenMonths)} in the new role.` : '';
          const cover = value('savings') > 0 ? (c.savingsAfterTransition >= 0 ? ' Your savings cover the switch.' : ` Your savings fall ${money(-c.savingsAfterTransition)} short of it.`) : '';
          return {
            main: `The switch costs ${money(c.transitionCost)} in total.`,
            sub: after + extra + cover,
            state: c.short || c.savingsAfterTransition < 0 ? 'warn' : 'good',
            figures: fig,
          };
        }
        if (c.short) {
          return {
            main: `On ${money(next)} you’d be ${money(-c.leftNew)} short each month.`,
            sub: c.savingsCoverMonths ? `Your savings would cover that for ${months(c.savingsCoverMonths)}.` : 'Add your savings to see how long they’d cover the gap.',
            state: 'bad',
            figures: fig,
          };
        }
        return {
          main: `On ${money(next)} you’d have ${money(c.leftNew)} left a month instead of ${money(c.leftNow)}.`,
          sub: c.diffYearly < 0 ? `That’s ${money(-c.diffYearly)} less a year.` : `That’s ${money(c.diffYearly)} more a year.`,
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
        return { text: `Your own figure.`, reset: `Use ${src.label} (${money(src.value)})` };
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
    $('toolBehind').hidden = !(a.figures && a.figures.length) && !(a.list && a.list.length) && !(a.notes && a.notes.length);
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
      $('toolTitle').textContent = preset.q;
      const fields = $('toolFields');
      fields.innerHTML = '';
      preset.fields.forEach((k) => fields.appendChild(buildField(k, preset)));
      $('toolAdjust').hidden = !preset.fields.length;
      const b = budget();
      $('toolNeedsBudget').hidden = !(tool.needsBudget && !b.has);
      $('toolNeedsBudgetText').textContent = tool.needsBudget || '';
      $('toolSourceCode').textContent = `${getCurrencyMeta(code()).name} (${code()})`;
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
  const needsLink = $('toolNeedsBudgetLink');
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
