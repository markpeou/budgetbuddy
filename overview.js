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
    const m = d.model;
    const p = PERIODS[getPeriod()];
    const k = p.factor;
    const code = d.incomeCode;
    const n = (x) => (Number.isFinite(x) ? x : 0);

    // One definition everywhere: money left over = money in − money out.
    // The savings & goals split is a plan, shown alongside, never taken off.
    const income = n(m ? m.moneyIn.total : d.income);
    const fixed = n(m ? m.moneyOut.fixed : d.fixed);
    const variable = n(m ? m.moneyOut.variable : d.variable);
    const subs = n(m ? m.moneyOut.subs : d.subs);
    const expenses = fixed + variable + subs;
    const planned = n(m ? m.planned.total : d.goals);
    const left = income - expenses;
    const ok = m ? m.ok : d.expensesOk;
    const hasIncome = m ? m.complete.income && income > 0 : income > 0;

    let state = '';
    let main;
    let sub = '';
    if (!hasIncome) {
      main = 'Add the money you have coming in to see your summary.';
    } else if (!ok) {
      const which = m && m.missingRates.length ? m.missingRates.join(', ') : 'another currency';
      main = 'Waiting for exchange rates…';
      sub = `Some amounts are in ${which}.`;
    } else if (left < 0) {
      state = 'bad';
      main = `Your costs are ${money(left * k, code)} more than your money coming in ${p.each}.`;
    } else {
      state = 'good';
      main = `${money(left * k, code)} left over ${p.each}.`;
      sub = `${money(income * k, code)} coming in, ${money(expenses * k, code)} going out.`;
    }
    els.headline.dataset.state = state;
    syncStrip({ income, expenses, goals: planned, left, code, has: hasIncome && ok });
    els.main.textContent = main;
    els.sub.textContent = sub;
    els.sub.hidden = !sub;

    const rows = [
      { label: 'Money coming in', value: income, kind: 'income' },
      { label: 'Fixed costs', value: fixed, kind: 'fixed' },
      { label: 'Variable costs', value: variable, kind: 'variable' },
      { label: 'Subscriptions', value: subs, kind: 'subs' },
      { label: left < 0 ? 'Short by' : 'Money left over', value: left, kind: left < 0 ? 'short' : 'left' },
      { label: 'Planned for savings & goals', value: planned, kind: 'goals' },
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
        (hasIncome && ok) || r.kind === 'income' ? `${r.value < 0 ? '−' : ''}${money(r.value * k, code)}` : '—';
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
    renderMeaning({ m, ok, hasIncome, income, expenses, planned, left, k, p, code });
  }

  // ---------------------------------------------------------------------------
  // What this means, and one next step (same shape as every calculator)
  // ---------------------------------------------------------------------------

  function renderMeaning({ m, ok, hasIncome, income, expenses, planned, left, k, p, code }) {
    const wrap = $('overviewMeaning');
    const list = $('overviewMeaningList');
    const next = $('overviewNext');
    if (!wrap || !list || !next) return;
    const lines = [];
    const show = hasIncome && ok && m;
    if (show) {
      if (left >= 0 && planned > 0) {
        lines.push(planned <= left + 0.5
          ? `Your savings & goals plan (${money(planned * k, code)} ${p.each}) fits within what’s left over.`
          : `Your savings & goals plan is ${money((planned - left) * k, code)} ${p.each} more than what’s left over.`);
      }
      const ess = m.moneyOut.essential;
      if (income > 0 && ess > 0) lines.push(`${Math.round((ess / income) * 100)}% of your money coming in goes on costs you must pay.`);
      if (m.moneyIn.notRegular > 0) lines.push(`${money(m.moneyIn.notRegular * k, code)} ${p.each} of it isn’t regular, so this is an estimate.`);
      if (m.moneyOut.spread > 0) lines.push(`Includes ${money(m.moneyOut.spread * k, code)} ${p.each} set aside for bills you pay less often.`);
    }
    list.innerHTML = '';
    lines.slice(0, 3).forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      list.appendChild(li);
    });
    wrap.hidden = !lines.length;
    // Next step: a safety net first, then where the money goes.
    next.hidden = !show;
    if (show) {
      const hasNet = m.savings.accessible > 0 && expenses > 0 && m.savings.accessible >= m.moneyOut.essential * 3;
      const step = left < 0
        ? { href: '#tool/understand', text: 'See where your money goes' }
        : hasNet
          ? { href: '#tool/goal', text: 'How long will it take me to save for something?' }
          : { href: '#tool/emergency', text: 'How much should I keep for emergencies?' };
      next.href = step.href;
      $('overviewNextText').textContent = step.text;
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

  function syncStrip({ income, expenses, goals, left, code, has }) {
    const strip = $('moneyStrip');
    if (!strip) return;
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
