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
    { to: 'go/income', name: 'Budget planner', icon: 'wallet', answer: 'Money in, money out and savings, in any currency. Feeds every calculator.' },
    { to: 'tool/understand', name: 'Understand my money', icon: 'chart-pie', answer: 'Where it goes, and how much is left over.' },
    { to: 'tool/emergency', name: 'Emergency fund', icon: 'life-buoy', answer: 'How much to keep for emergencies.' },
    { to: 'tool/goal', name: 'Savings goal', icon: 'target', answer: 'How long it takes, or how much to save.' },
    { to: 'tool/runway', name: 'How long your savings will last', icon: 'hourglass', answer: 'If your money coming in stopped.' },
    { to: 'tool/income', name: 'Change in income', icon: 'trending-down', answer: 'What happens if you earn more or less.' },
    { to: 'tool/invest', name: 'Investment growth', icon: 'trending-up', answer: 'What your money could grow to over time.' },
    { to: 'tool/debt', name: 'Pay off debt', icon: 'credit-card', answer: 'When you’ll be debt-free, and the interest.' },
    { to: 'tool/loan', name: 'Home loan extra repayments', icon: 'home', answer: 'Time and interest saved by paying extra.' },
    { to: 'tool/move', name: 'Moving somewhere new', icon: 'plane', answer: 'Costs there vs here, in any currency.' },
    { to: 'tool/compare', name: 'Compare scenarios', icon: 'columns', answer: 'Two saved budgets, side by side.' },
  ];

  // Opening the budget planner directly, with guidance.
  const GO = {
    income: { tab: 'income', q: 'Budget planner', guide: 'Add your income, then your costs.' },
  };

  const JOURNEYS = [
    {
      title: 'Understand my money',
      icon: 'compass',
      desc: 'What comes in, goes out and is left.',
      items: [
        { q: 'Where does my money go each month?', d: 'Money in, money out, and what’s left.', to: 'tool/understand' },
        { q: 'How much can I realistically save?', d: 'What’s left after every cost, each month and year.', to: 'tool/understand/year' },
        { q: 'What does my financial situation look like?', d: 'The full picture in one place.', to: 'tool/understand/snapshot' },
      ],
    },
    {
      title: 'Build my financial safety net',
      icon: 'shield',
      desc: 'A buffer that fits your life.',
      items: [
        { q: 'How much money should I keep for emergencies?', d: 'A target, and when you’ll reach it.', to: 'tool/emergency' },
        { q: 'How long could I manage without an income?', d: 'How many months your savings cover.', to: 'tool/runway' },
        { q: 'How long will it take me to save for something?', d: 'Or how much to save by a date.', to: 'tool/goal' },
      ],
    },
    {
      title: 'Plan a big life change',
      icon: 'route',
      desc: 'Test a change before you make it.',
      items: [
        { q: 'Could I afford to take six months off?', d: 'Yes or no, and by how much.', to: 'tool/runway/timeoff' },
        { q: 'What happens if my income decreases?', d: 'What’s left on a lower income.', to: 'tool/income' },
        { q: 'Could I afford to change careers?', d: 'The cost, and when you’d be ahead.', to: 'tool/income/career' },
        { q: 'What would happen if I lost my job?', d: 'How long your savings would last.', to: 'tool/runway/jobloss' },
        { q: 'Could I afford to move somewhere new?', d: 'Costs there vs here, up front and each month.', to: 'tool/move' },
        { q: 'How do two of my budgets compare?', d: 'Saved scenarios, side by side.', to: 'tool/compare' },
      ],
    },
    {
      title: 'See where I could be',
      icon: 'sprout',
      desc: 'Projections from your numbers.',
      items: [
        { q: 'How long will it take to save for a trip?', d: 'On your current budget.', to: 'tool/goal/trip' },
        { q: 'How much should I save each month for a home deposit?', d: 'The amount to reach it by a date.', to: 'tool/goal/deposit' },
        { q: 'How much could my investment grow?', d: 'Year by year, at the return you choose.', to: 'tool/invest' },
        { q: 'How long will it take to pay off my debt?', d: 'The date, and the interest you’d pay.', to: 'tool/debt' },
        { q: 'How much could I save by paying extra on my home loan?', d: 'Time and interest saved.', to: 'tool/loan' },
      ],
    },
  ];

  const QUESTIONS = [
    { q: 'How much does it really cost to live each month?', to: 'tool/understand/living' },
    { q: 'How much should I save before leaving my job?', to: 'tool/runway/leave' },
    { q: 'How long will it take to pay off my debt?', to: 'tool/debt' },
    { q: 'If I invest monthly, how much could I have in 10 years?', to: 'tool/invest' },
    { q: 'Could I afford to work less?', to: 'tool/income/less' },
    { q: 'How much do I need to earn to cover my costs?', to: 'tool/understand/needed' },
  ];

  /** Icon (from the sprite) inside a span, decorative. */
  function iconEl(name, cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = typeof icon === 'function' ? icon(name || 'compass', { size: 18 }) : '';
    return span;
  }

  function toolIcon(to) {
    const id = to.split('/')[1];
    const t = window.BudgetTools && window.BudgetTools.TOOLS[id];
    return t ? t.icon : 'wallet';
  }

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
      a.appendChild(iconEl(toolIcon(item.to), 'question-icon'));
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
      const h = el('h2', 'journey-group-title');
      h.appendChild(iconEl(group.icon, 'icon-chip icon-chip--purple'));
      h.appendChild(document.createTextNode(group.title));
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
        meta.appendChild(iconEl(toolIcon(item.to), 'journey-meta-icon'));
        meta.appendChild(document.createTextNode(`${toolName(item.to)} →`));
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
      a.appendChild(iconEl(tool.icon, 'icon-chip icon-chip--purple'));
      a.appendChild(el('h2', 'tool-name', tool.name));
      a.appendChild(el('p', 'tool-desc', tool.answer));
      a.appendChild(el('span', 'tool-arrow', '→')).setAttribute('aria-hidden', 'true');
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
    if (ret && ret.hash) showBanner(ret.q, 'Update your budget, then go back to your answer.', ret.hash);
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
    // Same definition as the Summary: money in − money out.
    const left = d.model && d.model.leftOver != null ? d.model.leftOver : income - (d.fixed || 0) - (d.variable || 0) - (d.subs || 0);
    const sel = $('scenarioLoadSelect');
    const name = sel && sel.value && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : 'Your budget';
    $('welcomeBackName').textContent = name;
    $('welcomeBackFigure').textContent = d.expensesOk === false || (d.model && !d.model.ok)
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
