/* global Chart, icon, BudgetCore */
const Core = typeof BudgetCore !== 'undefined' ? BudgetCore : null;

const salaryAmountInput = document.getElementById('salaryAmount');
const salaryFrequencySelect = document.getElementById('salaryFrequency');
const salaryCurrencySymbolEl = document.getElementById('salaryCurrencySymbol');
const incomeCurrencySelect = document.getElementById('incomeCurrencySelect');
const expenseCurrencySelect = document.getElementById('expenseCurrencySelect');
const incomeHintEl = document.getElementById('incomeHint');
const ratesMetaEl = document.getElementById('ratesMeta');
const expenseRateHintEl = document.getElementById('expenseRateHint');
const bdNetAltHintEl = document.getElementById('bdNetAltHint');

const incomePerDayEl = document.getElementById('incomePerDay');
const incomePerWeekEl = document.getElementById('incomePerWeek');
const incomePerMonthEl = document.getElementById('incomePerMonth');
const incomePerMonthAltEl = document.getElementById('incomePerMonthAlt');

const scenarioNameInput = document.getElementById('scenarioNameInput');
const scenarioSaveBtn = document.getElementById('scenarioSaveBtn');
const scenarioLoadSelect = document.getElementById('scenarioLoadSelect');
const scenarioDeleteBtn = document.getElementById('scenarioDeleteBtn');
const scenarioStatusEl = document.getElementById('scenarioStatus');
const scenarioPickerPanel = document.getElementById('scenarioPickerPanel');
const scenarioCreatePanel = document.getElementById('scenarioCreatePanel');
const scenarioNewBtn = document.getElementById('scenarioNewBtn');
const scenarioCancelBtn = document.getElementById('scenarioCancelBtn');
const scenarioSectionHint = document.getElementById('scenarioSectionHint');

let scenarioCreateMode = false;

const fixedMonthlyHeadEl = document.getElementById('fixedMonthlyHead');
const variableMonthlyHeadEl = document.getElementById('variableMonthlyHead');
const subsMonthlyHeadEl = document.getElementById('subsMonthlyHead');
const fixedEquivHeadEl = document.getElementById('fixedEquivHead');
const variableEquivHeadEl = document.getElementById('variableEquivHead');
const subsEquivHeadEl = document.getElementById('subsEquivHead');
const splitIncomeHeadEl = document.getElementById('splitIncomeHead');
const splitExpenseHeadEl = document.getElementById('splitExpenseHead');
const summaryIncomeHeadEl = document.getElementById('summaryIncomeHead');
const summaryExpenseHeadEl = document.getElementById('summaryExpenseHead');

const totalFixedEquivEl = document.getElementById('totalFixedEquiv');
const totalVariableEquivEl = document.getElementById('totalVariableEquiv');
const totalSubsEquivEl = document.getElementById('totalSubsEquiv');

const summaryIncomeEl = document.getElementById('summaryIncome');
const summaryIncomeAltEl = document.getElementById('summaryIncomeAlt');
const summaryFixedEl = document.getElementById('summaryFixed');
const summaryFixedAltEl = document.getElementById('summaryFixedAlt');
const summaryVariableEl = document.getElementById('summaryVariable');
const summaryVariableAltEl = document.getElementById('summaryVariableAlt');
const summarySubsEl = document.getElementById('summarySubs');
const summarySubsAltEl = document.getElementById('summarySubsAlt');
const summaryAllExpensesEl = document.getElementById('summaryAllExpenses');
const summaryAllExpensesAltEl = document.getElementById('summaryAllExpensesAlt');
const summaryRemainingEl = document.getElementById('summaryRemaining');
const summaryRemainingAltEl = document.getElementById('summaryRemainingAlt');
const summaryPlannedGoalsEl = document.getElementById('summaryPlannedGoals');
const summaryPlannedGoalsAltEl = document.getElementById('summaryPlannedGoalsAlt');
const summaryStatusTextEl = document.getElementById('summaryStatusText');

const totalBudgetedAltEl = document.getElementById('totalBudgetedAlt');
const splitValidationHintEl = document.getElementById('splitValidationHint');
const budgetSplitBody = document.getElementById('budgetSplitBody');
const addSplitCategoryBtn = document.getElementById('addSplitCategoryBtn');

const fixedExpensesBody = document.getElementById('fixedExpensesBody');
const variableExpensesBody = document.getElementById('variableExpensesBody');
const subscriptionsBody = document.getElementById('subscriptionsBody');
const addFixedExpenseBtn = document.getElementById('addFixedExpense');
const addVariableExpenseBtn = document.getElementById('addVariableExpense');
const addSubscriptionBtn = document.getElementById('addSubscription');

const totalFixedMonthlyEl = document.getElementById('totalFixedMonthly');
const totalVariableMonthlyEl = document.getElementById('totalVariableMonthly');
const totalSubsMonthlyEl = document.getElementById('totalSubsMonthly');

const totalPercentageEl = document.getElementById('totalPercentage');
const totalBudgetedEl = document.getElementById('totalBudgeted');

const bdNetDailyEl = document.getElementById('bdNetDaily');
const bdNetWeeklyEl = document.getElementById('bdNetWeekly');
const bdNetMonthlyEl = document.getElementById('bdNetMonthly');
const bdNetAnnualEl = document.getElementById('bdNetAnnual');

/** Supported input/display currencies (rates fetched with VND as hub). */
const SUPPORTED_CURRENCIES = [
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
];

let chartInstance = null;
/** @type {Record<string, number> | null} */
let vndRatesCache = null;
let ratesFetchedAt = null;
let ratesLoading = false;

/** @type {Array<{id:string,label:string,percent:number,kind:string,required:boolean}>} */
let currentSplits = Core
  ? Core.cloneDefaultSplits()
  : [
      { id: 'expenses', label: 'Expenses', percent: 50, kind: 'expenses', required: true },
      { id: 'savings', label: 'Long-term savings', percent: 30, kind: 'goal', required: false },
      { id: 'emergency', label: 'Emergency fund', percent: 10, kind: 'goal', required: false },
      { id: 'investments', label: 'Investments', percent: 10, kind: 'goal', required: false },
    ];

const SCENARIO_STORAGE_KEY = 'budgetPlannerScenarios_v1';
const INCOME_CURRENCY_STORAGE_KEY = 'budgetPlannerIncomeCurrency_v1';
const EXPENSE_CURRENCY_STORAGE_KEY = 'budgetPlannerExpenseCurrency_v1';

const DEFAULT_INCOME_CURRENCY = 'USD';
const DEFAULT_EXPENSE_CURRENCY = 'VND';

const CHART_COLORS = ['#7B14EF', '#00B4A0', '#FFC845', '#C026D3', '#E5E7EB'];

function stripAmountFormatting(value) {
  return String(value).replace(/,/g, '');
}

function parseAmount(value) {
  const num = parseFloat(stripAmountFormatting(value));
  return Number.isFinite(num) ? num : 0;
}

function sanitizeAmountRaw(raw, maxDecimals) {
  let s = stripAmountFormatting(raw).replace(/[^\d.]/g, '');
  if (maxDecimals === 0) {
    const dotIdx = s.indexOf('.');
    return dotIdx === -1 ? s : s.slice(0, dotIdx);
  }
  const dotIdx = s.indexOf('.');
  if (dotIdx === -1) return s;
  const intPart = s.slice(0, dotIdx);
  const decPart = s.slice(dotIdx + 1).replace(/\./g, '').slice(0, maxDecimals);
  return `${intPart}.${decPart}`;
}

