/**
 * Phone navigation: bottom tab bar, pinned "left this month" strip,
 * one-expense-type-at-a-time chips, and jump-to-new-row on "Add".
 *
 * Desktop keeps the full single page; the CSS only hides panels below 900px.
 * Reads figures from the Summary / table totals the main script already
 * renders, so there is one source of truth.
 */
(function () {
  'use strict';

  const TABS = ['income', 'expenses', 'spending', 'summary'];
  const TAB_KEY = 'budgetBuddyTab_v1';
  const GROUP_KEY = 'budgetBuddyExpenseGroup_v1';
  const mobile = window.matchMedia('(max-width: 900px)');

  const $ = (id) => document.getElementById(id);
  const panels = [...document.querySelectorAll('[data-panel]')];
  const tabBtns = [...document.querySelectorAll('.tab-btn[data-tab]')];
  const groups = [...document.querySelectorAll('.expense-group[data-group], .card-split[data-group]')];
  const STEPS = ['fixed', 'variable', 'subs', 'goals'];
  const NEXT_LABEL = {
    fixed: 'Next: Variable expenses',
    variable: 'Next: Subscriptions',
    subs: 'Next: Savings & goals',
    goals: 'See your summary',
  };
  const chips = [...document.querySelectorAll('.group-chip[data-group]')];
  const scrollByTab = {};
  let currentTab = null;

  function load(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* per-viewer convenience only */
    }
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  function showTab(tab, opts = {}) {
    if (!TABS.includes(tab)) tab = 'income';
    if (currentTab && mobile.matches) scrollByTab[currentTab] = window.scrollY;

    currentTab = tab;
    document.body.dataset.tab = tab;
    panels.forEach((p) => p.classList.toggle('panel-off', p.dataset.panel !== tab));
    tabBtns.forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    save(TAB_KEY, tab);
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);

    // Come back to where you were on that tab.
    if (mobile.matches && !opts.keepScroll) window.scrollTo(0, scrollByTab[tab] || 0);
    // Charts drawn while hidden have zero size; nudge them to re-measure.
    window.dispatchEvent(new Event('resize'));
  }

  tabBtns.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  window.addEventListener('hashchange', () => {
    const t = location.hash.slice(1);
    if (TABS.includes(t) && t !== currentTab) showTab(t);
  });

  // Scan from anywhere: jump to Spending, open the camera in the same tap.
  const scanBtn = $('tabScan');
  const fileInput = $('receiptFileInput');
  if (scanBtn && fileInput) {
    scanBtn.addEventListener('click', () => {
      showTab('spending');
      fileInput.click();
    });
  }

  // ---------------------------------------------------------------------------
  // Expense type chips (one list at a time on phones)
  // ---------------------------------------------------------------------------

  function showGroup(group) {
    if (!groups.some((g) => g.dataset.group === group)) group = 'fixed';
    groups.forEach((g) => g.classList.toggle('group-off', g.dataset.group !== group));
    chips.forEach((c) => {
      const on = c.dataset.group === group;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    save(GROUP_KEY, group);
  }

  chips.forEach((c) => c.addEventListener('click', () => showGroup(c.dataset.group)));

  /** Bring the step bar to the top, just under the pinned money strip. */
  function scrollToSteps() {
    const bar = document.querySelector('.group-switcher');
    const strip = $('moneyStrip');
    if (!bar) return;
    const offset = (strip ? strip.offsetHeight : 0) + 8;
    window.scrollTo({ top: bar.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------------------
  // "Next" buttons: a clear path Income → Fixed → Variable → Subs → Goals → Summary
  // ---------------------------------------------------------------------------

  function nextButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'next-step';
    btn.innerHTML = '<span></span><svg class="icon icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    btn.firstChild.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  groups.forEach((group) => {
    const step = group.dataset.group;
    const i = STEPS.indexOf(step);
    if (i < 0) return;
    const next = STEPS[i + 1];
    group.appendChild(
      nextButton(NEXT_LABEL[step], () => {
        if (next) {
          showGroup(next);
          scrollToSteps();
        } else {
          showTab('summary');
        }
      })
    );
  });

  const incomeCard = document.querySelector('.card-income');
  if (incomeCard) {
    incomeCard.appendChild(
      nextButton('Next: Expenses', () => {
        showGroup('fixed');
        showTab('expenses', { keepScroll: true });
        window.scrollTo(0, 0);
      })
    );
  }

  // ---------------------------------------------------------------------------
  // "+ Add" in each list header, and focus the new row wherever Add is pressed
  // ---------------------------------------------------------------------------

  function focusNewestRow(group) {
    const tbody = group.querySelector('tbody');
    const row = tbody && tbody.lastElementChild;
    if (!row) return;
    row.classList.add('row-new');
    setTimeout(() => row.classList.remove('row-new'), 1200);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = row.querySelector('input[type="text"], input:not([type])');
    if (input) input.focus({ preventScroll: true });
  }

  groups.forEach((group) => {
    const addBtn = $(group.dataset.add);
    const heading = group.querySelector('.subsection-heading');
    if (!addBtn || !heading) return;

    addBtn.addEventListener('click', () => requestAnimationFrame(() => focusNewestRow(group)));

    const head = document.createElement('div');
    head.className = 'group-head';
    heading.parentNode.insertBefore(head, heading);
    head.appendChild(heading);
    const quick = document.createElement('button');
    quick.type = 'button';
    quick.className = 'group-add';
    quick.innerHTML =
      '<svg class="icon icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#icon-plus"/></svg>Add';
    quick.setAttribute('aria-label', addBtn.textContent.trim());
    quick.addEventListener('click', () => addBtn.click());
    head.appendChild(quick);
  });

  // ---------------------------------------------------------------------------
  // Live figures: strip + chip totals mirror what the main script renders
  // ---------------------------------------------------------------------------

  // The strip itself is filled by overview.js (same figure as the Summary headline).
  const mirrors = [];
  const strip = $('moneyStrip');

  /** "₫24,150,000" → "₫24.2M" so four step totals fit across a phone. */
  function compactText(text) {
    const m = String(text).trim().match(/^(-?)(\D*?)([\d.,]+)$/);
    if (!m) return text.trim() || '—';
    const n = Number(m[3].replace(/,/g, ''));
    if (!Number.isFinite(n)) return text.trim();
    return m[1] + m[2] + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  }

  function syncFigures() {
    document.querySelectorAll('[data-total-from]').forEach((el) => {
      const src = $(el.dataset.totalFrom);
      el.textContent = src ? compactText(src.textContent) : '—';
      // A step is "done" once it has a non-zero total.
      const chip = el.closest('.group-chip');
      // Goals is handled in overview.js: suggested defaults don't count as done.
      if (chip && chip.dataset.group !== 'goals') chip.classList.toggle('is-done', /[1-9]/.test(el.textContent));
    });
  }

  const watched = new Set([
    ...mirrors.map(([from]) => from),
    ...[...document.querySelectorAll('[data-total-from]')].map((el) => el.dataset.totalFrom),
  ]);
  const observer = new MutationObserver(syncFigures);
  watched.forEach((id) => {
    const el = $(id);
    if (el) observer.observe(el, { childList: true, characterData: true, subtree: true });
  });

  if (strip) {
    const goSummary = () => showTab('summary');
    strip.addEventListener('click', goSummary);
    strip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goSummary();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Hide the tab bar while typing so the keyboard has room
  // ---------------------------------------------------------------------------

  const isField = (el) => el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(radio|checkbox|file|button|submit)$/.test(el.type);
  document.addEventListener('focusin', (e) => {
    if (isField(e.target)) document.body.classList.add('is-typing');
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!isField(document.activeElement)) document.body.classList.remove('is-typing');
    }, 50);
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  const fromHash = location.hash.slice(1);
  showTab(TABS.includes(fromHash) ? fromHash : load(TAB_KEY, 'income'), { keepScroll: true });
  showGroup(load(GROUP_KEY, 'fixed'));
  syncFigures();
})();
