/**
 * Bank statements: read a CSV export on this device, turn it into spending
 * data points, and compare actual spending with the budget plan. No DOM.
 *
 * Only data points are produced, the same shape as receipts:
 *   { date, merchant, amount, currency, category, source: 'statement', key }
 * The statement file itself is never stored.
 *
 * Works with the common Australian layouts (CommBank, ANZ, NAB, Westpac,
 * credit cards) and any CSV with a header row naming date, description and
 * amount (or debit and credit) columns.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./receipt-core.js'));
  else root.StatementCore = factory(root.ReceiptCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RC) {
  'use strict';

  const fold = (s) => (RC ? RC.fold(s) : String(s || '').toLowerCase());

  // ---------------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------------

  /** Rows of cells. Handles quotes, "" escapes, CRLF, a BOM, and , ; or tab. */
  function parseCsv(text) {
    const src = String(text || '').replace(/^﻿/, '');
    const sample = src.split(/\r?\n/).slice(0, 10).join('\n');
    const count = (ch) => (sample.match(new RegExp(ch === '\t' ? '\t' : `\\${ch}`, 'g')) || []).length;
    const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quoted) {
        if (c === '"' && src[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === delim) {
        row.push(cell.trim());
        cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
    if (cell || row.length) {
      row.push(cell.trim());
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c !== ''));
  }

  // ---------------------------------------------------------------------------
  // Dates and amounts
  // ---------------------------------------------------------------------------

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');

  function validIso(y, m, d) {
    if (y < 100) y += 2000;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  /** "02/10/2026", "2026-10-02", "2 Oct 2026", "Oct 2, 2026" → "2026-10-02". */
  function parseDate(str, order = 'dmy') {
    const s = String(str || '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return validIso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (m) return order === 'mdy' ? validIso(+m[3], +m[1], +m[2]) : validIso(+m[3], +m[2], +m[1]);
    const mon = (w) => MONTHS[w.slice(0, 3).toLowerCase()];
    m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-,]+(\d{2,4})\b/);
    if (m && mon(m[2])) return validIso(+m[3], mon(m[2]), +m[1]);
    m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m && mon(m[1])) return validIso(+m[3], mon(m[1]), +m[2]);
    return null;
  }

  /** Day-first unless a value proves otherwise (13/01 vs 01/13). */
  function detectDateOrder(values, fallback = 'dmy') {
    let dmy = false;
    let mdy = false;
    values.forEach((v) => {
      const m = String(v || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (!m) return;
      if (+m[1] > 12) dmy = true;
      if (+m[2] > 12) mdy = true;
    });
    if (dmy && !mdy) return 'dmy';
    if (mdy && !dmy) return 'mdy';
    return fallback;
  }

  /** "-12.50", "(12.50)", "12.50 DR", "$1,234.56", "−5" → signed number; blank → NaN. */
  function parseAmount(str) {
    const s = String(str == null ? '' : str).trim();
    if (!s || !/\d/.test(s)) return NaN;
    const negative = /^[-−–]|^\(.*\)$|[-−]$|\bdr\b/i.test(s.replace(/[A-Za-z$€£₫¥ ]+(?=[-−(])/, ''));
    // Keep only the number; a lone comma or dot with 1–2 digits after is a decimal.
    const n = RC ? RC.parseMoney(s.replace(/\b(cr|dr)\b/gi, '')) : Number(s.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n)) return NaN;
    return negative ? -n : n;
  }

  // ---------------------------------------------------------------------------
  // Layout: which column is which
  // ---------------------------------------------------------------------------

  const HEAD = {
    date: /^(transaction |txn |posted |posting |value |trans\.? )?date\b|^date|^ngay/,
    desc: /(description|narrative|transaction details|details|particulars|memo|payee|reference|noi dung|dien giai|mo ta)/,
    merchant: /merchant/,
    amount: /^(transaction )?(amount|value)\b|^so tien$/,
    debit: /(debit|withdrawal|money out|paid out|spent|ghi no)/,
    credit: /(credit|deposit|money in|paid in|received|ghi co)/,
    balance: /(balance|so du)/,
  };

  function findCol(header, re, not = []) {
    return header.findIndex((h, i) => re.test(h) && !not.includes(i));
  }

  /**
   * @returns {{hasHeader:boolean, date:number, desc:number, merchant:number,
   *   amount:number, debit:number, credit:number, dateOrder:string}|null}
   */
  function detectLayout(rows, opts = {}) {
    if (!rows.length) return null;
    const head = rows[0].map((h) => fold(h).trim());
    const headerish = !rows[0].some((c) => parseDate(c)) && head.filter((h) => Object.values(HEAD).some((re) => re.test(h))).length >= 2;
    const body = headerish ? rows.slice(1) : rows;
    const sample = body.slice(0, 40);
    let L;
    if (headerish) {
      const date = findCol(head, HEAD.date);
      const balance = findCol(head, HEAD.balance);
      const amount = findCol(head, HEAD.amount, [balance]);
      const debit = amount < 0 ? findCol(head, HEAD.debit, [balance]) : -1;
      const credit = amount < 0 ? findCol(head, HEAD.credit, [balance, debit]) : -1;
      const merchant = findCol(head, HEAD.merchant);
      let desc = findCol(head, HEAD.desc, [merchant, date]);
      if (desc < 0) desc = merchant;
      L = { hasHeader: true, date, desc, merchant: merchant === desc ? -1 : merchant, amount, debit, credit };
    } else {
      // No header: the date column parses as dates, the amount is the first
      // number column after it (a later one is usually the running balance),
      // and the description is the wordiest column.
      const width = Math.max(...sample.map((r) => r.length));
      const share = (fn) => Array.from({ length: width }, (_, i) => {
        const vals = sample.map((r) => r[i]).filter((v) => v != null && v !== '');
        return vals.length ? vals.filter(fn).length / sample.length : 0;
      });
      const dateShare = share((v) => parseDate(v));
      const date = dateShare.indexOf(Math.max(...dateShare));
      const numShare = share((v) => /^[\s$€£₫(+\-−]*[\d.,]+\)?\s*(cr|dr)?$/i.test(v));
      const nums = numShare.map((s, i) => (s >= 0.6 && i !== date ? i : -1)).filter((i) => i >= 0);
      const letters = Array.from({ length: width }, (_, i) => sample.reduce((a, r) => a + ((r[i] || '').match(/[A-Za-z]/g) || []).length, 0));
      nums.forEach((i) => (letters[i] = -1));
      letters[date] = -1;
      const desc = letters.indexOf(Math.max(...letters));
      L = { hasHeader: false, date, desc, merchant: -1, amount: nums.length ? nums[0] : -1, debit: -1, credit: -1 };
    }
    if (L.date < 0 || L.desc < 0 || (L.amount < 0 && L.debit < 0)) return null;
    L.dateOrder = detectDateOrder(body.map((r) => r[L.date]), opts.dateOrder || 'dmy');
    return L;
  }

  // ---------------------------------------------------------------------------
  // Merchants and categories
  // ---------------------------------------------------------------------------

  /** Common Australian and Vietnamese merchants as they appear on statements. */
  const STATEMENT_MERCHANTS = [
    ['woolworths', 'Woolworths', 'groceries'], ['woolies', 'Woolworths', 'groceries'], ['coles', 'Coles', 'groceries'],
    ['aldi', 'Aldi', 'groceries'], ['iga', 'IGA', 'groceries'], ['harris farm', 'Harris Farm', 'groceries'],
    ['foodworks', 'FoodWorks', 'groceries'], ['costco', 'Costco', 'groceries'],
    ['uber eats', 'Uber Eats', 'dining'], ['ubereats', 'Uber Eats', 'dining'], ['doordash', 'DoorDash', 'dining'],
    ['menulog', 'Menulog', 'dining'], ['deliveroo', 'Deliveroo', 'dining'], ['grabfood', 'GrabFood', 'dining'],
    ['mcdonalds', "McDonald's", 'dining'], ["mcdonald's", "McDonald's", 'dining'], ['kfc', 'KFC', 'dining'],
    ['hungry jacks', "Hungry Jack's", 'dining'], ['guzman', 'Guzman y Gomez', 'dining'], ['grill\'d', "Grill'd", 'dining'],
    ['subway', 'Subway', 'dining'], ['dominos', "Domino's", 'dining'], ['starbucks', 'Starbucks', 'dining'],
    ['uber', 'Uber', 'transport'], ['didi', 'DiDi', 'transport'], ['grab', 'Grab', 'transport'], ['opal', 'Opal', 'transport'],
    ['myki', 'Myki', 'transport'], ['translink', 'Translink', 'transport'], ['linkt', 'Linkt', 'transport'],
    ['citylink', 'CityLink', 'transport'], ['bp ', 'BP', 'transport'], ['shell', 'Shell', 'transport'],
    ['ampol', 'Ampol', 'transport'], ['caltex', 'Caltex', 'transport'], ['7-eleven', '7-Eleven', 'transport'],
    ['netflix', 'Netflix', 'entertainment'], ['spotify', 'Spotify', 'entertainment'], ['disney plus', 'Disney+', 'entertainment'],
    ['disneyplus', 'Disney+', 'entertainment'], ['stan.com', 'Stan', 'entertainment'], ['binge', 'Binge', 'entertainment'],
    ['kayo', 'Kayo', 'entertainment'], ['youtube', 'YouTube', 'entertainment'], ['apple.com/bill', 'Apple', 'entertainment'],
    ['telstra', 'Telstra', 'bills'], ['optus', 'Optus', 'bills'], ['vodafone', 'Vodafone', 'bills'], ['tpg', 'TPG', 'bills'],
    ['aussie broadband', 'Aussie Broadband', 'bills'], ['agl', 'AGL', 'bills'], ['origin', 'Origin Energy', 'bills'],
    ['energyaustralia', 'EnergyAustralia', 'bills'], ['red energy', 'Red Energy', 'bills'], ['sydney water', 'Sydney Water', 'bills'],
    ['chemist warehouse', 'Chemist Warehouse', 'health'], ['priceline', 'Priceline', 'health'], ['terrywhite', 'TerryWhite', 'health'],
    ['medibank', 'Medibank', 'health'], ['bupa', 'Bupa', 'health'], ['anytime fitness', 'Anytime Fitness', 'health'],
    ['bunnings', 'Bunnings', 'shopping'], ['kmart', 'Kmart', 'shopping'], ['target', 'Target', 'shopping'], ['big w', 'Big W', 'shopping'],
    ['jb hi-fi', 'JB Hi-Fi', 'shopping'], ['jb hifi', 'JB Hi-Fi', 'shopping'], ['officeworks', 'Officeworks', 'shopping'],
    ['amazon', 'Amazon', 'shopping'], ['ikea', 'IKEA', 'shopping'], ['myer', 'Myer', 'shopping'], ['david jones', 'David Jones', 'shopping'],
    ['uniqlo', 'Uniqlo', 'shopping'], ['shopee', 'Shopee', 'shopping'], ['lazada', 'Lazada', 'shopping'], ['tiki', 'Tiki', 'shopping'],
    ['qantas', 'Qantas', 'travel'], ['virgin australia', 'Virgin Australia', 'travel'], ['jetstar', 'Jetstar', 'travel'],
    ['vietjet', 'VietJet', 'travel'], ['vietnam airlines', 'Vietnam Airlines', 'travel'], ['airbnb', 'Airbnb', 'travel'],
    ['booking.com', 'Booking.com', 'travel'],
  ];

  function hasWord(hay, word) {
    const w = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(hay);
  }

  function knownMerchant(desc) {
    const f = ` ${fold(desc).replace(/\*/g, ' ').replace(/\s+/g, ' ')} `;
    for (const [key, name, category] of STATEMENT_MERCHANTS) {
      if (hasWord(f, key)) return { name, category };
    }
    return null;
  }

  const STATES = /\b(aus|au|australia|nsw|ns|vic|qld|wa|sa|tas|act|nt|vn|vnm|vietnam|hcm|hcmc)\b/gi;

  /** "VISA PURCHASE WOOLWORTHS 1234 SYDNEY NS AUS Card xx1234 Value Date: 02/10/2026" → "Woolworths". */
  function cleanMerchant(desc) {
    const known = knownMerchant(desc);
    if (known) return known.name;
    let s = String(desc || '');
    s = s.replace(/value date:?\s*\S+/gi, ' ')
      .replace(/\bcard\s*(no\.?|number)?\s*x*\d{4}\b/gi, ' ')
      .replace(/\bx{2,}\d{2,4}\b/gi, ' ')
      .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ');
    for (let i = 0; i < 3; i++) {
      s = s.replace(/^\s*(visa|mastercard|mc|eftpos|pos|debit card|debit|card|purchase|contactless|tap and go|apple pay|google pay|osko|bpay|direct debit|dd|paypal|sq|sqr|sp|zlr|ls|tst|fps)\b\s*[-:*]?\s*/i, '');
    }
    s = s.replace(/^\s*(transfer|tfr|payment|bpay|osko|direct debit)\s+(to|from)?\s*/i, '')
      .replace(/\b(commbank app|netbank|internet banking|mobile banking|online banking|anz internet|nab connect|westpac online|via osko|osko)\b/gi, ' ');
    s = s.replace(/\*/g, ' ').replace(STATES, ' ').replace(/\b\w*\d{3,}\w*\b/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!s) return String(desc || '').trim().slice(0, 40) || 'Unknown';
    const letters = s.replace(/[^A-Za-z]/g, '');
    if (letters && letters === letters.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s'&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    return s.slice(0, 40);
  }

  const HOUSING = /\b(rent|rental|mortgage|home loan|strata|real estate|body corporate|lease|tien nha|thue nha)\b/;
  const TRANSFER = /\b(transfer|tfr|trf|xfer|internal|own account|to acc|from acc|chuyen khoan|ck)\b/;
  const REPAYMENT = /(payment received|payment - thank|payment thank|thank you payment|card repayment|credit card payment|cc payment|autopay|bpay payment.*card)/;

  /** Category for a statement line: what you chose before, a known shop, then keywords. */
  function categoriseLine(desc, merchant, learned) {
    const key = fold(merchant).trim();
    if (key && learned && learned[key]) return learned[key];
    if (HOUSING.test(fold(desc))) return 'housing';
    const known = knownMerchant(desc);
    if (known) return known.category;
    return RC ? RC.categorise(merchant, desc, learned) : 'other';
  }

  /** Short stable id for a line, so importing the same statement twice adds nothing. */
  function lineKey(date, amount, desc, n) {
    const s = `${date}|${Math.abs(amount).toFixed(2)}|${fold(desc).replace(/\s+/g, ' ').trim()}|${n}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return `st${h.toString(36)}`;
  }

  // ---------------------------------------------------------------------------
  // The whole statement
  // ---------------------------------------------------------------------------

  /**
   * @param {string} text  CSV text
   * @param {{currency:string, learned?:object, dateOrder?:string, flip?:boolean}} opts
   * @returns {{ok:boolean, error?:string, layout?:object, transactions:Array,
   *   from?:string, to?:string, spendingSign?:number}}
   */
  function parseStatement(text, opts = {}) {
    const rows = parseCsv(text);
    const L = detectLayout(rows, opts);
    if (!L) return { ok: false, error: 'not-a-statement', transactions: [] };
    const body = L.hasHeader ? rows.slice(1) : rows;

    // Signed amounts: money out negative, money in positive.
    const raw = body.map((r) => {
      let signed;
      if (L.amount >= 0) signed = parseAmount(r[L.amount]);
      else {
        const d = Math.abs(parseAmount(r[L.debit]));
        const c = Math.abs(parseAmount(r[L.credit]));
        signed = Number.isFinite(d) && d > 0 ? -d : Number.isFinite(c) ? c : NaN;
      }
      return { r, signed, date: parseDate(r[L.date], L.dateOrder) };
    }).filter((x) => x.date && Number.isFinite(x.signed) && x.signed !== 0);
    if (!raw.length) return { ok: false, error: 'no-transactions', transactions: [] };

    // One amount column: most lines are spending, so the commoner sign is
    // "money out" (bank accounts show it negative, credit cards positive).
    let outSign = -1;
    if (L.amount >= 0) {
      const neg = raw.filter((x) => x.signed < 0).length;
      outSign = neg >= raw.length - neg ? -1 : 1;
    }
    if (opts.flip) outSign = -outSign;

    const seen = {};
    const transactions = raw.map(({ r, signed, date }) => {
      const merchantCell = L.merchant >= 0 ? (r[L.merchant] || '').trim() : '';
      const desc = (r[L.desc] || '').trim() || merchantCell;
      const merchant = merchantCell ? cleanMerchant(merchantCell) : cleanMerchant(desc);
      const out = Math.sign(signed) === outSign;
      const amount = Math.abs(signed);
      const d = fold(`${desc} ${merchantCell}`);
      let skip = null;
      if (!out) skip = 'Money in';
      else if (REPAYMENT.test(d)) skip = 'Card repayment';
      else if (TRANSFER.test(d) && !HOUSING.test(d)) skip = 'Looks like a transfer';
      const base = `${date}|${amount}|${d}`;
      seen[base] = (seen[base] || 0) + 1;
      return {
        date,
        description: desc,
        merchant,
        amount,
        currency: opts.currency || 'AUD',
        category: categoriseLine(`${desc} ${merchantCell}`, merchant, opts.learned),
        out,
        skip,
        key: lineKey(date, amount, d, seen[base]),
      };
    });
    const dates = transactions.map((t) => t.date).sort();
    return { ok: true, layout: L, transactions, from: dates[0], to: dates[dates.length - 1], spendingSign: outSign };
  }

  const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

  /**
   * Mark lines already in the ledger: imported before (same key), or a receipt
   * you added for the same purchase (same currency, amount within 1%, ±3 days).
   */
  function markDuplicates(transactions, ledger) {
    const keys = new Set((ledger || []).filter((e) => e.key).map((e) => e.key));
    const receipts = (ledger || []).filter((e) => e.source !== 'statement').map((e) => ({ ...e, used: false }));
    return transactions.map((t) => {
      if (keys.has(t.key)) return { ...t, skip: 'Already added' };
      if (t.skip) return t;
      const match = receipts.find((e) => !e.used && e.currency === t.currency && Math.abs(Number(e.amount) - t.amount) <= Math.max(0.01, t.amount * 0.01) && Math.abs(dayNum(e.date) - dayNum(t.date)) <= 3);
      if (match) {
        match.used = true;
        return { ...t, skip: 'Matches a receipt you added', matchId: match.id };
      }
      return t;
    });
  }

  // ---------------------------------------------------------------------------
  // Actual vs plan
  // ---------------------------------------------------------------------------

  const LESS_THAN_MONTHLY = ['quarterly', 'six-monthly', 'semiannually', 'annually', 'yearly', 'biennially'];

  /** How people name budget costs ("Eating out", "Petrol") → spending categories. */
  const BUDGET_NAMES = [
    [/\b(rent|rental|mortgage|home loan|strata|body corporate|housing)\b/, 'housing'],
    [/\b(grocer\w*|supermarket|food shop\w*|food)\b/, 'groceries'],
    [/\b(dining|eating out|eat out|restaurants?|takeaway|take-away|cafes?|coffee|lunch\w*|dinners?|delivery)\b/, 'dining'],
    [/\b(transport|petrol|fuel|car|parking|tolls?|uber|taxi|train|bus|opal|myki|commut\w*|rego)\b/, 'transport'],
    [/\b(utilit\w*|electric\w*|power|gas|water|internet|broadband|phone|mobile|insurance|bills?|council rates)\b/, 'bills'],
    [/\b(gym|health|medical|doctors?|pharmacy|chemist|dental|dentist|physio)\b/, 'health'],
    [/\b(clothes|clothing|shopping|household|homewares)\b/, 'shopping'],
    [/\b(entertainment|streaming|subscriptions?|movies|cinema|games?|hobb\w*)\b/, 'entertainment'],
    [/\b(travel|holidays?|flights?|trips?|accommodation)\b/, 'travel'],
    [/\b(haircuts?|hair|beauty|personal care|barber|nails)\b/, 'personal'],
  ];

  function budgetCategory(name) {
    const f = fold(name);
    const hit = BUDGET_NAMES.find(([re]) => re.test(f));
    if (hit) return hit[1];
    const known = knownMerchant(name);
    if (known) return known.category;
    return RC ? RC.categorise(name, '', {}) : 'other';
  }

  /** Budget costs grouped into spending categories, by their names. */
  function planByCategory(items) {
    const out = {};
    (items || []).forEach((i) => {
      if (!Number.isFinite(i.monthly) || i.monthly <= 0) return;
      const cat = budgetCategory(i.name);
      const c = (out[cat] = out[cat] || { planned: 0, everyday: 0, rows: [], lessThanMonthly: false });
      c.planned += i.monthly;
      // Day-to-day costs (the planner's Variable group) are spent through the
      // month; rent, bills and subscriptions can land on any day.
      if (i.kind === 'variable') c.everyday += i.monthly;
      c.rows.push(i);
      if (LESS_THAN_MONTHLY.includes(i.frequency)) c.lessThanMonthly = true;
    });
    return out;
  }

  /** Whole calendar months fully inside an imported statement's dates. */
  function coveredMonths(imports, today = new Date()) {
    const months = new Set();
    const thisMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
    (imports || []).forEach(({ from, to }) => {
      if (!from || !to) return;
      let [y, m] = from.split('-').map(Number);
      for (let i = 0; i < 60; i++) {
        const key = `${y}-${pad(m)}`;
        const first = `${key}-01`;
        const last = `${key}-${pad(new Date(y, m, 0).getDate())}`;
        if (first > to) break;
        // Allow a few days' slack: statements often start on the 2nd or end on the 29th.
        if (dayNum(first) - dayNum(from) >= -3 && dayNum(to) - dayNum(last) >= -3 && key !== thisMonth) months.add(key);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    });
    return [...months].sort().slice(-3);
  }

  /**
   * This month so far, per category: spent, planned, and the pace expected by today.
   * @param toReporting (amount, currency) → number (NaN when no rate)
   */
  function monthSoFar(ledger, items, toReporting, today = new Date()) {
    const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const pace = today.getDate() / days;
    const plan = planByCategory(items);
    const spent = {};
    let skipped = 0;
    (ledger || []).filter((e) => String(e.date).slice(0, 7) === key).forEach((e) => {
      const v = toReporting(Number(e.amount), e.currency);
      if (!Number.isFinite(v)) {
        skipped++;
        return;
      }
      spent[e.category] = (spent[e.category] || 0) + v;
    });
    const cats = [...new Set([...Object.keys(plan), ...Object.keys(spent)])];
    const ONCE = ['housing', 'bills'];
    const rows = cats.map((id) => {
      const c = plan[id];
      const planned = c ? c.planned : 0;
      const s = spent[id] || 0;
      const everyday = c ? c.everyday >= planned / 2 : !ONCE.includes(id);
      // Most a category should have used by today: one-off costs in full, day-to-day ones pro rata.
      const expected = c ? (planned - c.everyday) + c.everyday * pace : 0;
      const status = !planned ? 'unplanned' : s > planned + 0.5 ? 'over' : everyday && s > expected * 1.15 && s > planned * 0.25 ? 'ahead' : 'ok';
      return { id, planned, spent: s, expected, everyday, status, left: planned - s };
    }).filter((r) => r.spent > 0 || r.planned > 0).sort((a, b) => b.spent - a.spent || b.planned - a.planned);
    const total = rows.reduce((a, r) => a + r.spent, 0);
    const planned = rows.reduce((a, r) => a + r.planned, 0);
    const day = rows.filter((r) => r.everyday);
    const dayToDay = {
      spent: day.reduce((a, r) => a + r.spent, 0),
      planned: day.reduce((a, r) => a + (plan[r.id] ? plan[r.id].everyday : 0), 0),
    };
    dayToDay.expected = dayToDay.planned * pace;
    return { month: key, pace, day: today.getDate(), days, rows, total, planned, dayToDay, skipped };
  }

  /**
   * Suggestions to bring the plan in line with real spending, from months a
   * statement fully covers. Never lowers a plan to zero (it may be paid from
   * another account), never lowers bills paid less than monthly.
   * @returns {Array<{category, actual, planned, months, action:{type:'set',rowId,monthly}|{type:'add',name,group,monthly}}>}
   */
  function suggestions(ledger, items, imports, toReporting, today = new Date()) {
    const months = coveredMonths(imports, today);
    if (!months.length) return [];
    const plan = planByCategory(items);
    const totals = {};
    (ledger || []).forEach((e) => {
      const mk = String(e.date).slice(0, 7);
      if (!months.includes(mk)) return;
      const v = toReporting(Number(e.amount), e.currency);
      if (!Number.isFinite(v)) return;
      totals[e.category] = (totals[e.category] || 0) + v;
    });
    const totalPlan = Object.values(plan).reduce((a, c) => a + c.planned, 0);
    const out = [];
    Object.entries(totals).forEach(([id, sum]) => {
      const actual = sum / months.length;
      const p = plan[id];
      const planned = p ? p.planned : 0;
      const diff = actual - planned;
      const floor = Math.max(planned * 0.15, totalPlan * 0.01, 1);
      if (Math.abs(diff) < floor || actual <= 0) return;
      if (diff < 0 && p && p.lessThanMonthly) return;
      const round = (x) => (x >= 100 ? Math.round(x / 10) * 10 : Math.round(x));
      // Change a regular cost, never a yearly bill (rego, insurance) to match monthly spending.
      const regular = p ? p.rows.filter((r) => !LESS_THAN_MONTHLY.includes(r.frequency)) : [];
      if (regular.length) {
        const biggest = regular.slice().sort((a, b) => b.monthly - a.monthly)[0];
        const target = round(biggest.monthly + diff);
        if (target <= 0) return;
        out.push({ category: id, actual, planned, months: months.length, action: { type: 'set', rowId: biggest.id, rowName: biggest.name, from: biggest.monthly, monthly: target } });
      } else if (id !== 'other' && diff > 0) {
        out.push({ category: id, actual, planned, months: months.length, action: { type: 'add', group: ['housing', 'bills'].includes(id) ? 'fixed' : 'variable', monthly: round(actual) } });
      }
    });
    return out.sort((a, b) => Math.abs(b.actual - b.planned) - Math.abs(a.actual - a.planned));
  }

  return {
    parseCsv, parseDate, detectDateOrder, parseAmount, detectLayout, cleanMerchant, knownMerchant, categoriseLine,
    parseStatement, markDuplicates, budgetCategory, planByCategory, coveredMonths, monthSoFar, suggestions, STATEMENT_MERCHANTS,
  };
});