function formatAmountDisplay(raw, maxDecimals) {
  const sanitized = sanitizeAmountRaw(raw, maxDecimals);
  if (!sanitized) return '';

  const dotIdx = sanitized.indexOf('.');
  let intPart;
  let decPart;
  if (dotIdx === -1) {
    intPart = sanitized;
    decPart = '';
  } else {
    intPart = sanitized.slice(0, dotIdx);
    decPart = sanitized.slice(dotIdx + 1);
  }

  if (!intPart) intPart = '0';

  const formattedInt = Number(intPart).toLocaleString('en-US');
  if (decPart || sanitized.endsWith('.')) {
    return `${formattedInt}.${decPart}`;
  }
  return formattedInt;
}

function countDigitsBefore(str, pos) {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
}

function cursorPosForDigitCount(formatted, digitCount) {
  if (digitCount <= 0) {
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) return i;
    }
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function attachAmountInputFormatting(input, getMaxDecimals) {
  if (!input) return;

  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.classList.add('amount-input');

  input.formatAmountValue = function formatAmountValue() {
    input.value = formatAmountDisplay(input.value, getMaxDecimals());
  };

  input.addEventListener('input', () => {
    const maxDecimals = getMaxDecimals();
    const oldVal = input.value;
    const oldPos = input.selectionStart ?? oldVal.length;
    const digitsBefore = countDigitsBefore(oldVal, oldPos);
    const formatted = formatAmountDisplay(oldVal, maxDecimals);
    input.value = formatted;
    const newPos = cursorPosForDigitCount(formatted, digitsBefore);
    input.setSelectionRange(newPos, newPos);
  });
}

function reformatAllAmountInputs() {
  if (salaryAmountInput && salaryAmountInput.formatAmountValue) {
    salaryAmountInput.formatAmountValue();
  }
  document.querySelectorAll('.expense-row .amount-input').forEach((inp) => {
    if (inp.formatAmountValue) inp.formatAmountValue();
  });
}

function getCurrencyMeta(code) {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code) || {
      code,
      name: code,
      symbol: code,
      decimals: 2,
    }
  );
}

