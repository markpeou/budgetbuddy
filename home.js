/**
 * Site views around the calculator: Home, Financial journeys, Calculators,
 * About and "Coming soon" pages, all on one page via the URL hash.
 *
 *   #home (or no hash) · #journeys · #calculators · #about
 *   #soon/<tool>   placeholder for a calculator that doesn't exist yet
 *   #go/<id>       open the existing calculator at the right step, with guidance
 *   #income …      the calculator tabs themselves (handled by nav.js)
 *
 * Every journey, calculator and question routes into the same calculator and
 * data — nothing here does maths of its own.
 */
(function () {
  'use strict';

  const SITE_VIEWS = ['home', 'journeys', 'calculators', 'about', 'soon'];
  const APP_TABS = ['income', 'expenses', 'spending', 'summary'];
  const mobile = window.matchMedia('(max-width: 900px)');
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Tools: what exists today, and what's planned
  // ---------------------------------------------------------------------------

  const TOOLS = {
    income: {
      name: 'Income & expenses',
      answer: 'What comes in and what goes out each month, in any currency.',
      go: 'income',
    },
    savings: {
      name: 'Monthly savings capacity',
      answer: 'What’s genuinely left after your costs, per day, week, month or year.',
      go: 'savings',
    },
    goals: {
      name: 'Savings goals',
      answer: 'Split your income between savings, an emergency fund and investing.',
      go: 'goals',
    },
    breakdown: {
      name: 'Spending breakdown',
      answer: 'Which of your regular costs take the biggest share.',
      go: 'breakdown',
    },
    emergency: {
      name: 'Emergency fund',
      answer: 'How big a safety buffer to aim for, based on your essential costs.',
      soon: true,
    },
    runway: {
      name: 'Financial runway',
      answer: 'How many months your savings would last if your income stopped or dropped.',
      soon: true,
    },
  };

  // Placeholder pages for tools that aren't built yet: say what's coming and
  // point to the closest thing that works today.
  const SOON = {
    emergency: {
      title: 'Emergency fund calculator',
      what: 'Will work out how big a safety buffer to aim for from your essential monthly costs, and how long it would take to build at the rate you’re saving.',
      today: 'Add up your fixed costs. That monthly total is what an emergency fund needs to cover, and you can already set how much goes into one each month.',
      link: { go: 'goals', label: 'Set your emergency fund contribution' },
    },
    runway: {
      title: 'Financial runway calculator',
      what: 'Will show how many months your savings would last if your income stopped or dropped: for time off, a career break or losing your job.',
      today: 'Start with what a month costs you. Your total monthly expenses are what each month of runway needs to cover.',
      link: { go: 'living', label: 'Work out your monthly costs' },
    },
  };

  // Deep links into the existing calculator, with the guidance shown on arrival.
  const GO = {
    income: { tab: 'income', q: 'Income & expenses', guide: 'Enter your income, then add your expenses step by step.' },
    savings: { tab: 'summary', q: 'Monthly savings capacity', guide: 'This is what’s left each month. Fill in Income and Expenses first if it’s empty.' },
    goals: { tab: 'expenses', group: 'goals', q: 'Savings goals', guide: 'Set what share of your income goes to each goal. The starting split is only a suggestion.' },
    breakdown: { tab: 'summary', scroll: '.chart-panel', q: 'Spending breakdown', guide: 'Your costs by type. Add expenses to fill it in.' },
    'where-money-goes': {
      tab: 'expenses', group: 'fixed', q: 'Where does my money go each month?',
      guide: 'Add your regular costs one step at a time. Summary then shows which ones take the biggest share.',
    },
    'realistic-saving': {
      tab: 'income', q: 'How much can I realistically save?',
      guide: 'Enter your income, then your expenses. Summary shows what’s genuinely left each month.',
    },
    'big-picture': {
      tab: 'summary', q: 'What does my financial situation look like?',
      guide: 'Income, costs, savings and what’s left, in one place. Fill in Income and Expenses if it’s empty.',
    },
    'savings-goal': {
      tab: 'expenses', group: 'goals', q: 'How can I reach my savings goal?',
      guide: 'Decide how much goes toward each goal every month. Working out how long a target takes is coming later.',
    },
    'income-drop': {
      tab: 'income', q: 'What happens if my income decreases?',
      guide: 'Save your current plan as a scenario first. Then lower your income and watch what’s left change.',
    },
    'career-change': {
      tab: 'income', q: 'Could I afford to change careers?',
      guide: 'Enter the salary you’d expect in the new role. Your costs stay the same, so you can see if it still adds up. Save each version as a scenario to compare.',
    },
    living: {
      tab: 'expenses', group: 'fixed', q: 'How much does it really cost to live each month?',
      guide: 'Add every regular cost: fixed, variable and subscriptions. The total is your true monthly cost of living.',
    },
    'year-saving': {
      tab: 'summary', period: 'year', q: 'How much can I save over the next year?',
      guide: 'Showing a full year. Fill in Income and Expenses first if it’s empty.',
    },
    'work-less': {
      tab: 'income', q: 'Could I afford to work less?',
      guide: 'Lower your income to what you’d earn working less, and see whether your costs are still covered.',
    },
    'income-needed': {
      tab: 'expenses', group: 'fixed', q: 'How much income do I need to cover my expenses?',
      guide: 'Add your costs. Your total expenses in Summary is the income you need to cover them.',
    },
  };

  // Journeys: question-led, in plain language. `go` opens a working tool,
  // `soon` opens its placeholder page.
  const JOURNEYS = [
    {
      title: 'Understand my money',
      desc: 'Get a clear picture of what comes in, what goes out and what’s left.',
      items: [
        { q: 'Where does my money go each month?', d: 'List your regular costs and see which ones take the biggest share.', go: 'where-money-goes', tool: 'breakdown' },
        { q: 'How much can I realistically save?', d: 'Take what you earn, subtract what you spend, and see what’s genuinely left.', go: 'realistic-saving', tool: 'savings' },
        { q: 'What does my financial situation look like?', d: 'One calm overview of income, costs, savings and what’s left over.', go: 'big-picture', tool: 'savings' },
      ],
    },
    {
      title: 'Build my financial safety net',
      desc: 'Work out what a buffer looks like for you, and how to get there.',
      items: [
        { q: 'How much should I have in an emergency fund?', d: 'Find a buffer size that matches your essential costs.', soon: 'emergency' },
        { q: 'How long could I manage without an income?', d: 'See how many months your savings would cover.', soon: 'runway' },
        { q: 'How can I reach my savings goal?', d: 'Decide how much of your income goes toward each goal every month.', go: 'savings-goal', tool: 'goals' },
      ],
    },
    {
      title: 'Plan a big life change',
      desc: 'Test a change before you make it.',
      items: [
        { q: 'Could I afford to take six months off?', d: 'See whether your savings would cover six months of costs.', soon: 'runway' },
        { q: 'What happens if my income decreases?', d: 'Compare today’s plan with a lower income, side by side.', go: 'income-drop', tool: 'income' },
        { q: 'Could I afford to change careers?', d: 'Try a new salary against your current costs.', go: 'career-change', tool: 'income' },
        { q: 'What would happen if I lost my job?', d: 'Find out how long you could cover your costs.', soon: 'runway' },
      ],
    },
  ];

  const QUESTIONS = [
    { q: 'How much does it really cost to live each month?', go: 'living' },
    { q: 'How much should I save before leaving my job?', soon: 'runway' },
    { q: 'How much can I save over the next year?', go: 'year-saving' },
    { q: 'How much do I need in an emergency fund?', soon: 'emergency' },
    { q: 'Could I afford to work less?', go: 'work-less' },
    { q: 'How much income do I need to cover my expenses?', go: 'income-needed' },
  ];

  const hrefFor = (item) => (item.soon ? `#soon/${item.soon}` : `#go/${item.go}`);

  // ---------------------------------------------------------------------------
  // Rendering (static content; built once)
  // ---------------------------------------------------------------------------

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function soonPill() {
    return el('span', 'status-pill', 'Coming soon');
  }

  function renderQuestions() {
    const list = $('questionList');
    if (!list) return;
    QUESTIONS.forEach((item) => {
      const li = el('li');
      const a = el('a', 'question-link');
      a.href = hrefFor(item);
      a.appendChild(el('span', 'question-text', item.q));
      if (item.soon) a.appendChild(soonPill());
      else a.appendChild(el('span', 'question-arrow', '→')).setAttribute('aria-hidden', 'true');
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
        const a = el('a', 'journey-card' + (item.soon ? ' is-soon' : ''));
        a.href = hrefFor(item);
        a.appendChild(el('h3', 'journey-q', item.q));
        a.appendChild(el('p', 'journey-d', item.d));
        const meta = el('span', 'journey-meta');
        if (item.soon) meta.appendChild(soonPill());
        else meta.textContent = `Uses ${TOOLS[item.tool].name} →`;
        a.appendChild(meta);
        li.appendChild(a);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    });
  }

  function renderTools() {
    const list = $('toolList');
    if (!list) return;
    Object.entries(TOOLS).forEach(([id, tool]) => {
      const li = el('li');
      const a = el('a', 'tool-card' + (tool.soon ? ' is-soon' : ''));
      a.href = tool.soon ? `#soon/${id}` : `#go/${tool.go}`;
      a.appendChild(el('h2', 'tool-name', tool.name));
      a.appendChild(el('p', 'tool-answer', tool.answer));
      if (tool.soon) a.appendChild(soonPill());
      else a.appendChild(el('span', 'tool-open', 'Open →'));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderSoon(id) {
    const s = SOON[id];
    if (!s) return false;
    $('soonTitle').textContent = s.title;
    $('soonWhat').textContent = s.what;
    $('soonToday').textContent = s.today;
    const link = $('soonTodayLink');
    link.href = `#go/${s.link.go}`;
    link.textContent = `${s.link.label} →`;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  function setNavCurrent(view) {
    const key = view === 'app' ? 'calculators' : view === 'soon' ? 'journeys' : view;
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
    showBanner(g.q, g.guide);
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

  function showBanner(q, guide) {
    const b = $('journeyBanner');
    if (!b) return;
    $('journeyBannerQ').textContent = q;
    $('journeyBannerGuide').textContent = guide;
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
    if (view === 'soon') {
      if (renderSoon(arg)) return showSiteView('soon');
      return showSiteView('journeys');
    }
    showSiteView(SITE_VIEWS.includes(view) && view !== 'soon' ? view : 'home');
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
  window.BudgetHome = { TOOLS, GO, JOURNEYS, QUESTIONS, SOON };
})();
