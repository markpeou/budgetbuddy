/**
 * Site views around the budget planner: Home, Financial journeys, Calculators,
 * About and the journey calculators, all on one page via the URL hash.
 *
 *   #home (or no hash) · #journeys · #calculators · #about
 *   #tool/<id>[/<preset>]   a journey calculator (journeys.js)
 *   #go/income     the budget planner, with guidance
 *   #soon/<tool>   old placeholder links; redirect to the real calculator
 *   #income …      the calculator tabs themselves (handled by nav.js)
 *
 * Every journey, calculator and question opens a calculator that shares the
 * planner's figures; the maths lives in journey-core.js, not here.
 */
(function () {
  'use strict';

  const SITE_VIEWS = ['home', 'journeys', 'calculators', 'about', 'tool'];
  const APP_TABS = ['income', 'expenses', 'spending', 'summary'];
  const mobile = window.matchMedia('(max-width: 900px)');
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Content: every journey, question and calculator opens a real calculator
  // (journeys.js) at #tool/<id>[/<preset>]. The budget planner is #go/income.
  // ---------------------------------------------------------------------------

  const CALCULATORS = [
    { to: 'go/income', name: 'Budget planner', answer: 'Income, costs and your savings split, in any currency. The figures every other calculator can use.' },
    { to: 'tool/breakdown', name: 'Spending breakdown', answer: 'Which costs take the biggest share, and how much is flexible.' },
    { to: 'tool/capacity', name: 'Savings capacity', answer: 'What’s genuinely left to save each month and each year.' },
    { to: 'tool/snapshot', name: 'Money snapshot', answer: 'Savings rate, fixed costs, biggest cost and runway at a glance.' },
    { to: 'tool/emergency', name: 'Emergency fund', answer: 'A target for 3, 6 or 12 months of essentials, and when you’ll get there.' },
    { to: 'tool/runway', name: 'Financial runway', answer: 'How many months your savings would last without an income.' },
    { to: 'tool/goal', name: 'Savings goal', answer: 'When you’ll reach a target, or what it takes to hit a deadline.' },
    { to: 'tool/income', name: 'Income change', answer: 'What’s left each month if your income goes down, or you switch careers.' },
  ];

  // Opening the budget planner directly, with guidance.
  const GO = {
    income: { tab: 'income', q: 'Budget planner', guide: 'Enter your income, then add your costs step by step. Summary shows what’s left.' },
  };

  const JOURNEYS = [
    {
      title: 'Understand my money',
      desc: 'Get a clear picture of what comes in, what goes out and what’s left.',
      items: [
        { q: 'Where does my money go each month?', d: 'See your costs ranked, and which ones you can actually change.', to: 'tool/breakdown' },
        { q: 'How much can I realistically save?', d: 'What’s genuinely left after every cost, per month and per year.', to: 'tool/capacity' },
        { q: 'What does my financial situation look like?', d: 'Four plain readings: savings rate, fixed costs, biggest cost and runway.', to: 'tool/snapshot' },
      ],
    },
    {
      title: 'Build my financial safety net',
      desc: 'Work out what a buffer looks like for you, and how to get there.',
      items: [
        { q: 'How much should I have in an emergency fund?', d: 'A target from your essential costs, and when you’ll reach it.', to: 'tool/emergency' },
        { q: 'How long could I manage without an income?', d: 'How many months your savings would cover, and with essentials only.', to: 'tool/runway' },
        { q: 'How can I reach my savings goal?', d: 'When you’ll get there, or what to save each month to hit a date.', to: 'tool/goal' },
      ],
    },
    {
      title: 'Plan a big life change',
      desc: 'Test a change before you make it.',
      items: [
        { q: 'Could I afford to take six months off?', d: 'Yes or no, and how much you’d have left or need to save.', to: 'tool/runway/timeoff' },
        { q: 'What happens if my income decreases?', d: 'What’s left each month on a lower income, and for how long savings cover a gap.', to: 'tool/income' },
        { q: 'Could I afford to change careers?', d: 'The cost of the switch, and when a new salary puts you ahead.', to: 'tool/income/career' },
        { q: 'What would happen if I lost my job?', d: 'How long your savings and any payout would last.', to: 'tool/runway/jobloss' },
      ],
    },
  ];

  const QUESTIONS = [
    { q: 'How much does it really cost to live each month?', to: 'tool/breakdown/living' },
    { q: 'How much should I save before leaving my job?', to: 'tool/runway/leave' },
    { q: 'How much can I save over the next year?', to: 'tool/capacity/year' },
    { q: 'How much do I need in an emergency fund?', to: 'tool/emergency' },
    { q: 'Could I afford to work less?', to: 'tool/income/less' },
    { q: 'How much income do I need to cover my expenses?', to: 'tool/capacity/needed' },
  ];

  /** Name of the calculator a link opens, for "Uses …" labels. */
  function toolName(to) {
    const id = to.split('/')[1];
    const t = window.BudgetTools && window.BudgetTools.TOOLS[id];
    return t ? t.name : 'Budget planner';
  }

  const hrefFor = (item) => `#${item.to}`;

  // ---------------------------------------------------------------------------
  // Rendering (static content; built once)
  // ---------------------------------------------------------------------------

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderQuestions() {
    const list = $('questionList');
    if (!list) return;
    QUESTIONS.forEach((item) => {
      const li = el('li');
      const a = el('a', 'question-link');
      a.href = hrefFor(item);
      a.appendChild(el('span', 'question-text', item.q));
      a.appendChild(el('span', 'question-arrow', '→')).setAttribute('aria-hidden', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderJourneys() {
    const root = $('journeyGroups');
    if (!root) return;
    JOURNEYS.forEach((group, gi) => {
      const sec = el('section', 'journey-group');
      const h = el('h2', 'journey-group-title', group.title);
      h.id = `journeyGroup${gi}`;
      sec.setAttribute('aria-labelledby', h.id);
      sec.appendChild(h);
      sec.appendChild(el('p', 'journey-group-desc', group.desc));
      const ul = el('ul', 'journey-list');
      group.items.forEach((item) => {
        const li = el('li');
        const a = el('a', 'journey-card');
        a.href = hrefFor(item);
        a.appendChild(el('h3', 'journey-q', item.q));
        a.appendChild(el('p', 'journey-d', item.d));
        const meta = el('span', 'journey-meta');
        meta.textContent = `Uses ${toolName(item.to)} →`;
        a.appendChild(meta);
        li.appendChild(a);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    });
  }

  function renderTools() {
    const list = $('calcList');
    if (!list) return;
    CALCULATORS.forEach((tool) => {
      const li = el('li');
      const a = el('a', 'tool-card' + (tool.to === 'go/income' ? ' tool-card--planner' : ''));
      a.href = `#${tool.to}`;
      a.appendChild(el('h2', 'tool-name', tool.name));
      a.appendChild(el('p', 'tool-desc', tool.answer));
      a.appendChild(el('span', 'tool-open', 'Open →'));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  function setNavCurrent(view) {
    const key = view === 'app' || view === 'tool' ? 'calculators' : view;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function showSiteView(view) {
    document.body.dataset.view = view;
    document.querySelectorAll('.site-view').forEach((v) => {
      v.hidden = v.dataset.view !== view;
    });
    hideBanner();
    setNavCurrent(view);
    closeMenu();
    window.scrollTo(0, 0);
    // Move focus to the page heading so keyboard and screen-reader users land there.
    const page = $(`view-${view}`);
    const heading = page && page.querySelector('h1');
    if (heading && document.activeElement && document.activeElement !== document.body) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function openGo(id) {
    const g = GO[id];
    if (!g) return showSiteView('calculators');
    if (g.group && window.showBudgetGroup) window.showBudgetGroup(g.group);
    if (g.period) {
      const radio = document.querySelector(`input[name="overviewPeriod"][value="${g.period}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (window.showBudgetTab) window.showBudgetTab(g.tab);
    let ret = null;
    try {
      ret = JSON.parse(sessionStorage.getItem('budgetBuddyReturn') || 'null');
    } catch (e) {
      /* ignore */
    }
    if (ret && ret.hash) showBanner(ret.q, 'Update your income and costs here, then go back to see your answer.', ret.hash);
    else showBanner(g.q, g.guide);
    requestAnimationFrame(() => scrollToTarget(g));
  }

  /** Land on the right part of the calculator (desktop shows every section at once). */
  function scrollToTarget(g) {
    let target = null;
    if (g.scroll) target = document.querySelector(g.scroll);
    else if (!mobile.matches && g.group) target = document.querySelector(`.expense-group[data-group="${g.group}"], .card-split[data-group="${g.group}"]`);
    else if (!mobile.matches) target = document.querySelector(`.app > [data-panel="${g.tab}"]:not(.card-scenarios)`);
    if (!target) return window.scrollTo(0, 0);
    const strip = $('moneyStrip');
    const banner = $('journeyBanner');
    // Leave room for what's pinned: the money strip on phones, the guidance banner on desktop.
    const pinned = mobile.matches
      ? (strip ? strip.offsetHeight : 0)
      : (banner && !banner.hidden ? banner.offsetHeight + 12 : 0);
    const top = target.getBoundingClientRect().top + window.scrollY - pinned - 16;
    window.scrollTo(0, Math.max(0, top));
  }

  function showBanner(q, guide, returnHash) {
    const b = $('journeyBanner');
    if (!b) return;
    $('journeyBannerQ').textContent = q;
    $('journeyBannerGuide').textContent = guide;
    const ret = $('journeyBannerReturn');
    ret.hidden = !returnHash;
    if (returnHash) ret.href = returnHash;
    $('journeyBannerAll').hidden = Boolean(returnHash);
    b.hidden = false;
  }

  function hideBanner() {
    const b = $('journeyBanner');
    if (b) b.hidden = true;
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (APP_TABS.includes(hash)) return setNavCurrent('app'); // nav.js shows the tab
    const [view, arg] = hash.split('/');
    if (view === 'go') return openGo(arg);
    // Old placeholder links now open the real calculators.
    if (view === 'soon') return location.replace(`#tool/${arg === 'emergency' ? 'emergency' : 'runway'}`);
    if (view === 'tool') {
      try {
        sessionStorage.removeItem('budgetBuddyReturn');
      } catch (e) {
        /* ignore */
      }
      const preset = hash.split('/')[2];
      if (window.BudgetTools && window.BudgetTools.show(arg, preset)) return showSiteView('tool');
      return showSiteView('calculators');
    }
    if (view !== 'go') {
      try {
        sessionStorage.removeItem('budgetBuddyReturn');
      } catch (e) {
        /* ignore */
      }
    }
    showSiteView(SITE_VIEWS.includes(view) && view !== 'tool' ? view : 'home');
  }

  // ---------------------------------------------------------------------------
  // Phone menu
  // ---------------------------------------------------------------------------

  const menuBtn = $('siteMenuBtn');
  const nav = $('siteNav');

  function closeMenu() {
    if (!menuBtn) return;
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      if (open) {
        const first = nav.querySelector('a');
        if (first) first.focus();
      }
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('menu-open') && !e.target.closest('.site-header')) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
        closeMenu();
        menuBtn.focus();
      }
    });
  }

  // Same link clicked again (e.g. #go/living twice) doesn't fire hashchange.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === location.hash) {
      e.preventDefault();
      route();
    }
  });

  // ---------------------------------------------------------------------------
  // Returning visitors: one tap back into their budget
  // ---------------------------------------------------------------------------

  function renderWelcomeBack(d) {
    const card = $('welcomeBack');
    if (!card || !d) return;
    let saved = false;
    try {
      saved = Boolean(localStorage.getItem('budgetBuddyDraft_v1') || JSON.parse(localStorage.getItem('budgetPlannerScenarios_v1') || '{}').scenarios?.length);
    } catch (e) {
      /* ignore */
    }
    const income = d.income || 0;
    if (!saved || income <= 0 || typeof formatInCurrency !== 'function') {
      card.hidden = true;
      return;
    }
    const left = income - (d.fixed || 0) - (d.variable || 0) - (d.subs || 0) - (d.goals || 0);
    const sel = $('scenarioLoadSelect');
    const name = sel && sel.value && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : 'Your budget';
    $('welcomeBackName').textContent = name;
    $('welcomeBackFigure').textContent = d.expensesOk === false
      ? ''
      : left >= 0
        ? `${formatInCurrency(left, d.incomeCode)} left over a month`
        : `${formatInCurrency(-left, d.incomeCode)} short a month`;
    card.hidden = false;
  }
  document.addEventListener('budget:recompute', (e) => renderWelcomeBack(e.detail));

  const close = $('journeyBannerClose');
  if (close) close.addEventListener('click', hideBanner);
  document.addEventListener('budget:view', () => setNavCurrent('app'));

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  renderQuestions();
  renderJourneys();
  renderTools();
  window.addEventListener('hashchange', route);
  route();

  // Exposed for tests.
  window.BudgetHome = { CALCULATORS, GO, JOURNEYS, QUESTIONS };
})();
