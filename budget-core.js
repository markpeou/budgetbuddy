/**
 * Pure budget calculation helpers (no DOM).
 * Shared by the browser app and Node tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BudgetCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_SPLITS = [
    { id: 'expenses', label: 'Expenses', percent: 50, kind: 'expenses', required: true },
    { id: 'savings', label: 'Long-term savings', percent: 30, kind: 'goal', required: false },
    { id: 'emergency', label: 'Emergency fund', percent: 10, kind: 'goal', required: false },
    { id: 'investments', label: 'Investments', percent: 10, kind: 'goal', required: false },
  ];

  function frequencyToMonthly(amount, frequency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    switch (frequency) {
      case 'weekly':
        return (n * 52) / 12;
      case 'fortnightly':
        return (n * 26) / 12;
      case 'monthly':
        return n;
      case 'quarterly':
        return n / 3;
      case 'annually':
      case 'yearly':
        return n / 12;
      case 'biennially':
        return n / 24;
      default:
        return n;
    }
  }

  function incomeToWeekly(amount, frequency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    switch (frequency) {
      case 'weekly':
        return n;
      case 'fortnightly':
        return (n * 26) / 52;
      case 'monthly':
        return (n * 12) / 52;
      case 'quarterly':
        return (n * 4) / 52;
      case 'annually':
      case 'yearly':
        return n / 52;
      case 'biennially':
        return n / 104;
      default:
        return 0;
    }
  }

  function incomeNormalized(amount, frequency) {
    const weekly = incomeToWeekly(amount, frequency);
    return {
      perDay: weekly / 7,
      perWeek: weekly,
      perMonth: (weekly * 52) / 12,
    };
  }

  /**
   * @param {Record<string, number>|null} vndRates - units of currency per 1 VND
   */
  function getVndRate(vndRates, code) {
    if (code === 'VND') return 1;
    if (!vndRates) return null;
    const perVnd = vndRates[code];
    if (perVnd == null || !Number.isFinite(perVnd) || perVnd <= 0) return null;
    return perVnd;
  }

  function toVnd(amount, code, vndRates) {
    if (!Number.isFinite(amount)) return NaN;
    if (code === 'VND') return amount;
    const perVnd = getVndRate(vndRates, code);
    if (perVnd == null) return NaN;
    return amount / perVnd;
  }

  function fromVnd(vndAmount, code, vndRates) {
    if (!Number.isFinite(vndAmount)) return NaN;
    if (code === 'VND') return vndAmount;
    const perVnd = getVndRate(vndRates, code);
    if (perVnd == null) return NaN;
    return vndAmount * perVnd;
  }

  function convert(amount, fromCode, toCode, vndRates) {
    if (!Number.isFinite(amount)) return NaN;
    if (fromCode === toCode) return amount;
    const vnd = toVnd(amount, fromCode, vndRates);
    if (!Number.isFinite(vnd)) return NaN;
    return fromVnd(vnd, toCode, vndRates);
  }

  /**
   * Aggregate expense rows that may each have a different currency.
   * @param {Array<{amount:number, frequency:string, currency:string}>} rows
   * @param {string} reportingCurrency
   * @param {Record<string, number>|null} vndRates
   * @returns {{ totalVnd: number|null, totalReporting: number|null, ok: boolean, missingRates: string[] }}
   */
  function aggregateExpenseRows(rows, reportingCurrency, vndRates) {
    let totalVnd = 0;
    const missingRates = [];
    const seenMissing = new Set();

    for (const row of rows || []) {
      const monthly = frequencyToMonthly(row.amount, row.frequency);
      const code = row.currency || reportingCurrency;
      const vnd = toVnd(monthly, code, vndRates);
      if (!Number.isFinite(vnd)) {
        if (!seenMissing.has(code)) {
          seenMissing.add(code);
          missingRates.push(code);
        }
        return {
          totalVnd: null,
          totalReporting: null,
          ok: false,
          missingRates,
        };
      }
      totalVnd += vnd;
    }

    const totalReporting = fromVnd(totalVnd, reportingCurrency, vndRates);
    if (!Number.isFinite(totalReporting) && (rows || []).length > 0) {
      if (!seenMissing.has(reportingCurrency)) {
        missingRates.push(reportingCurrency);
      }
      return {
        totalVnd: null,
        totalReporting: null,
        ok: false,
        missingRates,
      };
    }

    return {
      totalVnd: (rows || []).length === 0 ? 0 : totalVnd,
      totalReporting: (rows || []).length === 0 ? 0 : totalReporting,
      ok: true,
      missingRates: [],
    };
  }

  /**
   * @param {Array<{percent:number}>} splits
   * @returns {{ totalPercent: number, status: 'exact'|'under'|'over', remainder: number }}
   */
  function validateSplits(splits) {
    let totalPercent = 0;
    for (const s of splits || []) {
      const p = Number(s.percent);
      const safe = Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
      totalPercent += safe;
    }
    const rounded = Math.round(totalPercent * 100) / 100;
    if (Math.abs(rounded - 100) < 0.01) {
      return { totalPercent: rounded, status: 'exact', remainder: 0 };
    }
    if (rounded < 100) {
      return {
        totalPercent: rounded,
        status: 'under',
        remainder: Math.round((100 - rounded) * 100) / 100,
      };
    }
    return {
      totalPercent: rounded,
      status: 'over',
      remainder: Math.round((rounded - 100) * 100) / 100,
    };
  }

  function cloneDefaultSplits() {
    return DEFAULT_SPLITS.map((s) => ({ ...s }));
  }

  /**
   * Migrate legacy scenario data to the current schema.
   * @param {object} data
   * @returns {object}
   */
  function migrateScenarioData(data) {
    if (!data || typeof data !== 'object') {
      return {
        salaryAmount: '',
        salaryFrequency: 'monthly',
        incomeCurrency: 'USD',
        expenseCurrency: 'VND',
        fixed: [],
        variable: [],
        subs: [],
        splits: cloneDefaultSplits(),
      };
    }

    let incomeCurrency = data.incomeCurrency;
    let expenseCurrency = data.expenseCurrency;
    if (incomeCurrency == null && expenseCurrency == null) {
      incomeCurrency = 'VND';
      expenseCurrency = 'VND';
    }
    if (!incomeCurrency) incomeCurrency = 'USD';
    if (!expenseCurrency) expenseCurrency = 'VND';

    const withCurrency = (rows) =>
      (rows || []).map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name || '',
        frequency: r.frequency || 'monthly',
        amount: r.amount !== undefined && r.amount !== '' ? r.amount : '',
        currency: r.currency || expenseCurrency,
      }));

    let splits = data.splits;
    if (!Array.isArray(splits) || splits.length === 0) {
      const pct = data.percentages || {};
      splits = [
        {
          id: 'expenses',
          label: 'Expenses',
          percent: Number(pct.expenses != null ? pct.expenses : 50),
          kind: 'expenses',
          required: true,
        },
        {
          id: 'savings',
          label: 'Long-term savings',
          percent: Number(pct.savings != null ? pct.savings : 30),
          kind: 'goal',
          required: false,
        },
        {
          id: 'emergency',
          label: 'Emergency fund',
          percent: Number(pct.emergency != null ? pct.emergency : 10),
          kind: 'goal',
          required: false,
        },
        {
          id: 'investments',
          label: 'Investments',
          percent: Number(pct.investments != null ? pct.investments : 10),
          kind: 'goal',
          required: false,
        },
      ];
    } else {
      splits = splits.map((s, i) => ({
        id: s.id || `split-${i}`,
        label: s.label || 'Category',
        percent: Number(s.percent) || 0,
        kind: s.kind === 'expenses' ? 'expenses' : 'goal',
        required: s.kind === 'expenses' || s.required === true,
      }));
      if (!splits.some((s) => s.kind === 'expenses')) {
        splits.unshift({
          id: 'expenses',
          label: 'Expenses',
          percent: 50,
          kind: 'expenses',
          required: true,
        });
      }
    }

    let frequency = data.salaryFrequency || 'monthly';
    if (frequency === 'yearly') frequency = 'annually';

    return {
      salaryAmount: data.salaryAmount ?? '',
      salaryFrequency: frequency,
      incomeCurrency,
      expenseCurrency,
      fixed: withCurrency(data.fixed),
      variable: withCurrency(data.variable),
      subs: withCurrency(data.subs),
      splits,
    };
  }

  function goalSplitsPercentTotal(splits) {
    return (splits || [])
      .filter((s) => s.kind !== 'expenses')
      .reduce((sum, s) => sum + (Number(s.percent) || 0), 0);
  }

  // ---------------------------------------------------------------------------
  // Currencies: full catalogue, locale defaults, "Auto" reporting currency
  // ---------------------------------------------------------------------------

  /** Currencies in circulation (ISO 4217), matching what the rates service quotes. */
  const ACTIVE_CURRENCIES = (
    'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP ' +
    'BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP ' +
    'GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES ' +
    'KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR ' +
    'MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD ' +
    'RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY ' +
    'TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW'
  ).split(' ');

  /** Shown first in every currency picker. */
  const COMMON_CURRENCIES = [
    'AUD', 'VND', 'USD', 'EUR', 'GBP', 'NZD', 'SGD', 'THB', 'JPY', 'KRW',
    'CNY', 'HKD', 'MYR', 'IDR', 'PHP', 'INR', 'CAD', 'CHF',
  ];

  /**
   * Build {code, name, symbol, decimals} for every active currency using the
   * platform's own currency data. `overrides` keeps hand-picked symbols (A$, S$).
   */
  function buildCurrencyCatalog(overrides = [], locale = 'en') {
    const byCode = new Map(overrides.map((c) => [c.code, c]));
    let names = null;
    try {
      names = new Intl.DisplayNames([locale], { type: 'currency' });
    } catch (e) {
      /* old browser: fall back to codes */
    }
    for (const code of ACTIVE_CURRENCIES) {
      if (byCode.has(code)) continue;
      try {
        const fmt = (display) =>
          new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: display });
        const symbolOf = (f) => (f.formatToParts(1).find((p) => p.type === 'currency') || {}).value || code;
        let symbol = symbolOf(fmt('symbol'));
        if (symbol === code) {
          // Prefer a distinctive narrow symbol (฿, ₱, ₹) — but never a bare "$" that hides which dollar.
          const narrow = symbolOf(fmt('narrowSymbol'));
          if (narrow !== code && narrow !== '$') symbol = narrow;
        }
        byCode.set(code, {
          code,
          name: (names && names.of(code)) || code,
          symbol,
          decimals: fmt('symbol').resolvedOptions().maximumFractionDigits,
        });
      } catch (e) {
        byCode.set(code, { code, name: code, symbol: code, decimals: 2 });
      }
    }
    return [...byCode.values()];
  }

  /** Region → currency for picking a sensible default from the device locale. */
  const EURO_REGIONS = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
  const REGION_CURRENCY = {
    AU: 'AUD', VN: 'VND', US: 'USD', GB: 'GBP', NZ: 'NZD', SG: 'SGD', TH: 'THB', JP: 'JPY',
    KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD', MY: 'MYR', ID: 'IDR', PH: 'PHP', IN: 'INR',
    CA: 'CAD', CH: 'CHF', KH: 'KHR', LA: 'LAK', MM: 'MMK', AE: 'AED', SA: 'SAR', ZA: 'ZAR',
    MX: 'MXN', BR: 'BRL', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
    TR: 'TRY', IL: 'ILS', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', EG: 'EGP', NG: 'NGN',
    KE: 'KES', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', MO: 'MOP', FJ: 'FJD',
  };

  /** "en-AU" → "AUD"; tries each preferred language in order. */
  function currencyForLocales(locales, fallback = 'USD') {
    for (const tag of locales || []) {
      let region = null;
      try {
        const loc = new Intl.Locale(tag);
        region = loc.region || (loc.maximize && loc.maximize().region);
      } catch (e) {
        const m = String(tag).match(/[-_]([A-Za-z]{2})\b/);
        region = m && m[1];
      }
      if (!region) continue;
      region = region.toUpperCase();
      if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
      if (EURO_REGIONS.includes(region)) return 'EUR';
    }
    return fallback;
  }

  // Time zone → country, for "where you are right now" without asking for
  // location permission. Covers the zones phones actually report; anything
  // missing falls back to the language region.
  const TZ_REGION = (() => {
    const map = {};
    const table = {
      VN: 'Asia/Ho_Chi_Minh Asia/Saigon',
      AU: 'Australia/Sydney Australia/Melbourne Australia/Brisbane Australia/Perth Australia/Adelaide Australia/Hobart Australia/Darwin Australia/Canberra Australia/ACT Australia/NSW Australia/Queensland Australia/Victoria Australia/West Australia/South Australia/Tasmania Australia/North Australia/Lord_Howe Australia/Broken_Hill Australia/Lindeman Australia/Currie Australia/Eucla',
      NZ: 'Pacific/Auckland Pacific/Chatham NZ',
      TH: 'Asia/Bangkok', KH: 'Asia/Phnom_Penh', LA: 'Asia/Vientiane', MM: 'Asia/Yangon Asia/Rangoon',
      SG: 'Asia/Singapore Singapore', MY: 'Asia/Kuala_Lumpur Asia/Kuching',
      ID: 'Asia/Jakarta Asia/Makassar Asia/Jayapura Asia/Pontianak', PH: 'Asia/Manila',
      JP: 'Asia/Tokyo Japan', KR: 'Asia/Seoul ROK', CN: 'Asia/Shanghai Asia/Chongqing Asia/Harbin Asia/Urumqi PRC',
      HK: 'Asia/Hong_Kong Hongkong', MO: 'Asia/Macau Asia/Macao', TW: 'Asia/Taipei ROC',
      IN: 'Asia/Kolkata Asia/Calcutta', PK: 'Asia/Karachi', BD: 'Asia/Dhaka', LK: 'Asia/Colombo',
      NP: 'Asia/Kathmandu Asia/Katmandu', AE: 'Asia/Dubai', SA: 'Asia/Riyadh', IL: 'Asia/Jerusalem Asia/Tel_Aviv Israel',
      TR: 'Europe/Istanbul Asia/Istanbul Turkey',
      GB: 'Europe/London Europe/Belfast GB', IE: 'Europe/Dublin', FR: 'Europe/Paris', DE: 'Europe/Berlin',
      ES: 'Europe/Madrid Atlantic/Canary', IT: 'Europe/Rome', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels',
      PT: 'Europe/Lisbon Atlantic/Madeira Atlantic/Azores', AT: 'Europe/Vienna', GR: 'Europe/Athens',
      FI: 'Europe/Helsinki', EE: 'Europe/Tallinn', LV: 'Europe/Riga', LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg',
      MT: 'Europe/Malta', CY: 'Asia/Nicosia Europe/Nicosia', SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava',
      HR: 'Europe/Zagreb', CH: 'Europe/Zurich', SE: 'Europe/Stockholm', NO: 'Europe/Oslo', DK: 'Europe/Copenhagen',
      PL: 'Europe/Warsaw', CZ: 'Europe/Prague', HU: 'Europe/Budapest',
      US: 'America/New_York America/Chicago America/Denver America/Los_Angeles America/Phoenix America/Anchorage America/Detroit America/Boise America/Indiana/Indianapolis America/Kentucky/Louisville Pacific/Honolulu US/Eastern US/Central US/Mountain US/Pacific US/Hawaii',
      CA: 'America/Toronto America/Vancouver America/Edmonton America/Winnipeg America/Halifax America/St_Johns America/Regina America/Montreal',
      MX: 'America/Mexico_City America/Cancun America/Tijuana America/Monterrey', BR: 'America/Sao_Paulo America/Manaus America/Fortaleza America/Recife',
      AR: 'America/Argentina/Buenos_Aires America/Buenos_Aires', CL: 'America/Santiago', CO: 'America/Bogota', PE: 'America/Lima',
      ZA: 'Africa/Johannesburg', EG: 'Africa/Cairo', NG: 'Africa/Lagos', KE: 'Africa/Nairobi', FJ: 'Pacific/Fiji',
    };
    Object.entries(table).forEach(([region, zones]) =>
      zones.split(' ').forEach((z) => {
        map[z] = region;
      })
    );
    return map;
  })();

  /** Currency for an IANA time zone (e.g. Asia/Ho_Chi_Minh → VND), or fallback. */
  function currencyForTimeZone(timeZone, fallback = null) {
    let region = TZ_REGION[timeZone];
    if (!region && /^Australia\//.test(timeZone || '')) region = 'AU';
    if (!region) return fallback;
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    if (EURO_REGIONS.includes(region)) return 'EUR';
    return fallback;
  }

  /**
   * Which currency holds the majority of spending?
   * @param {Array<{amount:number, currency:string}>} entries  monthly amounts
   * @param {(amount:number, code:string) => number} toBase  common base (NaN if no rate)
   * @param {{current?:string, fallback:string}} opts
   * Weighs by value when rates are available, otherwise by number of entries.
   * Sticks with `current` unless another currency is clearly bigger (20% margin),
   * so totals don't flip back and forth while someone is typing.
   */
  function majorityCurrency(entries, toBase, opts) {
    const { current, fallback } = opts;
    const valued = new Map();
    const counted = new Map();
    let canValue = true;
    for (const e of entries || []) {
      const amt = Number(e.amount);
      if (!e.currency || !Number.isFinite(amt) || amt <= 0) continue;
      counted.set(e.currency, (counted.get(e.currency) || 0) + 1);
      const v = toBase(amt, e.currency);
      if (!Number.isFinite(v)) canValue = false;
      else valued.set(e.currency, (valued.get(e.currency) || 0) + v);
    }
    const weights = canValue ? valued : counted;
    if (!weights.size) return { code: fallback, share: 0, basis: 'none' };

    let total = 0;
    let leader = null;
    for (const [code, w] of weights) {
      total += w;
      if (!leader || w > weights.get(leader)) leader = code;
    }
    let code = leader;
    if (current && weights.has(current) && weights.get(leader) <= weights.get(current) * 1.2) {
      code = current;
    }
    return { code, share: total ? weights.get(code) / total : 0, basis: canValue ? 'value' : 'count' };
  }

  /**
   * Whole-number percentages that add up to exactly 100 (largest remainder).
   * @param {number[]} weights  non-negative; all zero → equal shares
   */
  function toHundred(weights) {
    const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
    const sum = w.reduce((a, b) => a + b, 0);
    if (!w.length) return [];
    const raw = sum > 0 ? w.map((x) => (x / sum) * 100) : w.map(() => 100 / w.length);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw
      .map((x, i) => [x - Math.floor(x), i])
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => {
        if (left > 0) {
          out[i] += 1;
          left -= 1;
        }
      });
    return out;
  }

  /**
   * Keep the split at 100%: set one category, and scale the others in
   * proportion to fill what's left. `baseline` is the split before the edit
   * started, so typing 6 → 60 doesn't compound.
   * @returns {number[]} new percents, same order as `baseline`
   */
  function balanceSplits(baseline, changedIndex, newPercent) {
    const pcts = baseline.map((s) => Math.max(0, Number(s.percent) || 0));
    if (pcts.length === 1) return [100];
    const target = Math.round(Math.max(0, Math.min(100, Number(newPercent) || 0)));
    const others = pcts.filter((_, i) => i !== changedIndex);
    const shares = toHundred(others).map((x) => x / 100);
    const rest = 100 - target;
    // Distribute `rest` by the others' current proportions, in whole numbers.
    const scaled = shares.map((x) => x * rest);
    const whole = scaled.map(Math.floor);
    let left = rest - whole.reduce((a, b) => a + b, 0);
    scaled
      .map((x, i) => [x - Math.floor(x), i])
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => {
        if (left > 0) {
          whole[i] += 1;
          left -= 1;
        }
      });
    const out = [];
    let k = 0;
    for (let i = 0; i < pcts.length; i++) out.push(i === changedIndex ? target : whole[k++]);
    return out;
  }

  /** Bring any split (old scenario, deleted category) back to exactly 100%. */
  function normalizeSplits(splits) {
    const total = (splits || []).reduce((a, s) => a + (Number(s.percent) || 0), 0);
    if (Math.round(total) === 100 && splits.every((s) => Number.isInteger(Number(s.percent)))) return splits.map((s) => s.percent);
    return toHundred(splits.map((s) => Number(s.percent) || 0));
  }

  // ---------------------------------------------------------------------------
  // The shared budget model: one calculation every page reads
  // ---------------------------------------------------------------------------

  // Names that usually mean a necessity, or usually mean a choice. Only used to
  // *suggest* whether a cost is essential; the user's choice always wins.
  const ESSENTIAL_WORDS = /\b(rent|mortgage|housing|strata|council|grocer\w*|supermarket|food|electric\w*|power|energy|gas|water|utilit\w*|internet|wifi|broadband|phone|mobile|transport|commut\w*|bus|train|metro|fuel|petrol|diesel|parking|toll\w*|health\w*|medical|doctor|dentist|pharmac\w*|medicine|prescription\w*|insurance|child ?care|daycare|school|tuition|loan|debt|repayment\w*|tax|household|toiletr\w*|baby|nappies|diapers)\b/i;
  const CHOICE_WORDS = /\b(gym|netflix|spotify|disney|streaming|music|tv|entertainment|dining|restaurant\w*|takeaway|take-away|cafe|coffee|bar|drinks|alcohol|holiday\w*|travel|shopping|clothes|hobby|hobbies|games?|gaming|subscription\w*)\b/i;

  function suggestEssential(name, kind) {
    const n = String(name || '');
    if (CHOICE_WORDS.test(n)) return false;
    if (ESSENTIAL_WORDS.test(n)) return true;
    return kind === 'fixed';
  }

  /** Key for a cost's essential choice: its permanent id, else (older data) its name. */
  function essentialKey(row) {
    return row && row.id ? `id:${row.id}` : `${(row && row.kind) || 'other'}:${String((row && row.name) || '').trim().toLowerCase()}`;
  }
  function legacyEssentialKey(row) {
    return `${row.kind || 'other'}:${String(row.name || '').trim().toLowerCase()}`;
  }

  const LESS_THAN_MONTHLY = ['quarterly', 'annually', 'yearly', 'biennially'];
  // Whole cents; never −0 (which would show as "−$0").
  const round2 = (x) => {
    const r = Math.round(x * 100) / 100;
    return r === 0 ? 0 : r;
  };

  /**
   * Turn saved budget data (the scenario / draft shape) into monthly figures
   * in one currency. Never guesses: if a rate is missing, totals are null and
   * `missingRates` names the currencies.
   *
   *   moneyIn    take-home pay + other money coming in (regular / not regular)
   *   moneyOut   all costs, by group, essential vs other, and the share that
   *              comes from bills paid less often than monthly (spread monthly)
   *   leftOver   moneyIn − moneyOut (planned savings are NOT taken off)
   *   planned    what the savings & goals split sets aside — a plan, not savings
   *   savings    money you can access, and other savings/investments (kept apart)
   */
  function budgetModel(data, opts = {}) {
    const d = data || {};
    const rates = opts.rates || null;
    const target = opts.currency || d.incomeCurrency || 'USD';
    const missing = [];
    let converted = false; // any amount converted from another currency (rates matter)
    const conv = (amount, code) => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) return 0;
      const v = convert(n, code || target, target, rates);
      if (!Number.isFinite(v)) {
        if (!missing.includes(code)) missing.push(code);
        return NaN;
      }
      if ((code || target) !== target) converted = true;
      return v;
    };
    const amt = (x) => {
      const n = typeof x === 'string' ? Number(x.replace(/[^0-9.\-]/g, '')) : Number(x);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    // Money coming in
    const salaryAmount = amt(d.salaryAmount);
    const salary = conv(incomeNormalized(salaryAmount, d.salaryFrequency || 'monthly').perMonth, d.incomeCurrency || target);
    let regular = 0;
    let irregular = 0;
    const otherIncome = (d.otherIncome || []).map((r) => {
      const monthly = conv(frequencyToMonthly(amt(r.amount), r.frequency || 'monthly'), r.currency || target);
      const isRegular = r.regular !== false;
      if (isRegular) regular += monthly;
      else irregular += monthly;
      return { id: r.id, name: String(r.name || '').trim() || 'Other money', monthly, regular: isRegular, currency: r.currency || target };
    }).filter((r) => r.monthly !== 0);

    // Money going out
    const choices = (d.essentials && d.essentials.items) || {};
    const items = [];
    const groups = { fixed: 0, variable: 0, subs: 0 };
    let spread = 0;
    [['fixed', d.fixed], ['variable', d.variable], ['subs', d.subs]].forEach(([kind, rows]) => {
      (rows || []).forEach((r) => {
        const a = amt(r.amount);
        if (!a) return;
        const frequency = r.frequency || 'monthly';
        const monthly = conv(frequencyToMonthly(a, frequency), r.currency || d.expenseCurrency || target);
        const row = { id: r.id || null, name: String(r.name || '').trim() || 'Unnamed cost', kind, frequency, currency: r.currency || target, monthly };
        const c = choices[essentialKey(row)] || choices[legacyEssentialKey(row)] || {};
        row.essential = typeof c.on === 'boolean' ? c.on : suggestEssential(row.name, kind);
        row.essentialConfirmed = typeof c.on === 'boolean';
        groups[kind] += monthly;
        if (LESS_THAN_MONTHLY.includes(frequency)) spread += monthly;
        items.push(row);
      });
    });

    // Savings (actual balances, not the plan)
    const sv = d.savings || {};
    const accessible = sv.accessible ? conv(amt(sv.accessible.amount), sv.accessible.currency || target) : 0;
    const otherSavings = sv.other ? conv(amt(sv.other.amount), sv.other.currency || target) : 0;

    const ok = missing.length === 0;
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    const inTotal = salary + regular + irregular;
    const outTotal = groups.fixed + groups.variable + groups.subs;
    const essential = sum(items.filter((i) => i.essential).map((i) => i.monthly));
    const val = (x) => (ok ? round2(x) : null);
    const hasIncome = salaryAmount > 0 || otherIncome.length > 0;

    // The plan: what the split sets aside, from money coming in.
    const splits = Array.isArray(d.splits) ? d.splits : [];
    const plannedItems = splits
      .filter((sp) => sp.kind !== 'expenses')
      .map((sp) => ({ id: sp.id, label: sp.label, percent: Number(sp.percent) || 0, monthly: val(inTotal * (Number(sp.percent) || 0) / 100) }));

    return {
      ok,
      missingRates: missing,
      converted,
      currency: target,
      complete: { income: hasIncome, costs: items.length > 0 },
      moneyIn: {
        salary: val(salary),
        regular: val(salary + regular),
        notRegular: val(irregular),
        total: val(inTotal),
        other: otherIncome,
      },
      moneyOut: {
        fixed: val(groups.fixed),
        variable: val(groups.variable),
        subs: val(groups.subs),
        total: val(outTotal),
        essential: val(essential),
        other: val(outTotal - essential),
        spread: val(spread),
        items,
      },
      // Can't say what's left without knowing what comes in.
      leftOver: ok && hasIncome ? round2(inTotal - outTotal) : null,
      leftOverYear: ok && hasIncome ? round2((inTotal - outTotal) * 12) : null,
      planned: { total: ok ? round2(sum(plannedItems.map((p) => p.monthly))) : null, items: plannedItems },
      savings: { accessible: val(accessible), other: val(otherSavings) },
    };
  }

  /** Difference between two models, for comparing scenarios (b − a). */
  function compareModels(a, b) {
    const diff = (x, y) => (x == null || y == null ? null : round2(y - x));
    return {
      ok: Boolean(a && b && a.ok && b.ok),
      moneyIn: diff(a.moneyIn.total, b.moneyIn.total),
      moneyOut: diff(a.moneyOut.total, b.moneyOut.total),
      leftOver: diff(a.leftOver, b.leftOver),
      leftOverYear: diff(a.leftOverYear, b.leftOverYear),
    };
  }

  return {
    budgetModel,
    compareModels,
    suggestEssential,
    essentialKey,
    LESS_THAN_MONTHLY,
    DEFAULT_SPLITS,
    balanceSplits,
    normalizeSplits,
    ACTIVE_CURRENCIES,
    COMMON_CURRENCIES,
    buildCurrencyCatalog,
    currencyForLocales,
    currencyForTimeZone,
    majorityCurrency,
    frequencyToMonthly,
    incomeToWeekly,
    incomeNormalized,
    getVndRate,
    toVnd,
    fromVnd,
    convert,
    aggregateExpenseRows,
    validateSplits,
    cloneDefaultSplits,
    migrateScenarioData,
    goalSplitsPercentTotal,
  };
});