function isSupportedCurrency(code) {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

function getIncomeCurrency() {
  const code = incomeCurrencySelect && incomeCurrencySelect.value;
  return isSupportedCurrency(code) ? code : DEFAULT_INCOME_CURRENCY;
}

/** Reporting currency for combined expense totals (storage key kept for compat). */
function getReportingCurrency() {
  const code = expenseCurrencySelect && expenseCurrencySelect.value;
  return isSupportedCurrency(code) ? code : DEFAULT_EXPENSE_CURRENCY;
}

function getExpenseCurrency() {
  return getReportingCurrency();
}

function currenciesDiffer() {
  return getIncomeCurrency() !== getReportingCurrency();
}

function formatInCurrency(amount, code) {
  const meta = getCurrencyMeta(code);
  if (!Number.isFinite(amount)) return `${meta.symbol}0`;
  const decimals = meta.decimals;
  const rounded =
    decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${meta.symbol}${formatted}`;
}

function toVnd(amount, code) {
  return Core
    ? Core.toVnd(amount, code, vndRatesCache)
    : code === 'VND'
      ? amount
      : NaN;
}

function fromVnd(vndAmount, code) {
  return Core
    ? Core.fromVnd(vndAmount, code, vndRatesCache)
    : code === 'VND'
      ? vndAmount
      : NaN;
}

function convert(amount, fromCode, toCode) {
  return Core
    ? Core.convert(amount, fromCode, toCode, vndRatesCache)
    : fromCode === toCode
      ? amount
      : NaN;
}

function formatConvertDisplay(amount, fromCode, toCode) {
  if (!Number.isFinite(amount)) return '—';
  if (fromCode === toCode) return formatInCurrency(amount, toCode);
  const converted = convert(amount, fromCode, toCode);
  if (!Number.isFinite(converted)) return '—';
  return formatInCurrency(converted, toCode);
}

function frequencyToMonthly(amount, frequency) {
  return Core
    ? Core.frequencyToMonthly(amount, frequency)
    : amount;
}

function saveCurrencyPreferences() {
  try {
    localStorage.setItem(INCOME_CURRENCY_STORAGE_KEY, getIncomeCurrency());
    localStorage.setItem(EXPENSE_CURRENCY_STORAGE_KEY, getReportingCurrency());
  } catch (e) {
    /* ignore */
  }
}

function populateCurrencySelectOptions(sel, selectedCode, options = {}) {
  if (!sel) return;
  const { short = false } = options;
  const current = selectedCode || sel.value;
  sel.innerHTML = '';
  SUPPORTED_CURRENCIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = short
      ? `${c.symbol} ${c.code}`
      : `${c.symbol} ${c.code} — ${c.name}`;
    sel.appendChild(opt);
  });
  if (isSupportedCurrency(current)) sel.value = current;
}

function populateCurrencySelects() {
  let incomeCode = DEFAULT_INCOME_CURRENCY;
  let expenseCode = DEFAULT_EXPENSE_CURRENCY;
  try {
    incomeCode =
      localStorage.getItem(INCOME_CURRENCY_STORAGE_KEY) || DEFAULT_INCOME_CURRENCY;
    expenseCode =
      localStorage.getItem(EXPENSE_CURRENCY_STORAGE_KEY) || DEFAULT_EXPENSE_CURRENCY;
  } catch (e) {
    /* ignore */
  }
  if (!isSupportedCurrency(incomeCode)) incomeCode = DEFAULT_INCOME_CURRENCY;
  if (!isSupportedCurrency(expenseCode)) expenseCode = DEFAULT_EXPENSE_CURRENCY;

  populateCurrencySelectOptions(incomeCurrencySelect, incomeCode);
  populateCurrencySelectOptions(expenseCurrencySelect, expenseCode);
}

function updateDualColumnVisibility() {
  const showAlt = currenciesDiffer();
  document.querySelectorAll('[data-dual-col="equiv"]').forEach((el) => {
    el.hidden = !showAlt;
  });
  if (incomePerMonthAltEl) incomePerMonthAltEl.hidden = !showAlt;
  if (bdNetAltHintEl) bdNetAltHintEl.hidden = !showAlt;
}

function updateMoneySymbols() {
  if (salaryCurrencySymbolEl) {
    salaryCurrencySymbolEl.textContent = getCurrencyMeta(getIncomeCurrency()).symbol;
  }
  document.querySelectorAll('.expense-row').forEach((tr) => {
    const currencySelect = tr.querySelector('.expense-currency-select');
    const symbolEl = tr.querySelector('.money-symbol');
    if (currencySelect && symbolEl) {
      symbolEl.textContent = getCurrencyMeta(currencySelect.value).symbol;
    }
  });
}

function updateCurrencyHeaders() {
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();
  const incomeMeta = getCurrencyMeta(incomeCode);
  const reportingMeta = getCurrencyMeta(reportingCode);

  if (fixedMonthlyHeadEl) {
    fixedMonthlyHeadEl.textContent = `Monthly (${reportingCode})`;
  }
  if (variableMonthlyHeadEl) {
    variableMonthlyHeadEl.textContent = `Monthly (${reportingCode})`;
  }
  if (subsMonthlyHeadEl) {
    subsMonthlyHeadEl.textContent = `Monthly (${reportingCode})`;
  }

  const equivLabel = currenciesDiffer() ? `Equiv. (${incomeCode})` : 'Equiv.';
  if (fixedEquivHeadEl) fixedEquivHeadEl.textContent = equivLabel;
  if (variableEquivHeadEl) variableEquivHeadEl.textContent = equivLabel;
  if (subsEquivHeadEl) subsEquivHeadEl.textContent = equivLabel;

  if (splitIncomeHeadEl) {
    splitIncomeHeadEl.textContent = `Monthly (${incomeCode})`;
  }
  if (splitExpenseHeadEl) {
    splitExpenseHeadEl.textContent = currenciesDiffer()
      ? `Monthly (${reportingCode})`
      : 'Monthly';
  }

  if (summaryIncomeHeadEl) {
    summaryIncomeHeadEl.textContent = `Income (${incomeCode})`;
  }
  if (summaryExpenseHeadEl) {
    summaryExpenseHeadEl.textContent = currenciesDiffer()
      ? `Reporting (${reportingCode})`
      : 'Expenses';
  }

  if (incomeHintEl) {
    if (currenciesDiffer()) {
      incomeHintEl.textContent = `Enter salary in ${incomeMeta.name} (${incomeCode}). Expense totals report in ${reportingMeta.name} (${reportingCode}).`;
    } else {
      incomeHintEl.textContent = `Enter salary in ${incomeMeta.name} (${incomeCode}). Each expense can still use its own currency.`;
    }
  }

  updateMoneySymbols();
  updateDualColumnVisibility();
}

function updateRateHints() {
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();

  if (ratesMetaEl) {
    if (ratesLoading) {
      ratesMetaEl.textContent = 'Loading exchange rates…';
    } else if (!vndRatesCache) {
      ratesMetaEl.textContent =
        'Exchange rates unavailable — converted totals show “—”. Check your connection.';
    } else if (ratesFetchedAt) {
      ratesMetaEl.textContent = `Rates updated: ${ratesFetchedAt.toLocaleString()}.`;
    } else {
      ratesMetaEl.textContent = 'Exchange rates loaded.';
    }
  }

  if (expenseRateHintEl) {
    if (!currenciesDiffer()) {
      expenseRateHintEl.textContent = '';
    } else if (!vndRatesCache) {
      expenseRateHintEl.textContent = 'Rates needed for cross-currency totals.';
    } else {
      const oneIncomeInReporting = convert(1, incomeCode, reportingCode);
      if (Number.isFinite(oneIncomeInReporting)) {
        expenseRateHintEl.textContent = `1 ${incomeCode} ≈ ${formatInCurrency(oneIncomeInReporting, reportingCode)}`;
      } else {
        expenseRateHintEl.textContent = '';
      }
    }
  }
}

function getRatesObject(data) {
  return data.conversion_rates || data.rates || null;
}

async function loadExchangeRates() {
  if (ratesLoading) return;
  ratesLoading = true;
  updateRateHints();

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/VND');
    const data = await res.json();
    if (data.result === 'error') {
      throw new Error(data['error-type'] || 'API error');
    }
    const rates = getRatesObject(data);
    if (!rates || typeof rates !== 'object') {
      throw new Error('Invalid response');
    }
    vndRatesCache = rates;
    ratesFetchedAt = data.time_last_update_unix
      ? new Date(data.time_last_update_unix * 1000)
      : new Date();
  } catch (e1) {
    try {
      const res2 = await fetch('https://api.exchangerate.host/latest?base=VND');
      const data2 = await res2.json();
      if (!data2.success || !data2.rates) {
        throw new Error('Fallback failed');
      }
      vndRatesCache = data2.rates;
      ratesFetchedAt = data2.date ? new Date(data2.date) : new Date();
    } catch (e2) {
      vndRatesCache = null;
      ratesFetchedAt = null;
    }
  } finally {
    ratesLoading = false;
    recomputeAll();
  }
}

function updateIncome() {
  const amount = parseAmount(salaryAmountInput.value);
  const frequency = salaryFrequencySelect.value;
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();

  const normalized = Core
    ? Core.incomeNormalized(amount, frequency)
    : { perDay: 0, perWeek: 0, perMonth: 0 };
  const { perDay, perWeek: weekly, perMonth } = normalized;

  incomePerDayEl.textContent = formatInCurrency(perDay, incomeCode);
  incomePerWeekEl.textContent = formatInCurrency(weekly, incomeCode);
  incomePerMonthEl.textContent = formatInCurrency(perMonth, incomeCode);

  if (incomePerMonthAltEl) {
    incomePerMonthAltEl.textContent = formatConvertDisplay(
      perMonth,
      incomeCode,
      reportingCode
    );
  }

  const perMonthVnd = toVnd(perMonth, incomeCode);
  return {
    perDay,
    perWeek: weekly,
    perMonth,
    perMonthVnd: Number.isFinite(perMonthVnd) ? perMonthVnd : 0,
  };
}

function createExpenseRow(tbody, defaults = {}) {
  const tr = document.createElement('tr');
  tr.className = 'expense-row';

  const defaultCurrency =
    (defaults.currency && isSupportedCurrency(defaults.currency)
      ? defaults.currency
      : getReportingCurrency());

  const nameTd = document.createElement('td');
  nameTd.dataset.label = 'Item';
  const nameWrap = document.createElement('div');
  nameWrap.className = 'input-wrap';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'cell-input expense-name-input';
  nameInput.placeholder = 'e.g. Rent';
  nameInput.setAttribute('aria-label', 'Expense name');
  if (defaults.name) nameInput.value = defaults.name;
  nameWrap.appendChild(nameInput);
  nameTd.appendChild(nameWrap);

  const freqTd = document.createElement('td');
  freqTd.dataset.label = 'Frequency';
  const freqWrap = document.createElement('div');
  freqWrap.className = 'input-wrap';
  const freqSelect = document.createElement('select');
  freqSelect.className = 'cell-input expense-freq-select';
  freqSelect.setAttribute('aria-label', 'Expense frequency');
  freqSelect.innerHTML = `
    <option value="weekly">Weekly</option>
    <option value="fortnightly">Fortnightly</option>
    <option value="monthly" selected>Monthly</option>
    <option value="quarterly">Quarterly</option>
    <option value="annually">Yearly</option>
  `;
  if (defaults.frequency) {
    const f = defaults.frequency === 'yearly' ? 'annually' : defaults.frequency;
    freqSelect.value = f;
  }
  freqWrap.appendChild(freqSelect);
  freqTd.appendChild(freqWrap);

  const currencyTd = document.createElement('td');
  currencyTd.dataset.label = 'Currency';
  const currencyWrap = document.createElement('div');
  currencyWrap.className = 'input-wrap';
  const currencySelect = document.createElement('select');
  currencySelect.className = 'cell-input expense-currency-select';
  currencySelect.setAttribute('aria-label', 'Expense currency');
  populateCurrencySelectOptions(currencySelect, defaultCurrency, { short: true });
  currencyWrap.appendChild(currencySelect);
  currencyTd.appendChild(currencyWrap);

  const amountTd = document.createElement('td');
  amountTd.dataset.label = 'Amount';
  const amountWrap = document.createElement('div');
  amountWrap.className = 'money-input-wrap input-wrap';
  const symbolSpan = document.createElement('span');
  symbolSpan.className = 'money-symbol';
  symbolSpan.setAttribute('aria-hidden', 'true');
  symbolSpan.textContent = getCurrencyMeta(defaultCurrency).symbol;
  const amountInput = document.createElement('input');
  amountInput.className = 'cell-input expense-amount-input';
  amountInput.placeholder = '0';
  amountInput.setAttribute('aria-label', 'Expense amount');
  if (defaults.amount !== undefined && defaults.amount !== '') {
    amountInput.value = String(defaults.amount);
  }
  attachAmountInputFormatting(
    amountInput,
    () => getCurrencyMeta(currencySelect.value).decimals
  );
  if (amountInput.value) amountInput.formatAmountValue();
  amountWrap.appendChild(symbolSpan);
  amountWrap.appendChild(amountInput);
  amountTd.appendChild(amountWrap);

  const monthlyTd = document.createElement('td');
  monthlyTd.className = 'align-right';
  monthlyTd.dataset.label = 'Monthly';
  const monthlyStrong = document.createElement('strong');
  monthlyStrong.className = 'expense-monthly';
  monthlyStrong.textContent = '—';
  monthlyTd.appendChild(monthlyStrong);

  const foreignTd = document.createElement('td');
  foreignTd.className = 'align-right table-cell-equiv dual-col';
  foreignTd.dataset.dualCol = 'equiv';
  foreignTd.dataset.label = 'Equiv.';
  const equivStrong = document.createElement('strong');
  equivStrong.className = 'equiv-amount';
  equivStrong.textContent = '—';
  foreignTd.appendChild(equivStrong);

  const removeTd = document.createElement('td');
  removeTd.className = 'align-right';
  removeTd.dataset.label = '';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-icon';
  removeBtn.title = 'Remove row';
  removeBtn.setAttribute('aria-label', 'Remove expense row');
  removeBtn.innerHTML = icon('trash', { size: 16, className: 'icon icon--sm' });
  removeTd.appendChild(removeBtn);

  tr.appendChild(nameTd);
  tr.appendChild(freqTd);
  tr.appendChild(currencyTd);
  tr.appendChild(amountTd);
  tr.appendChild(monthlyTd);
  tr.appendChild(foreignTd);
  tr.appendChild(removeTd);

  function recalcRow() {
    const rowCurrency = currencySelect.value;
    const incomeCode = getIncomeCurrency();
    const reportingCode = getReportingCurrency();
    const amount = parseAmount(amountInput.value);
    const frequency = freqSelect.value;
    const monthly = frequencyToMonthly(amount, frequency);

    symbolSpan.textContent = getCurrencyMeta(rowCurrency).symbol;
    monthlyStrong.textContent = formatConvertDisplay(
      monthly,
      rowCurrency,
      reportingCode
    );
    equivStrong.textContent = formatConvertDisplay(monthly, rowCurrency, incomeCode);
    recomputeAll();
  }

  amountInput.addEventListener('input', recalcRow);
  freqSelect.addEventListener('change', recalcRow);
  currencySelect.addEventListener('change', () => {
    if (amountInput.formatAmountValue) amountInput.formatAmountValue();
    recalcRow();
  });
  removeBtn.addEventListener('click', () => {
    tr.remove();
    recomputeAll();
  });

  tbody.appendChild(tr);
  updateDualColumnVisibility();
  recalcRow();
}

function collectRowsFromTable(tbody) {
  const out = [];
  if (!tbody) return out;
  tbody.querySelectorAll('tr.expense-row').forEach((tr) => {
    const nameInput = tr.querySelector('.expense-name-input');
    const freqSelect = tr.querySelector('.expense-freq-select');
    const currencySelect = tr.querySelector('.expense-currency-select');
    const amountInput = tr.querySelector('.expense-amount-input');
    if (!nameInput || !freqSelect || !amountInput) return;
    out.push({
      name: nameInput.value,
      frequency: freqSelect.value,
      amount: parseAmount(amountInput.value),
      currency:
        (currencySelect && currencySelect.value) || getReportingCurrency(),
    });
  });
  return out;
}

function aggregateTable(tbody) {
  const rows = collectRowsFromTable(tbody);
  return Core
    ? Core.aggregateExpenseRows(rows, getReportingCurrency(), vndRatesCache)
    : { totalVnd: 0, totalReporting: 0, ok: true, missingRates: [] };
}

function refreshExpenseTableDisplay(tbody) {
  if (!tbody) return;
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();
  tbody.querySelectorAll('tr.expense-row').forEach((tr) => {
    const amountInput = tr.querySelector('.expense-amount-input');
    const freqSelect = tr.querySelector('.expense-freq-select');
    const currencySelect = tr.querySelector('.expense-currency-select');
    const monthlyEl = tr.querySelector('.expense-monthly');
    const equivEl = tr.querySelector('.equiv-amount');
    const symbolEl = tr.querySelector('.money-symbol');
    if (!amountInput || !freqSelect || !currencySelect || !monthlyEl) return;
    const rowCurrency = currencySelect.value;
    const monthly = frequencyToMonthly(
      parseAmount(amountInput.value),
      freqSelect.value
    );
    if (symbolEl) symbolEl.textContent = getCurrencyMeta(rowCurrency).symbol;
    monthlyEl.textContent = formatConvertDisplay(
      monthly,
      rowCurrency,
      reportingCode
    );
    if (equivEl) {
      equivEl.textContent = formatConvertDisplay(monthly, rowCurrency, incomeCode);
    }
  });
}

function syncSplitsFromDom() {
  if (!budgetSplitBody) return;
  budgetSplitBody.querySelectorAll('tr[data-split-id]').forEach((tr) => {
    const id = tr.dataset.splitId;
    const split = currentSplits.find((s) => s.id === id);
    if (!split) return;
    const labelInput = tr.querySelector('.split-label-input');
    const pctInput = tr.querySelector('.percentage-input');
    if (labelInput && !split.required) {
      split.label = labelInput.value.trim() || split.label;
    }
    if (pctInput) {
      const raw = parseAmount(pctInput.value);
      split.percent = Math.max(0, Math.min(100, raw));
    }
  });
}

function renderBudgetSplits() {
  if (!budgetSplitBody) return;
  budgetSplitBody.innerHTML = '';

  currentSplits.forEach((split) => {
    const tr = document.createElement('tr');
    tr.dataset.splitId = split.id;
    tr.dataset.category = split.kind;
    tr.dataset.splitKind = split.kind;

    const labelTd = document.createElement('td');
    labelTd.dataset.label = 'Category';
    if (split.required) {
      const span = document.createElement('span');
      span.className = 'split-label-static';
      span.textContent = split.label;
      labelTd.appendChild(span);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'input-wrap';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-input split-label-input';
      input.value = split.label;
      input.setAttribute('aria-label', 'Category name');
      input.placeholder = 'e.g. Travel';
      input.addEventListener('input', () => {
        syncSplitsFromDom();
        const pctInput = tr.querySelector('.percentage-input');
        const removeBtn = tr.querySelector('.btn-icon');
        if (pctInput) {
          pctInput.setAttribute('aria-label', `${input.value || 'Category'} percentage`);
        }
        if (removeBtn) {
          removeBtn.setAttribute('aria-label', `Remove ${input.value || 'category'}`);
          removeBtn.title = 'Remove category';
        }
        recomputeAll();
      });
      wrap.appendChild(input);
      labelTd.appendChild(wrap);
    }

    const pctTd = document.createElement('td');
    pctTd.dataset.label = 'Percentage';
    pctTd.className = 'split-pct-cell';
    const pctInput = document.createElement('input');
    pctInput.type = 'number';
    pctInput.className = 'percentage-input';
    pctInput.min = '0';
    pctInput.max = '100';
    pctInput.value = String(split.percent);
    pctInput.setAttribute('aria-label', `${split.label} percentage`);
    pctInput.addEventListener('input', () => {
      syncSplitsFromDom();
      recomputeAll();
    });
    pctTd.appendChild(pctInput);
    pctTd.appendChild(document.createTextNode('%'));

    const amountTd = document.createElement('td');
    amountTd.className = 'align-right';
    amountTd.dataset.label = 'Monthly';
    const amountStrong = document.createElement('strong');
    amountStrong.className = 'split-amount';
    amountStrong.dataset.splitAmount = split.id;
    amountStrong.textContent = '—';
    amountTd.appendChild(amountStrong);

    const foreignTd = document.createElement('td');
    foreignTd.className = 'align-right split-foreign dual-col';
    foreignTd.dataset.dualCol = 'equiv';
    foreignTd.dataset.splitForeign = split.id;
    foreignTd.dataset.label = 'Equiv.';
    foreignTd.textContent = '—';

    const statusTd = document.createElement('td');
    statusTd.className = 'align-right status-cell';
    statusTd.dataset.status = split.id;
    statusTd.dataset.label = 'Status';

    const actionsTd = document.createElement('td');
    actionsTd.className = 'align-right';
    actionsTd.dataset.label = '';
    if (!split.required) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-icon';
      removeBtn.title = 'Remove category';
      removeBtn.setAttribute('aria-label', `Remove ${split.label}`);
      removeBtn.innerHTML = icon('trash', { size: 16, className: 'icon icon--sm' });
      removeBtn.addEventListener('click', () => {
        currentSplits = currentSplits.filter((s) => s.id !== split.id);
        renderBudgetSplits();
        recomputeAll();
      });
      actionsTd.appendChild(removeBtn);
    }

    tr.appendChild(labelTd);
    tr.appendChild(pctTd);
    tr.appendChild(amountTd);
    tr.appendChild(foreignTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionsTd);
    budgetSplitBody.appendChild(tr);
  });

  updateDualColumnVisibility();
}

function addSplitCategory() {
  syncSplitsFromDom();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `split-${Date.now()}`;
  currentSplits.push({
    id,
    label: 'New category',
    percent: 0,
    kind: 'goal',
    required: false,
  });
  renderBudgetSplits();
  recomputeAll();
  const row = budgetSplitBody && budgetSplitBody.querySelector(`[data-split-id="${id}"]`);
  const labelInput = row && row.querySelector('.split-label-input');
  if (labelInput) {
    labelInput.focus();
    labelInput.select();
  }
}

function updatePercentages(incomePerMonthVnd, totalExpensesVnd, expensesOk) {
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();
  syncSplitsFromDom();

  const validation = Core
    ? Core.validateSplits(currentSplits)
    : { totalPercent: 100, status: 'exact', remainder: 0 };

  let plannedGoalsVnd = 0;

  currentSplits.forEach((split) => {
    const safePercent = Math.max(0, Math.min(100, Number(split.percent) || 0));
    const monthlyTargetVnd = (incomePerMonthVnd * safePercent) / 100;
    const monthlyTargetIncome = fromVnd(monthlyTargetVnd, incomeCode);

    const amountEl = document.querySelector(
      `.split-amount[data-split-amount="${split.id}"]`
    );
    if (amountEl) {
      amountEl.textContent = Number.isFinite(monthlyTargetIncome)
        ? formatInCurrency(monthlyTargetIncome, incomeCode)
        : '—';
    }

    const splitAlt = document.querySelector(`[data-split-foreign="${split.id}"]`);
    if (splitAlt) {
      const reportingAmount = fromVnd(monthlyTargetVnd, reportingCode);
      splitAlt.textContent = Number.isFinite(reportingAmount)
        ? formatInCurrency(reportingAmount, reportingCode)
        : '—';
    }

    if (split.kind !== 'expenses') {
      plannedGoalsVnd += monthlyTargetVnd;
    }
  });

  if (totalPercentageEl) {
    totalPercentageEl.textContent = `${validation.totalPercent.toFixed(0)}%`;
    totalPercentageEl.classList.remove(
      'split-total--exact',
      'split-total--under',
      'split-total--over'
    );
    totalPercentageEl.classList.add(`split-total--${validation.status}`);
  }

  if (splitValidationHintEl) {
    if (validation.status === 'exact') {
      splitValidationHintEl.textContent = 'Ready — totals 100%';
      splitValidationHintEl.className = 'split-validation hint split-validation--ok';
    } else if (validation.status === 'under') {
      splitValidationHintEl.textContent = `${validation.remainder}% still unallocated`;
      splitValidationHintEl.className = 'split-validation hint split-validation--under';
    } else {
      splitValidationHintEl.textContent = `${validation.remainder}% over 100%`;
      splitValidationHintEl.className = 'split-validation hint split-validation--over';
    }
  }

  const totalBudgetedVnd = (incomePerMonthVnd * validation.totalPercent) / 100;
  const totalBudgetedIncome = fromVnd(totalBudgetedVnd, incomeCode);
  if (totalBudgetedEl) {
    totalBudgetedEl.textContent = Number.isFinite(totalBudgetedIncome)
      ? formatInCurrency(totalBudgetedIncome, incomeCode)
      : '—';
  }
  if (totalBudgetedAltEl) {
    const alt = fromVnd(totalBudgetedVnd, reportingCode);
    totalBudgetedAltEl.textContent = Number.isFinite(alt)
      ? formatInCurrency(alt, reportingCode)
      : '—';
  }

  const expensesSplit = currentSplits.find((s) => s.kind === 'expenses');
  if (expensesSplit) {
    const expensesStatusCell = document.querySelector(
      `[data-status="${expensesSplit.id}"]`
    );
    if (expensesStatusCell) {
      const targetVnd = (incomePerMonthVnd * (Number(expensesSplit.percent) || 0)) / 100;
      const threshold = Math.max(
        1,
        Math.abs(toVnd(1, reportingCode) || 1) * 0.01
      );

      if (!incomePerMonthVnd || incomePerMonthVnd <= 0 || !expensesOk) {
        expensesStatusCell.textContent = expensesOk ? '' : 'Rates needed';
        expensesStatusCell.className = 'status-cell';
      } else if (totalExpensesVnd < targetVnd - threshold) {
        expensesStatusCell.textContent = 'Under budget';
        expensesStatusCell.className = 'status-cell status-under';
      } else if (totalExpensesVnd > targetVnd + threshold) {
        expensesStatusCell.textContent = 'Over budget';
        expensesStatusCell.className = 'status-cell status-over';
      } else {
        expensesStatusCell.textContent = 'On target';
        expensesStatusCell.className = 'status-cell status-on';
      }
    }
  }

  const plannedSavingsBucketsNative = fromVnd(plannedGoalsVnd, incomeCode);
  return {
    totalPercent: validation.totalPercent,
    plannedSavingsBucketsVnd: plannedGoalsVnd,
    plannedSavingsBucketsNative: Number.isFinite(plannedSavingsBucketsNative)
      ? plannedSavingsBucketsNative
      : 0,
    validation,
  };
}

function setSummaryDualRow(primaryEl, altEl, amountNative, nativeCode, rowKind) {
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();

  if (rowKind === 'income') {
    if (primaryEl) {
      primaryEl.textContent = formatInCurrency(amountNative, incomeCode);
    }
    if (altEl) {
      altEl.textContent = formatConvertDisplay(amountNative, incomeCode, reportingCode);
    }
    return;
  }

  if (rowKind === 'expense') {
    // amountNative is already in reporting currency (or NaN)
    if (primaryEl) {
      primaryEl.textContent = Number.isFinite(amountNative)
        ? formatConvertDisplay(amountNative, reportingCode, incomeCode)
        : '—';
    }
    if (altEl) {
      altEl.textContent = Number.isFinite(amountNative)
        ? formatInCurrency(amountNative, reportingCode)
        : '—';
    }
    return;
  }

  if (rowKind === 'remaining') {
    const vnd = amountNative;
    if (primaryEl) {
      primaryEl.textContent = Number.isFinite(vnd)
        ? formatInCurrency(fromVnd(vnd, incomeCode), incomeCode)
        : '—';
    }
    if (altEl) {
      altEl.textContent = Number.isFinite(vnd)
        ? formatInCurrency(fromVnd(vnd, reportingCode), reportingCode)
        : '—';
    }
  }
}

function updateSummary({
  incomePerMonth,
  incomePerMonthVnd,
  totalFixedReporting,
  totalVariableReporting,
  totalSubsReporting,
  totalExpensesVnd,
  expensesOk,
  plannedSavingsBucketsNative,
}) {
  const incomeCode = getIncomeCurrency();
  const remainingVnd = expensesOk
    ? incomePerMonthVnd - totalExpensesVnd
    : NaN;

  setSummaryDualRow(summaryIncomeEl, summaryIncomeAltEl, incomePerMonth, incomeCode, 'income');
  setSummaryDualRow(
    summaryFixedEl,
    summaryFixedAltEl,
    totalFixedReporting,
    null,
    'expense'
  );
  setSummaryDualRow(
    summaryVariableEl,
    summaryVariableAltEl,
    totalVariableReporting,
    null,
    'expense'
  );
  setSummaryDualRow(
    summarySubsEl,
    summarySubsAltEl,
    totalSubsReporting,
    null,
    'expense'
  );

  const allReporting =
    expensesOk &&
    Number.isFinite(totalFixedReporting) &&
    Number.isFinite(totalVariableReporting) &&
    Number.isFinite(totalSubsReporting)
      ? totalFixedReporting + totalVariableReporting + totalSubsReporting
      : NaN;

  setSummaryDualRow(
    summaryAllExpensesEl,
    summaryAllExpensesAltEl,
    allReporting,
    null,
    'expense'
  );
  setSummaryDualRow(
    summaryRemainingEl,
    summaryRemainingAltEl,
    remainingVnd,
    'VND',
    'remaining'
  );
  setSummaryDualRow(
    summaryPlannedGoalsEl,
    summaryPlannedGoalsAltEl,
    plannedSavingsBucketsNative,
    incomeCode,
    'income'
  );

  summaryStatusTextEl.classList.remove('badge-good', 'badge-bad', 'badge-neutral');

  if (!incomePerMonthVnd || incomePerMonthVnd <= 0) {
    summaryStatusTextEl.textContent = 'Enter income to see status';
    summaryStatusTextEl.classList.add('badge-neutral');
    return;
  }

  if (!expensesOk) {
    summaryStatusTextEl.textContent =
      'Exchange rates needed to combine mixed-currency expenses';
    summaryStatusTextEl.classList.add('badge-neutral');
    return;
  }

  const plannedSavingsVnd = toVnd(plannedSavingsBucketsNative, incomeCode);

  if (remainingVnd < 0) {
    summaryStatusTextEl.textContent = 'You are over budget (expenses > income)';
    summaryStatusTextEl.classList.add('badge-bad');
  } else if (
    Number.isFinite(plannedSavingsVnd) &&
    plannedSavingsVnd > remainingVnd + Math.max(1, remainingVnd * 0.001)
  ) {
    summaryStatusTextEl.textContent =
      'Goals plan is higher than what is left after expenses';
    summaryStatusTextEl.classList.add('badge-bad');
  } else if (
    Number.isFinite(plannedSavingsVnd) &&
    plannedSavingsVnd < remainingVnd - Math.max(1, remainingVnd * 0.001)
  ) {
    summaryStatusTextEl.textContent =
      'You have unallocated money left after expenses & goals';
    summaryStatusTextEl.classList.add('badge-neutral');
  } else {
    summaryStatusTextEl.textContent = 'Your plan balances with your income';
    summaryStatusTextEl.classList.add('badge-good');
  }
}

function fillBreakdownCells(prefix, monthlyNative, currencyCode, ok = true) {
  const monthlyToDaily = (m) => (m * 12) / 365;
  const monthlyToWeekly = (m) => (m * 12) / 52;
  const monthlyToAnnual = (m) => m * 12;

  const dailyEl = document.getElementById(`${prefix}Daily`);
  const weeklyEl = document.getElementById(`${prefix}Weekly`);
  const monthlyEl = document.getElementById(`${prefix}Monthly`);
  const annualEl = document.getElementById(`${prefix}Annual`);

  if (!ok || !Number.isFinite(monthlyNative)) {
    if (monthlyEl) monthlyEl.textContent = '—';
    if (dailyEl) dailyEl.textContent = '—';
    if (weeklyEl) weeklyEl.textContent = '—';
    if (annualEl) annualEl.textContent = '—';
    return;
  }

  if (monthlyEl) monthlyEl.textContent = formatInCurrency(monthlyNative, currencyCode);
  if (dailyEl) {
    dailyEl.textContent = formatInCurrency(monthlyToDaily(monthlyNative), currencyCode);
  }
  if (weeklyEl) {
    weeklyEl.textContent = formatInCurrency(monthlyToWeekly(monthlyNative), currencyCode);
  }
  if (annualEl) {
    annualEl.textContent = formatInCurrency(monthlyToAnnual(monthlyNative), currencyCode);
  }
}

function updateBreakdown({
  incomePerMonth,
  totalFixedReporting,
  totalVariableReporting,
  totalSubsReporting,
  allExpensesReporting,
  plannedSavingsBucketsNative,
  incomePerMonthVnd,
  totalExpensesVnd,
  expensesOk,
}) {
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();
  const netVnd = expensesOk ? incomePerMonthVnd - totalExpensesVnd : NaN;
  const netIncome = fromVnd(netVnd, incomeCode);
  const netReporting = fromVnd(netVnd, reportingCode);

  fillBreakdownCells('bdIncome', incomePerMonth, incomeCode, true);
  fillBreakdownCells('bdFixed', totalFixedReporting, reportingCode, expensesOk);
  fillBreakdownCells(
    'bdVariable',
    totalVariableReporting,
    reportingCode,
    expensesOk
  );
  fillBreakdownCells('bdSubs', totalSubsReporting, reportingCode, expensesOk);
  fillBreakdownCells('bdAll', allExpensesReporting, reportingCode, expensesOk);
  fillBreakdownCells('bdGoals', plannedSavingsBucketsNative, incomeCode, true);

  const setNet = (el, value) => {
    if (!el) return;
    el.textContent = Number.isFinite(value)
      ? formatInCurrency(value, incomeCode)
      : '—';
  };
  setNet(bdNetDailyEl, Number.isFinite(netIncome) ? (netIncome * 12) / 365 : NaN);
  setNet(bdNetWeeklyEl, Number.isFinite(netIncome) ? (netIncome * 12) / 52 : NaN);
  setNet(bdNetMonthlyEl, netIncome);
  setNet(bdNetAnnualEl, Number.isFinite(netIncome) ? netIncome * 12 : NaN);

  if (bdNetAltHintEl) {
    if (currenciesDiffer() && Number.isFinite(netReporting)) {
      bdNetAltHintEl.textContent = `Net in ${reportingCode}: ${formatInCurrency(netReporting, reportingCode)} monthly (${formatInCurrency(netReporting * 12, reportingCode)} annual)`;
    } else {
      bdNetAltHintEl.textContent = '';
    }
  }
}

function updateChart({
  totalFixedVnd,
  totalVariableVnd,
  totalSubsVnd,
  plannedSavingsBucketsVnd,
  incomePerMonthVnd,
  expensesOk,
}) {
  const fixedVnd = expensesOk && Number.isFinite(totalFixedVnd) ? totalFixedVnd : 0;
  const variableVnd =
    expensesOk && Number.isFinite(totalVariableVnd) ? totalVariableVnd : 0;
  const subsVnd = expensesOk && Number.isFinite(totalSubsVnd) ? totalSubsVnd : 0;
  const allExpensesVnd = fixedVnd + variableVnd + subsVnd;
  const remainingAfterAll =
    incomePerMonthVnd - allExpensesVnd - plannedSavingsBucketsVnd;

  const labels = [
    'Fixed expenses',
    'Variable expenses',
    'Subscriptions',
    'Goals',
    'Unallocated',
  ];
  const data = [
    Math.max(fixedVnd, 0),
    Math.max(variableVnd, 0),
    Math.max(subsVnd, 0),
    Math.max(plannedSavingsBucketsVnd, 0),
    Math.max(remainingAfterAll, 0),
  ];

  if (!chartInstance) {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: CHART_COLORS,
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                family: "'Plus Jakarta Sans', system-ui, sans-serif",
                size: 12,
              },
            },
          },
        },
        cutout: '60%',
      },
    });
  } else {
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
  }
}

function formatAggTotal(agg) {
  if (!agg.ok || !Number.isFinite(agg.totalReporting)) return '—';
  return formatInCurrency(agg.totalReporting, getReportingCurrency());
}

function recomputeAll() {
  const { perMonth: incomePerMonth, perMonthVnd: incomePerMonthVnd } = updateIncome();
  const incomeCode = getIncomeCurrency();
  const reportingCode = getReportingCurrency();

  const fixedAgg = aggregateTable(fixedExpensesBody);
  const variableAgg = aggregateTable(variableExpensesBody);
  const subsAgg = aggregateTable(subscriptionsBody);

  const expensesOk = fixedAgg.ok && variableAgg.ok && subsAgg.ok;
  const totalExpensesVnd = expensesOk
    ? fixedAgg.totalVnd + variableAgg.totalVnd + subsAgg.totalVnd
    : NaN;

  if (totalFixedMonthlyEl) totalFixedMonthlyEl.textContent = formatAggTotal(fixedAgg);
  if (totalVariableMonthlyEl) {
    totalVariableMonthlyEl.textContent = formatAggTotal(variableAgg);
  }
  if (totalSubsMonthlyEl) totalSubsMonthlyEl.textContent = formatAggTotal(subsAgg);

  const { plannedSavingsBucketsVnd, plannedSavingsBucketsNative } = updatePercentages(
    incomePerMonthVnd,
    Number.isFinite(totalExpensesVnd) ? totalExpensesVnd : 0,
    expensesOk
  );

  updateSummary({
    incomePerMonth,
    incomePerMonthVnd,
    totalFixedReporting: fixedAgg.totalReporting,
    totalVariableReporting: variableAgg.totalReporting,
    totalSubsReporting: subsAgg.totalReporting,
    totalExpensesVnd: Number.isFinite(totalExpensesVnd) ? totalExpensesVnd : 0,
    expensesOk,
    plannedSavingsBucketsNative,
  });

  const allReporting = expensesOk
    ? fixedAgg.totalReporting +
      variableAgg.totalReporting +
      subsAgg.totalReporting
    : NaN;

  updateBreakdown({
    incomePerMonth,
    totalFixedReporting: fixedAgg.totalReporting,
    totalVariableReporting: variableAgg.totalReporting,
    totalSubsReporting: subsAgg.totalReporting,
    allExpensesReporting: allReporting,
    plannedSavingsBucketsNative,
    incomePerMonthVnd,
    totalExpensesVnd: Number.isFinite(totalExpensesVnd) ? totalExpensesVnd : 0,
    expensesOk,
  });

  updateChart({
    incomePerMonthVnd,
    totalFixedVnd: fixedAgg.totalVnd,
    totalVariableVnd: variableAgg.totalVnd,
    totalSubsVnd: subsAgg.totalVnd,
    plannedSavingsBucketsVnd,
    expensesOk,
  });

  if (totalFixedEquivEl) {
    totalFixedEquivEl.textContent =
      expensesOk && Number.isFinite(fixedAgg.totalReporting)
        ? formatConvertDisplay(fixedAgg.totalReporting, reportingCode, incomeCode)
        : '—';
  }
  if (totalVariableEquivEl) {
    totalVariableEquivEl.textContent =
      expensesOk && Number.isFinite(variableAgg.totalReporting)
        ? formatConvertDisplay(
            variableAgg.totalReporting,
            reportingCode,
            incomeCode
          )
        : '—';
  }
  if (totalSubsEquivEl) {
    totalSubsEquivEl.textContent =
      expensesOk && Number.isFinite(subsAgg.totalReporting)
        ? formatConvertDisplay(subsAgg.totalReporting, reportingCode, incomeCode)
        : '—';
  }

  refreshExpenseTableDisplay(fixedExpensesBody);
  refreshExpenseTableDisplay(variableExpensesBody);
  refreshExpenseTableDisplay(subscriptionsBody);

  updateCurrencyHeaders();
  updateRateHints();
}

function onCurrencyChange() {
  saveCurrencyPreferences();
  // Reporting / income currency change must NOT reinterpret native expense amounts.
  updateCurrencyHeaders();
  if (salaryAmountInput && salaryAmountInput.formatAmountValue) {
    salaryAmountInput.formatAmountValue();
  }
  recomputeAll();
}

if (addFixedExpenseBtn) {
  addFixedExpenseBtn.addEventListener('click', () => {
    createExpenseRow(fixedExpensesBody);
  });
}
if (addVariableExpenseBtn) {
  addVariableExpenseBtn.addEventListener('click', () => {
    createExpenseRow(variableExpensesBody);
  });
}
if (addSubscriptionBtn) {
  addSubscriptionBtn.addEventListener('click', () => {
    createExpenseRow(subscriptionsBody);
  });
}
if (addSplitCategoryBtn) {
  addSplitCategoryBtn.addEventListener('click', addSplitCategory);
}

attachAmountInputFormatting(
  salaryAmountInput,
  () => getCurrencyMeta(getIncomeCurrency()).decimals
);

if (salaryAmountInput) {
  salaryAmountInput.addEventListener('input', recomputeAll);
}
if (salaryFrequencySelect) {
  salaryFrequencySelect.addEventListener('change', recomputeAll);
}
if (incomeCurrencySelect) {
  incomeCurrencySelect.addEventListener('change', onCurrencyChange);
}
if (expenseCurrencySelect) {
  expenseCurrencySelect.addEventListener('change', onCurrencyChange);
}

function getScenariosStore() {
  try {
    const raw = localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return { scenarios: [] };
    return JSON.parse(raw);
  } catch (e) {
    return { scenarios: [] };
  }
}

function saveScenariosStore(store) {
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    setScenarioStatus('Could not save (storage blocked).');
  }
}

function setScenarioStatus(msg) {
  if (scenarioStatusEl) scenarioStatusEl.textContent = msg || '';
}

function collectScenarioData() {
  syncSplitsFromDom();
  const rowsFrom = (tbody) => {
    const out = [];
    if (!tbody) return out;
    tbody.querySelectorAll('tr.expense-row').forEach((tr) => {
      const nameInput = tr.querySelector('.expense-name-input');
      const freqSelect = tr.querySelector('.expense-freq-select');
      const currencySelect = tr.querySelector('.expense-currency-select');
      const amtInput = tr.querySelector('.expense-amount-input');
      if (!nameInput || !freqSelect || !amtInput) return;
      out.push({
        name: nameInput.value,
        frequency: freqSelect.value,
        amount: amtInput.value,
        currency:
          (currencySelect && currencySelect.value) || getReportingCurrency(),
      });
    });
    return out;
  };

  return {
    salaryAmount: salaryAmountInput.value,
    salaryFrequency: salaryFrequencySelect.value,
    incomeCurrency: getIncomeCurrency(),
    expenseCurrency: getReportingCurrency(),
    fixed: rowsFrom(fixedExpensesBody),
    variable: rowsFrom(variableExpensesBody),
    subs: rowsFrom(subscriptionsBody),
    splits: currentSplits.map((s) => ({ ...s })),
  };
}

function updateScenarioHint(hasScenarios, isCreating) {
  if (!scenarioSectionHint) return;
  if (!hasScenarios) {
    scenarioSectionHint.textContent =
      'Name your first budget scenario. Stored in this browser only.';
  } else if (isCreating) {
    scenarioSectionHint.textContent =
      'Name your new scenario. Stored in this browser only.';
  } else {
    scenarioSectionHint.textContent =
      'Pick a saved scenario or create a new one. Stored in this browser only.';
  }
}

function updateScenarioDeleteState() {
  if (!scenarioDeleteBtn || !scenarioLoadSelect) return;
  scenarioDeleteBtn.disabled = !scenarioLoadSelect.value;
}

function refreshScenarioUI(options = {}) {
  const store = getScenariosStore();
  const hasScenarios = store.scenarios.length > 0;
  const { selectId } = options;

  if (scenarioLoadSelect) {
    const previous = scenarioLoadSelect.value;
    scenarioLoadSelect.innerHTML = '<option value="">Pick a scenario…</option>';
    store.scenarios.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      scenarioLoadSelect.appendChild(opt);
    });

    if (selectId) {
      scenarioLoadSelect.value = selectId;
    } else if (
      hasScenarios &&
      previous &&
      store.scenarios.some((s) => s.id === previous)
    ) {
      scenarioLoadSelect.value = previous;
    } else if (hasScenarios) {
      scenarioLoadSelect.value = store.scenarios[store.scenarios.length - 1].id;
    }
  }

  if (scenarioPickerPanel) {
    scenarioPickerPanel.hidden = !hasScenarios || scenarioCreateMode;
  }
  if (scenarioCreatePanel) {
    scenarioCreatePanel.hidden = hasScenarios && !scenarioCreateMode;
  }
  if (scenarioCancelBtn) {
    scenarioCancelBtn.hidden = !hasScenarios || !scenarioCreateMode;
  }

  updateScenarioHint(hasScenarios, scenarioCreateMode);
  updateScenarioDeleteState();
}

function showCreateScenario() {
  scenarioCreateMode = true;
  refreshScenarioUI();
  if (scenarioNameInput) {
    scenarioNameInput.value = '';
    scenarioNameInput.focus();
  }
  setScenarioStatus('');
}

function cancelCreateScenario() {
  scenarioCreateMode = false;
  refreshScenarioUI();
  setScenarioStatus('');
}

function saveScenario() {
  const name = (scenarioNameInput && scenarioNameInput.value.trim()) || '';
  if (!name) {
    setScenarioStatus('Enter a name before creating.');
    return;
  }
  const store = getScenariosStore();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}`;
  store.scenarios.push({
    id,
    name,
    savedAt: new Date().toISOString(),
    data: collectScenarioData(),
  });
  saveScenariosStore(store);
  scenarioCreateMode = false;
  if (scenarioNameInput) scenarioNameInput.value = '';
  refreshScenarioUI({ selectId: id });
  loadSelectedScenario({ isCreate: true });
}

function loadSelectedScenario(options = {}) {
  const id = scenarioLoadSelect && scenarioLoadSelect.value;
  if (!id) {
    updateScenarioDeleteState();
    if (!options.silent) setScenarioStatus('');
    return;
  }
  const store = getScenariosStore();
  const sc = store.scenarios.find((s) => s.id === id);
  if (!sc || !sc.data) {
    setScenarioStatus('Scenario not found.');
    return;
  }
  applyScenarioData(sc.data);
  const savedAt = sc.savedAt ? new Date(sc.savedAt).toLocaleString() : '';
  if (options.isCreate) {
    setScenarioStatus(`Created “${sc.name}”.`);
  } else if (options.silent) {
    setScenarioStatus('');
  } else if (savedAt) {
    setScenarioStatus(`Loaded “${sc.name}” (saved ${savedAt}).`);
  } else {
    setScenarioStatus(`Loaded “${sc.name}”.`);
  }
  updateScenarioDeleteState();
}

function deleteSelectedScenario() {
  const id = scenarioLoadSelect && scenarioLoadSelect.value;
  if (!id) {
    setScenarioStatus('Pick a scenario to delete.');
    return;
  }
  const store = getScenariosStore();
  const before = store.scenarios.length;
  store.scenarios = store.scenarios.filter((s) => s.id !== id);
  if (store.scenarios.length === before) {
    setScenarioStatus('Could not delete.');
    return;
  }
  saveScenariosStore(store);
  scenarioCreateMode = false;
  if (store.scenarios.length > 0) {
    const latest = store.scenarios[store.scenarios.length - 1];
    refreshScenarioUI({ selectId: latest.id });
    loadSelectedScenario();
    setScenarioStatus('Deleted.');
  } else {
    refreshScenarioUI();
    setScenarioStatus('');
  }
}

function applyScenarioData(rawData) {
  const data = Core ? Core.migrateScenarioData(rawData) : rawData;
  if (!data) return;

  salaryAmountInput.value = data.salaryAmount ?? '';
  if (salaryAmountInput.formatAmountValue) salaryAmountInput.formatAmountValue();
  salaryFrequencySelect.value = data.salaryFrequency || 'monthly';

  let incomeCode = data.incomeCurrency;
  let expenseCode = data.expenseCurrency;
  if (!isSupportedCurrency(incomeCode)) incomeCode = DEFAULT_INCOME_CURRENCY;
  if (!isSupportedCurrency(expenseCode)) expenseCode = DEFAULT_EXPENSE_CURRENCY;

  if (incomeCurrencySelect) incomeCurrencySelect.value = incomeCode;
  if (expenseCurrencySelect) expenseCurrencySelect.value = expenseCode;
  saveCurrencyPreferences();

  function fillTable(tbody, rows) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows && rows.length) {
      rows.forEach((r) => {
        createExpenseRow(tbody, {
          name: r.name || '',
          frequency: r.frequency || 'monthly',
          currency: r.currency || expenseCode,
          amount:
            r.amount !== undefined && r.amount !== ''
              ? parseAmount(r.amount)
              : undefined,
        });
      });
    } else {
      createExpenseRow(tbody, { currency: expenseCode });
    }
  }

  fillTable(fixedExpensesBody, data.fixed);
  fillTable(variableExpensesBody, data.variable);
  fillTable(subscriptionsBody, data.subs);

  currentSplits = (data.splits || []).map((s) => ({ ...s }));
  if (!currentSplits.length && Core) {
    currentSplits = Core.cloneDefaultSplits();
  }
  renderBudgetSplits();
  recomputeAll();
}

