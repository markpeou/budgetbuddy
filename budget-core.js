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
      case 'annually':
      case 'yearly':
        return n / 52;
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

  return {
    DEFAULT_SPLITS,
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
