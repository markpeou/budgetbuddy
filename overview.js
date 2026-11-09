/**
 * Summary overview: one headline sentence, a Day/Week/Month/Year toggle and
 * six rows, instead of the full tables (which stay under "Show all numbers").
 *
 * Also flags the Savings & goals split as "Suggested" until it's edited.
 *
 * Listens for `budget:recompute` from script.js (monthly figures, income currency).
 */
(function () {
  'use strict';

  const PERIOD_KEY = 'budgetBuddyOverviewPeriod_v1';
  // Same conversions as the breakdown table: monthly × 12 ÷ periods per year.
  const PERIODS = {
    day: { factor: 12 / 365, word: 'day', each: 'a day' },
    week: { factor: 12 / 52, word: 'week', each: 'a week' },
    month: { factor: 1, word: 'month', each: 'a month' },
    year: { factor: 12, word: 'year', each: 'a year' },
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    headline: $('overviewHeadline'),
    main: $('overviewHeadlineMain'),
    sub: $('overviewHeadlineSub'),
    rows: $('overviewRows'),
  };
  if (!els.headline) return;

  let last = null;

  function getPeriod() {
    const checked = document.querySelector('input[name="overviewPeriod"]:checked');
    return checked && PERIODS[checked.value] ? checked.value : 'month';
  }

  function money(n, code) {
    return formatInCurrency(Math.abs(n), code);
  }

  function render() {
    if (!last) return;
    const d = last;
    const p = PERIODS[getPeriod()];
    const k = p.factor;
    const code = d.incomeCode;
    const n = (x) => (Number.isFinite(x) ? x : 0);

    const income = n(d.income);
    const fixed = n(d.fixed);
    const variable = n(d.variable);
    const subs = n(d.subs);
    const expenses = fixed + variable + subs;
    const goals = n(d.goals);
    const afterExpenses = income - expenses;
    const left = afterExpenses - goals;

    // Headline
    let state = '';
    let main;
    let sub = '';
    if (income <= 0) {
      main = 'Add your income to see your summary.';
    } else if (!d.expensesOk) {
      main = 'Waiting for exchange rates…';
      sub = 'Some expenses are in another currency.';
    } else if (afterExpenses < 0) {
      state = 'bad';
      main = `You’re spending ${money(afterExpenses * k, code)} more than you earn ${p.each}.`;
      sub = 'Cut some expenses before setting money aside.';
    } else if (left < 0) {
      state = 'warn';
      main = `Your savings & goals are ${money(left * k, code)} more than you have left ${p.each}.`;
      sub = `After expenses you have ${money(afterExpenses * k, code)}. Lower a goal or trim a cost.`;
    } else if (Math.round(left) === 0) {
      state = 'good';
      main = 'Every bit of your income has a job.';
      sub = `${money(expenses * k, code)} on expenses and ${money(goals * k, code)} put aside ${p.each}.`;
    } else {
      state = 'good';
      main = `${money(left * k, code)} left over ${p.each}.`;
      sub = `After ${money(expenses * k, code)} of expenses and ${money(goals * k, code)} for savings & goals.`;
    }
    els.headline.dataset.state = state;
    syncStrip({ income, expenses, goals, left, code });
    els.main.textContent = main;
    els.sub.textContent = sub;
    els.sub.hidden = !sub;

    // Rows: one number each, plus share of income.
    const rows = [
      { label: 'Income', value: income, kind: 'income' },
      { label: 'Fixed expenses', value: fixed, kind: 'fixed' },
      { label: 'Variable expenses', value: variable, kind: 'variable' },
      { label: 'Subscriptions', value: subs, kind: 'subs' },
      { label: 'Savings & goals', value: goals, kind: 'goals' },
      { label: left < 0 ? 'Short by' : 'Left over', value: left, kind: left < 0 ? 'short' : 'left' },
    ];
    els.rows.innerHTML = '';
    for (const r of rows) {
      const li = document.createElement('li');
      li.className = `overview-row overview-row--${r.kind}`;
      const share = income > 0 && r.kind !== 'income' ? Math.abs(r.value) / income : null;
      li.innerHTML = `
        <div class="overview-row-top">
          <span class="overview-label"></span>
          <span class="overview-value"></span>
        </div>
        <div class="overview-bar"><span></span></div>`;
      li.querySelector('.overview-label').textContent = r.label;
      li.querySelector('.overview-value').textContent =
        income > 0 || r.kind === 'income' ? `${r.value < 0 ? '−' : ''}${money(r.value * k, code)}` : '—';
      const bar = li.querySelector('.overview-bar');
      if (share == null) {
        bar.remove();
      } else {
        bar.firstElementChild.style.width = `${Math.min(share, 1) * 100}%`;
        const pct = document.createElement('span');
        pct.className = 'overview-pct';
        pct.textContent = `${Math.round(share * 100)}%`;
        li.querySelector('.overview-label').appendChild(pct);
      }
      els.rows.appendChild(li);
    }
  }

  // ---------------------------------------------------------------------------
  // Pinned money strip (phones): always monthly, same "left over" as the headline
  // ---------------------------------------------------------------------------

  function compact(n, code) {
    const meta = getCurrencyMeta(code);
    return (n < 0 ? '−' : '') + meta.symbol +
      Math.abs(n).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  }

  function syncStrip({ income, expenses, goals, left, code }) {
    const strip = $('moneyStrip');
    if (!strip) return;
    const has = income > 0;
    $('stripLabel').textContent = left < 0 ? 'Short this month' : 'Left over this month';
    $('stripRemaining').textContent = has ? `${left < 0 ? '−' : ''}${formatInCurrency(Math.abs(left), code)}` : '—';
    $('stripIncome').textContent = has ? compact(income, code) : '—';
    $('stripExpenses').textContent = has ? compact(expenses, code) : '—';
    $('stripGoals').textContent = has ? compact(goals, code) : '—';
    strip.dataset.state = !has ? '' : left < 0 ? 'over' : 'ok';
  }

  // ---------------------------------------------------------------------------
  // "Suggested" badge on Savings & goals until the split is changed
  // ---------------------------------------------------------------------------

  function splitsAreDefault() {
    if (typeof currentSplits === 'undefined' || !window.BudgetCore) return false;
    const defaults = window.BudgetCore.DEFAULT_SPLITS || [];
    if (currentSplits.length !== defaults.length) return false;
    return defaults.every((d, i) => {
      const c = currentSplits[i];
      return c && c.label === d.label && Number(c.percent) === Number(d.percent);
    });
  }

  function syncSuggested() {
    const isDefault = splitsAreDefault();
    const badge = $('splitSuggestedBadge');
    const hint = $('splitSuggestedHint');
    if (badge) badge.hidden = !isDefault;
    if (hint) hint.hidden = !isDefault;
    // The Goals step only counts as done once you've made the split your own.
    const chip = document.querySelector('.group-chip[data-group="goals"]');
    if (chip) chip.classList.toggle('is-done', !isDefault && Boolean(last && last.goals > 0));
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  document.addEventListener('budget:recompute', (e) => {
    last = e.detail;
    render();
    syncSuggested();
  });

  document.querySelectorAll('input[name="overviewPeriod"]').forEach((r) =>
    r.addEventListener('change', () => {
      try {
        localStorage.setItem(PERIOD_KEY, getPeriod());
      } catch (e) {
        /* per-viewer convenience only */
      }
      render();
    })
  );

  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    const radio = saved && document.querySelector(`input[name="overviewPeriod"][value="${saved}"]`);
    if (radio) radio.checked = true;
  } catch (e) {
    /* ignore */
  }

  // script.js already ran its first recompute before this file loaded.
  if (typeof recomputeAll === 'function') recomputeAll();
})();