function initScenarioUI() {
  refreshScenarioUI();
  if (scenarioLoadSelect && scenarioLoadSelect.value) {
    loadSelectedScenario({ silent: true });
  }
}

function seedDefaultRows() {
  if (fixedExpensesBody && fixedExpensesBody.children.length === 0) {
    [
      'Rent / Mortgage',
      'Groceries',
      'Electricity',
      'Internet',
      'Water',
      'Mobile phone',
    ].forEach((name) => {
      createExpenseRow(fixedExpensesBody, { name, frequency: 'monthly' });
    });
  }
  if (variableExpensesBody && variableExpensesBody.children.length === 0) {
    ['Dining out', 'Entertainment', 'Transport (pay-as-you-go)'].forEach(
      (name) => {
        createExpenseRow(variableExpensesBody, { name, frequency: 'monthly' });
      }
    );
  }
  if (subscriptionsBody && subscriptionsBody.children.length === 0) {
    ['TV streaming', 'Music streaming', 'Gym membership'].forEach((name) => {
      createExpenseRow(subscriptionsBody, { name, frequency: 'monthly' });
    });
  }
}

populateCurrencySelects();
renderBudgetSplits();
initScenarioUI();

const store = getScenariosStore();
if (!store.scenarios.length) {
  seedDefaultRows();
}

updateCurrencyHeaders();
recomputeAll();
loadExchangeRates();

if (scenarioSaveBtn) scenarioSaveBtn.addEventListener('click', saveScenario);
if (scenarioNewBtn) scenarioNewBtn.addEventListener('click', showCreateScenario);
if (scenarioCancelBtn) {
  scenarioCancelBtn.addEventListener('click', cancelCreateScenario);
}
if (scenarioLoadSelect) {
  scenarioLoadSelect.addEventListener('change', () => loadSelectedScenario());
}
if (scenarioDeleteBtn) {
  scenarioDeleteBtn.addEventListener('click', deleteSelectedScenario);
}
