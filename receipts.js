/**
 * Receipt capture + actual-spend analysis.
 *
 * Privacy contract: the receipt image only ever lives in memory (a File, an
 * ImageBitmap and a canvas) for the length of one read. It is never written to
 * localStorage, IndexedDB or the DOM after reading, and the file input is reset.
 * Only the extracted data points are saved.
 *
 * Depends on globals from script.js (classic scripts share one global scope):
 *   SUPPORTED_CURRENCIES, getReportingCurrency, convert, formatInCurrency, getCurrencyMeta
 * and window.ReceiptCore from receipt-core.js.
 */
(function () {
  'use strict';

  const RC = window.ReceiptCore;
  if (!RC) return;

  const STORE_KEY = 'budgetBuddyReceipts_v1';
  const LEARNED_KEY = 'budgetBuddyMerchantCategories_v1';
  const ENGINE_KEY = 'budgetBuddyReceiptEngine_v1';
  const API_KEY_KEY = 'budgetBuddyAnthropicKey_v1';

  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const CLAUDE_MODEL = 'claude-haiku-5-5';

  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $('receiptFileInput'),
    manualBtn: $('receiptManualBtn'),
    status: $('receiptStatus'),
    keyRow: $('receiptKeyRow'),
    apiKey: $('receiptApiKey'),
    review: $('receiptReview'),
    reviewTitle: $('receiptReviewTitle'),
    merchant: $('rvMerchant'),
    amount: $('rvAmount'),
    currency: $('rvCurrency'),
    date: $('rvDate'),
    category: $('rvCategory'),
    discard: $('rvDiscard'),
    period: $('receiptPeriod'),
    empty: $('receiptEmpty'),
    insights: $('receiptInsights'),
    total: $('rsTotal'),
    count: $('rsCount'),
    avg: $('rsAvg'),
    plan: $('receiptPlan'),
    planText: $('receiptPlanText'),
    planFill: $('receiptPlanFill'),
    skipped: $('receiptSkipped'),
    merchantList: $('receiptMerchantList'),
    ledgerBody: $('receiptLedgerBody'),
    ledgerCount: $('receiptLedgerCount'),
    exportBtn: $('receiptExportBtn'),
  };
  if (!els.fileInput) return;

  let receipts = loadJson(STORE_KEY, []);
  let learned = loadJson(LEARNED_KEY, {});
  let plannedVariableMonthly = NaN;
  let categoryChart = null;
  let monthChart = null;
  let ocrWorkerPromise = null;
  let busy = false;

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      setStatus('Could not save — browser storage is full or blocked.', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Engine selection
  // ---------------------------------------------------------------------------

  function getEngine() {
    const checked = document.querySelector('input[name="receiptEngine"]:checked');
    return checked ? checked.value : 'ocr';
  }

  function initEngine() {
    const saved = loadJson(ENGINE_KEY, 'ocr');
    const radio = document.querySelector(`input[name="receiptEngine"][value="${saved}"]`);
    if (radio) radio.checked = true;
    try {
      els.apiKey.value = localStorage.getItem(API_KEY_KEY) || '';
    } catch (e) {
      /* ignore */
    }
    syncEngineUI();
    document.querySelectorAll('input[name="receiptEngine"]').forEach((r) =>
      r.addEventListener('change', () => {
        saveJson(ENGINE_KEY, getEngine());
        syncEngineUI();
      })
    );
    els.apiKey.addEventListener('change', () => {
      try {
        localStorage.setItem(API_KEY_KEY, els.apiKey.value.trim());
      } catch (e) {
        /* ignore */
      }
    });
  }

  function syncEngineUI() {
    els.keyRow.hidden = getEngine() !== 'claude';
  }

  // ---------------------------------------------------------------------------
  // Image → in-memory canvas (never persisted)
  // ---------------------------------------------------------------------------

  async function fileToCanvas(file, maxSide, grayscale) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bitmap = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Could not open that image.'));
        };
        img.src = url;
      });
    }
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: grayscale });
    if (grayscale) ctx.filter = 'grayscale(1) contrast(1.4)';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    return canvas;
  }

  function wipeCanvas(canvas) {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
  }

  // ---------------------------------------------------------------------------
  // Engine 1: on-device OCR (Tesseract.js, lazy-loaded on first scan)
  // ---------------------------------------------------------------------------

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the on-device reader. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  function getOcrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = (async () => {
        setStatus('Loading the on-device reader (first time only, ~15 MB)…', 'busy');
        await loadScript(TESSERACT_SRC);
        // English + Vietnamese so accented receipts read properly.
        return window.Tesseract.createWorker(['eng', 'vie']);
      })().catch((err) => {
        ocrWorkerPromise = null;
        throw err;
      });
    }
    return ocrWorkerPromise;
  }

  async function readWithOcr(file) {
    const canvas = await fileToCanvas(file, 2000, true);
    try {
      const worker = await getOcrWorker();
      setStatus('Reading receipt on your device…', 'busy');
      const { data } = await worker.recognize(canvas);
      return RC.parseReceiptText(data.text || '', {
        defaultCurrency: getReportingCurrency(),
        learned,
      });
    } finally {
      wipeCanvas(canvas);
    }
  }

  // ---------------------------------------------------------------------------
  // Engine 2: Claude vision (bring your own key)
  // ---------------------------------------------------------------------------

  async function readWithClaude(file) {
    const key = els.apiKey.value.trim();
    if (!key) throw new Error('Add your Anthropic API key first, or switch to On-device.');

    const canvas = await fileToCanvas(file, 1568, false);
    let base64;
    try {
      base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    } finally {
      wipeCanvas(canvas);
    }

    setStatus('Reading receipt with Claude…', 'busy');
    const categoryIds = RC.CATEGORIES.map((c) => c.id).join(', ');
    const prompt =
      'Extract the purchase from this receipt. Reply with JSON only, no prose:\n' +
      '{"merchant": string (shop or business name, tidy capitalisation),' +
      ' "total": number (final amount paid incl. tax, after discounts; not subtotal, not change, not cash given),' +
      ' "currency": string (ISO 4217 code, infer from symbols/language/country),' +
      ' "date": string (YYYY-MM-DD, receipts are day-first; empty if absent),' +
      ` "category": one of [${categoryIds}]}\n` +
      'If the image is not a receipt, reply {"error": "not a receipt"}.';

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });
    } finally {
      base64 = null;
    }

    if (!res.ok) {
      let msg = `Claude request failed (${res.status}).`;
      try {
        const err = await res.json();
        if (err && err.error && err.error.message) msg = err.error.message;
      } catch (e) {
        /* ignore */
      }
      if (res.status === 401) msg = 'That API key was rejected. Check it and try again.';
      throw new Error(msg);
    }

    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not understand the reply. Try again or add it manually.');
    const out = JSON.parse(match[0]);
    if (out.error) throw new Error("That doesn't look like a receipt.");

    const merchant = String(out.merchant || '').slice(0, 60);
    const validCat = RC.CATEGORIES.some((c) => c.id === out.category);
    const learnedCat = learned[RC.fold(merchant).trim()];
    return {
      merchant,
      amount: Number(out.total),
      currency: String(out.currency || getReportingCurrency()).toUpperCase(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || '') ? out.date : RC.todayIso(),
      category: learnedCat || (validCat ? out.category : RC.categorise(merchant, '', learned)),
      confidence: 'high',
    };
  }

  // ---------------------------------------------------------------------------
  // Capture flow
  // ---------------------------------------------------------------------------

  async function onFileChosen() {
    const file = els.fileInput.files && els.fileInput.files[0];
    // Release the file from the input immediately; we hold it only in this scope.
    els.fileInput.value = '';
    if (!file || busy) return;
    busy = true;
    try {
      const result = getEngine() === 'claude' ? await readWithClaude(file) : await readWithOcr(file);
      openReview(result);
      if (!Number.isFinite(result.amount)) {
        setStatus("Couldn't find the total — please type it in.", 'warn');
      } else if (result.confidence === 'low') {
        setStatus('Best guess at the total — please double-check it.', 'warn');
      } else {
        setStatus('Receipt read. Check the details and save.', 'ok');
      }
    } catch (err) {
      setStatus(err.message || 'Something went wrong reading that receipt.', 'error');
    } finally {
      busy = false;
    }
  }

  function openReview(data, editingId) {
    els.review.dataset.editing = editingId || '';
    els.reviewTitle.textContent = editingId ? 'Edit expense' : 'Check the details';
    els.merchant.value = data.merchant || '';
    els.amount.value = Number.isFinite(data.amount) ? String(data.amount) : '';
    ensureCurrencyOption(data.currency);
    els.currency.value = data.currency || getReportingCurrency();
    els.date.value = data.date || RC.todayIso();
    els.date.max = RC.todayIso();
    els.category.value = data.category || 'other';
    els.review.hidden = false;
    els.review.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    (Number.isFinite(data.amount) ? els.merchant : els.amount).focus({ preventScroll: true });
  }

  function closeReview() {
    els.review.hidden = true;
    els.review.reset();
    els.review.dataset.editing = '';
  }

  function onSave(e) {
    e.preventDefault();
    const amount = RC.parseMoney(els.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      els.amount.focus();
      setStatus('Enter the amount paid.', 'warn');
      return;
    }
    const merchant = els.merchant.value.trim() || 'Unknown';
    const record = {
      date: els.date.value || RC.todayIso(),
      merchant,
      amount,
      currency: els.currency.value,
      category: els.category.value,
    };

    // Remember the category choice for this merchant next time.
    const key = RC.fold(merchant).trim();
    if (key && key !== 'unknown') {
      learned[key] = record.category;
      saveJson(LEARNED_KEY, learned);
    }

    const editingId = els.review.dataset.editing;
    if (editingId) {
      receipts = receipts.map((r) => (r.id === editingId ? { ...r, ...record } : r));
    } else {
      receipts.push({ id: newId(), ...record, createdAt: new Date().toISOString() });
    }
    saveJson(STORE_KEY, receipts);
    closeReview();
    setStatus(`Saved ${formatInCurrency(amount, record.currency)} at ${merchant}.`, 'ok');
    render();
  }

  function newId() {
    return (crypto.randomUUID && crypto.randomUUID()) || `r${Date.now()}${Math.random().toString(16).slice(2)}`;
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg || '';
    els.status.dataset.kind = kind || '';
  }

  // ---------------------------------------------------------------------------
  // Analysis + rendering
  // ---------------------------------------------------------------------------

  function toReporting(amount, code) {
    return convert(amount, code, getReportingCurrency());
  }

  function render() {
    const reporting = getReportingCurrency();
    const bounds = RC.periodBounds(els.period.value);
    const a = RC.analyse(receipts, bounds, toReporting);
    const fmt = (n) => formatInCurrency(n, reporting);

    const has = a.count + a.skipped > 0;
    els.empty.hidden = has;
    els.insights.hidden = !has;

    if (has) {
      els.total.textContent = fmt(a.total);
      els.count.textContent = String(a.count);
      els.avg.textContent = a.count ? fmt(a.average) : '—';

      els.skipped.hidden = !a.skipped;
      els.skipped.textContent = a.skipped
        ? `${a.skipped} expense${a.skipped > 1 ? 's' : ''} left out until exchange rates load.`
        : '';

      renderPlan(fmt);
      renderCategoryChart(a);
      renderMerchants(a, fmt);
      renderMonthChart();
    }

    renderLedger();
  }

  function renderPlan(fmt) {
    if (els.period.value !== 'this-month' || !Number.isFinite(plannedVariableMonthly) || plannedVariableMonthly <= 0) {
      els.plan.hidden = true;
      return;
    }
    const spent = RC.analyse(receipts, RC.periodBounds('this-month'), toReporting).total;
    const pct = spent / plannedVariableMonthly;
    els.plan.hidden = false;
    els.planText.textContent = `${fmt(spent)} of ${fmt(plannedVariableMonthly)} (${Math.round(pct * 100)}%)`;
    els.planFill.style.width = `${Math.min(pct, 1) * 100}%`;
    els.plan.dataset.state = pct > 1 ? 'over' : pct > 0.85 ? 'near' : 'ok';
  }

  function chartFont() {
    return { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 12 };
  }

  function renderCategoryChart(a) {
    if (typeof Chart === 'undefined') return;
    const cats = a.categories;
    const labels = cats.map((c) => `${RC.labelFor(c.id)} · ${Math.round(c.share * 100)}%`);
    const colors = cats.map((c) => (RC.CATEGORIES.find((x) => x.id === c.id) || {}).color || '#9CA3AF');
    const data = cats.map((c) => c.amount);

    if (!categoryChart) {
      categoryChart = new Chart($('receiptCategoryChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { font: chartFont(), boxWidth: 12 } },
            tooltip: {
              callbacks: { label: (ctx) => ` ${formatInCurrency(ctx.parsed, getReportingCurrency())}` },
            },
          },
        },
      });
    } else {
      categoryChart.data.labels = labels;
      categoryChart.data.datasets[0].data = data;
      categoryChart.data.datasets[0].backgroundColor = colors;
      categoryChart.update();
    }
  }

  function renderMerchants(a, fmt) {
    const top = a.merchants.slice(0, 8);
    const max = top.length ? top[0].total : 1;
    els.merchantList.innerHTML = '';
    for (const m of top) {
      const li = document.createElement('li');
      const color = (RC.CATEGORIES.find((x) => x.id === m.category) || {}).color || '#9CA3AF';
      li.innerHTML = `
        <div class="merchant-row">
          <span class="merchant-name"></span>
          <span class="merchant-amount"></span>
        </div>
        <div class="merchant-bar"><span></span></div>
        <span class="merchant-meta"></span>`;
      li.querySelector('.merchant-name').textContent = m.name;
      li.querySelector('.merchant-amount').textContent = fmt(m.total);
      li.querySelector('.merchant-meta').textContent =
        `${m.count} visit${m.count > 1 ? 's' : ''} · ${RC.labelFor(m.category)}`;
      const bar = li.querySelector('.merchant-bar span');
      bar.style.width = `${(m.total / max) * 100}%`;
      bar.style.background = color;
      els.merchantList.appendChild(li);
    }
  }

  function renderMonthChart() {
    if (typeof Chart === 'undefined') return;
    // Always the last 6 months, independent of the period picker, for trend context.
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const all = RC.analyse(receipts, RC.periodBounds('all'), toReporting);
    const byMonth = Object.fromEntries(all.months.map((m) => [m.month, m.amount]));
    const data = months.map((m) => byMonth[m] || 0);
    const labels = months.map((m) => {
      const [y, mo] = m.split('-').map(Number);
      return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: 'short' });
    });

    if (!monthChart) {
      monthChart = new Chart($('receiptMonthChart').getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: '#7B14EF', borderRadius: 6, maxBarThickness: 36 }] },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${formatInCurrency(ctx.parsed.y, getReportingCurrency())}` } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: chartFont() } },
            y: {
              beginAtZero: true,
              ticks: {
                font: chartFont(),
                callback: (v) => compact(v, getReportingCurrency()),
              },
            },
          },
        },
      });
    } else {
      monthChart.data.labels = labels;
      monthChart.data.datasets[0].data = data;
      monthChart.update();
    }
  }

  function compact(v, code) {
    const meta = getCurrencyMeta(code);
    return meta.symbol + Number(v).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  }

  function renderLedger() {
    const sorted = [...receipts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    els.ledgerCount.textContent = String(sorted.length);
    els.ledgerBody.innerHTML = '';
    for (const r of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Date"></td>
        <td data-label="Where"><button type="button" class="link-btn" data-act="edit"></button></td>
        <td data-label="Category"><select class="cell-input cell-input--compact" aria-label="Category"></select></td>
        <td data-label="Amount" class="align-right"></td>
        <td class="align-right">
          <button type="button" class="btn-icon" data-act="delete" aria-label="Delete expense" title="Delete">
            <svg class="icon icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#icon-trash"/></svg>
          </button>
        </td>`;
      tr.children[0].textContent = formatDate(r.date);
      tr.querySelector('[data-act="edit"]').textContent = r.merchant;
      const sel = tr.querySelector('select');
      fillCategorySelect(sel);
      sel.value = r.category;
      tr.children[3].textContent = formatInCurrency(Number(r.amount), r.currency);

      sel.addEventListener('change', () => {
        r.category = sel.value;
        const key = RC.fold(r.merchant).trim();
        if (key && key !== 'unknown') {
          learned[key] = sel.value;
          saveJson(LEARNED_KEY, learned);
        }
        saveJson(STORE_KEY, receipts);
        render();
      });
      tr.querySelector('[data-act="edit"]').addEventListener('click', () => openReview(r, r.id));
      tr.querySelector('[data-act="delete"]').addEventListener('click', () => {
        if (!confirm(`Delete ${r.merchant} (${formatInCurrency(Number(r.amount), r.currency)})?`)) return;
        receipts = receipts.filter((x) => x.id !== r.id);
        saveJson(STORE_KEY, receipts);
        render();
      });
      els.ledgerBody.appendChild(tr);
    }
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function exportCsv() {
    const blob = new Blob([RC.toCsv(receipts)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-buddy-expenses-${RC.todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------------------------------------------------------------------
  // Selects
  // ---------------------------------------------------------------------------

  function fillCategorySelect(sel) {
    sel.innerHTML = '';
    for (const c of RC.CATEGORIES) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.label;
      sel.appendChild(o);
    }
  }

  function fillCurrencySelect() {
    els.currency.innerHTML = '';
    for (const c of SUPPORTED_CURRENCIES) {
      const o = document.createElement('option');
      o.value = c.code;
      o.textContent = `${c.code} (${c.symbol})`;
      els.currency.appendChild(o);
    }
  }

  function ensureCurrencyOption(code) {
    if (!code || [...els.currency.options].some((o) => o.value === code)) return;
    const o = document.createElement('option');
    o.value = code;
    o.textContent = code;
    els.currency.appendChild(o);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  fillCategorySelect(els.category);
  fillCurrencySelect();
  initEngine();

  els.fileInput.addEventListener('change', onFileChosen);
  els.manualBtn.addEventListener('click', () =>
    openReview({ merchant: '', amount: NaN, currency: getReportingCurrency(), date: RC.todayIso(), category: 'other' })
  );
  els.merchant.addEventListener('change', () => {
    // Re-suggest a category as the merchant is typed/edited, unless editing an existing row.
    if (els.review.dataset.editing) return;
    els.category.value = RC.categorise(els.merchant.value, '', learned);
  });
  els.review.addEventListener('submit', onSave);
  els.discard.addEventListener('click', () => {
    closeReview();
    setStatus('', '');
  });
  els.period.addEventListener('change', render);
  els.exportBtn.addEventListener('click', exportCsv);

  window.onBudgetRecompute = function (info) {
    plannedVariableMonthly = info && Number.isFinite(info.plannedVariableMonthly) ? info.plannedVariableMonthly : NaN;
    render();
  };

  render();
})();
