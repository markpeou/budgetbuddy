const salaryAmountInput = document.getElementById('salaryAmount');
const salaryFrequencySelect = document.getElementById('salaryFrequency');
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

const bdIncomeDailyEl = document.getElementById('bdIncomeDaily');
const bdIncomeWeeklyEl = document.getElementById('bdIncomeWeekly');
const bdIncomeMonthlyEl = document.getElementById('bdIncomeMonthly');
const bdIncomeAnnualEl = document.getElementById('bdIncomeAnnual');

const bdFixedDailyEl = document.getElementById('bdFixedDaily');
const bdFixedWeeklyEl = document.getElementById('bdFixedWeekly');
const bdFixedMonthlyEl = document.getElementById('bdFixedMonthly');
const bdFixedAnnualEl = document.getElementById('bdFixedAnnual');

const bdVariableDailyEl = document.getElementById('bdVariableDaily');
const bdVariableWeeklyEl = document.getElementById('bdVariableWeekly');
const bdVariableMonthlyEl = document.getElementById('bdVariableMonthly');
const bdVariableAnnualEl = document.getElementById('bdVariableAnnual');

const bdSubsDailyEl = document.getElementById('bdSubsDaily');
const bdSubsWeeklyEl = document.getElementById('bdSubsWeekly');
const bdSubsMonthlyEl = document.getElementById('bdSubsMonthly');
const bdSubsAnnualEl = document.getElementById('bdSubsAnnual');

const bdAllDailyEl = document.getElementById('bdAllDaily');
const bdAllWeeklyEl = document.getElementById('bdAllWeekly');
const bdAllMonthlyEl = document.getElementById('bdAllMonthly');
const bdAllAnnualEl = document.getElementById('bdAllAnnual');

const bdGoalsDailyEl = document.getElementById('bdGoalsDaily');
const bdGoalsWeeklyEl = document.getElementById('bdGoalsWeekly');
const bdGoalsMonthlyEl = document.getElementById('bdGoalsMonthly');
const bdGoalsAnnualEl = document.getElementById('bdGoalsAnnual');

const bdNetDailyEl = document.getElementById('bdNetDaily');
const bdNetWeeklyEl = document.getElementById('bdNetWeekly');
const bdNetMonthlyEl = document.getElementById('bdNetMonthly');
const bdNetAnnualEl = document.getElementById('bdNetAnnual');

const percentageInputs = document.querySelectorAll('.percentage-input');

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

const SCENARIO_STORAGE_KEY = 'budgetPlannerScenarios_v1';
const INCOME_CURRENCY_STORAGE_KEY = 'budgetPlannerIncomeCurrency_v1';
const EXPENSE_CURRENCY_STORAGE_KEY = 'budgetPlannerExpenseCurrency_v1';

const DEFAULT_INCOME_CURRENCY = 'USD';
const DEFAULT_EXPENSE_CURRENCY = 'VND';

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
  [fixedExpensesBody, variableExpensesBody, subscriptionsBody].forEach((tbody) => {
    if (!tbody) return;
    tbody.querySelectorAll('td:nth-child(3) input.amount-input').forEach((inp) => {
      if (inp.formatAmountValue) inp.formatAmountValue();
    });
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

function getExpenseCurrency() {
  const code = expenseCurrencySelect && expenseCurrencySelect.value;
  return isSupportedCurrency(code) ? code : DEFAULT_EXPENSE_CURRENCY;
}

function currenciesDiffer() {
  return getIncomeCurrency() !== getExpenseCurrency();
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

function getVndRate(code) {
  if (code === 'VND') return 1;
  if (!vndRatesCache) return null;
  const perVnd = vndRatesCache[code];
  if (perVnd == null || !Number.isFinite(perVnd) || perVnd <= 0) return null;
  return perVnd;
}

function toVnd(amount, code) {
  if (!Number.isFinite(amount)) return NaN;
  if (code === 'VND') return amount;
  const perVnd = getVndRate(code);
  if (perVnd == null) return NaN;
  return amount / perVnd;
}

function fromVnd(vndAmount, code) {
  if (!Number.isFinite(vndAmount)) return NaN;
  if (code === 'VND') return vndAmount;
  const perVnd = getVndRate(code);
  if (perVnd == null) return NaN;
  return vndAmount * perVnd;
}

function convert(amount, fromCode, toCode) {
  if (!Number.isFinite(amount)) return NaN;
  if (fromCode === toCode) return amount;
  const vnd = toVnd(amount, fromCode);
  if (!Number.isFinite(vnd)) return NaN;
  return fromVnd(vnd, toCode);
}

function formatConvertDisplay(amount, fromCode, toCode) {
  if (!Number.isFinite(amount)) return '—';
  if (fromCode === toCode) return formatInCurrency(amount, toCode);
  const converted = convert(amount, fromCode, toCode);
  if (!Number.isFinite(converted)) return '—';
  return formatInCurrency(converted, toCode);
}

function saveCurrencyPreferences() {
  try {
    localStorage.setItem(INCOME_CURRENCY_STORAGE_KEY, getIncomeCurrency());
    localStorage.setItem(EXPENSE_CURRENCY_STORAGE_KEY, getExpenseCurrency());
  } catch (e) {
    /* ignore */
  }
}

function populateCurrencySelects() {
  [incomeCurrencySelect, expenseCurrencySelect].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = '';
    SUPPORTED_CURRENCIES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} — ${c.name}`;
      sel.appendChild(opt);
    });
  });

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

  if (incomeCurrencySelect) incomeCurrencySelect.value = incomeCode;
  if (expenseCurrencySelect) expenseCurrencySelect.value = expenseCode;
}

function updateDualColumnVisibility() {
  const showAlt = currenciesDiffer();
  document.querySelectorAll('[data-dual-col="equiv"]').forEach((el) => {
    el.hidden = !showAlt;
  });
  if (incomePerMonthAltEl) incomePerMonthAltEl.hidden = !showAlt;
  if (bdNetAltHintEl) bdNetAltHintEl.hidden = !showAlt;
}

function updateCurrencyHeaders() {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();
  const incomeMeta = getCurrencyMeta(incomeCode);
  const expenseMeta = getCurrencyMeta(expenseCode);

  if (fixedMonthlyHeadEl) fixedMonthlyHeadEl.textContent = `Monthly (${expenseCode})`;
  if (variableMonthlyHeadEl) {
    variableMonthlyHeadEl.textContent = `Monthly (${expenseCode})`;
  }
  if (subsMonthlyHeadEl) subsMonthlyHeadEl.textContent = `Monthly (${expenseCode})`;

  const equivLabel = currenciesDiffer() ? `Equiv. (${incomeCode})` : 'Equiv.';
  if (fixedEquivHeadEl) fixedEquivHeadEl.textContent = equivLabel;
  if (variableEquivHeadEl) variableEquivHeadEl.textContent = equivLabel;
  if (subsEquivHeadEl) subsEquivHeadEl.textContent = equivLabel;

  if (splitIncomeHeadEl) {
    splitIncomeHeadEl.textContent = `Monthly (${incomeCode})`;
  }
  if (splitExpenseHeadEl) {
    splitExpenseHeadEl.textContent = currenciesDiffer()
      ? `Monthly (${expenseCode})`
      : 'Monthly';
  }

  if (summaryIncomeHeadEl) summaryIncomeHeadEl.textContent = `Income (${incomeCode})`;
  if (summaryExpenseHeadEl) {
    summaryExpenseHeadEl.textContent = currenciesDiffer()
      ? `Expenses (${expenseCode})`
      : 'Expenses';
  }

  if (salaryAmountInput) {
    salaryAmountInput.placeholder = `Salary amount (${incomeMeta.symbol})`;
  }

  if (incomeHintEl) {
    if (currenciesDiffer()) {
      incomeHintEl.textContent = `Enter salary in ${incomeMeta.name} (${incomeCode}). The line under “Per month” shows the same figure in ${expenseMeta.name} (${expenseCode}).`;
    } else {
      incomeHintEl.textContent = `Enter salary and expenses in ${incomeMeta.name} (${incomeCode}).`;
    }
  }

  updateDualColumnVisibility();
}

function updateRateHints() {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();

  if (ratesMetaEl) {
    if (ratesLoading) {
      ratesMetaEl.textContent = 'Loading exchange rates…';
    } else if (!vndRatesCache) {
      ratesMetaEl.textContent =
        'Exchange rates unavailable — converted columns show “—”. Check your internet connection.';
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
      expenseRateHintEl.textContent = 'Rates needed for cross-currency summary.';
    } else {
      const oneIncomeInExpense = convert(1, incomeCode, expenseCode);
      if (Number.isFinite(oneIncomeInExpense)) {
        expenseRateHintEl.textContent = `1 ${incomeCode} ≈ ${formatInCurrency(oneIncomeInExpense, expenseCode)}`;
      } else {
        expenseRateHintEl.textContent = '';
      }
    }
  }
}

function refreshExpenseTableEquiv(tbody) {
  if (!tbody) return;
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();
  tbody.querySelectorAll('tr').forEach((tr) => {
    const amountInput = tr.querySelector('td:nth-child(3) input');
    const freqSelect = tr.querySelector('td:nth-child(2) select');
    const monthlyEl = tr.querySelector('td:nth-child(4) strong');
    const equivEl = tr.querySelector('td:nth-child(5) .equiv-amount');
    if (!amountInput || !freqSelect || !monthlyEl) return;
    const monthly = frequencyToMonthly(
      parseAmount(amountInput.value),
      freqSelect.value
    );
    monthlyEl.textContent = formatInCurrency(monthly, expenseCode);
    if (equivEl) {
      equivEl.textContent = formatConvertDisplay(monthly, expenseCode, incomeCode);
    }
  });
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

function frequencyToMonthly(amount, frequency) {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'fortnightly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'annually':
      return amount / 12;
    default:
      return amount;
  }
}

function updateIncome() {
  const amount = parseAmount(salaryAmountInput.value);
  const frequency = salaryFrequencySelect.value;
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();

  let weekly;
  switch (frequency) {
    case 'weekly':
      weekly = amount;
      break;
    case 'fortnightly':
      weekly = (amount * 26) / 52;
      break;
    case 'monthly':
      weekly = (amount * 12) / 52;
      break;
    case 'annually':
      weekly = amount / 52;
      break;
    default:
      weekly = 0;
  }

  const perDay = weekly / 7;
  const perMonth = (weekly * 52) / 12;

  incomePerDayEl.textContent = formatInCurrency(perDay, incomeCode);
  incomePerWeekEl.textContent = formatInCurrency(weekly, incomeCode);
  incomePerMonthEl.textContent = formatInCurrency(perMonth, incomeCode);

  if (incomePerMonthAltEl) {
    incomePerMonthAltEl.textContent = formatConvertDisplay(
      perMonth,
      incomeCode,
      expenseCode
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

  const nameTd = document.createElement('td');
  nameTd.dataset.label = 'Item';
  const nameWrap = document.createElement('div');
  nameWrap.className = 'input-wrap';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'cell-input';
  nameInput.placeholder = 'e.g. Rent';
  if (defaults.name) nameInput.value = defaults.name;
  nameWrap.appendChild(nameInput);
  nameTd.appendChild(nameWrap);

  const freqTd = document.createElement('td');
  freqTd.dataset.label = 'Frequency';
  const freqWrap = document.createElement('div');
  freqWrap.className = 'input-wrap';
  const freqSelect = document.createElement('select');
  freqSelect.className = 'cell-input';
  freqSelect.innerHTML = `
    <option value="weekly">Weekly</option>
    <option value="fortnightly">Fortnightly</option>
    <option value="monthly" selected>Monthly</option>
    <option value="quarterly">Quarterly</option>
    <option value="annually">Annually</option>
  `;
  if (defaults.frequency) freqSelect.value = defaults.frequency;
  freqWrap.appendChild(freqSelect);
  freqTd.appendChild(freqWrap);

  const amountTd = document.createElement('td');
  amountTd.dataset.label = 'Amount';
  const amountWrap = document.createElement('div');
  amountWrap.className = 'input-wrap';
  const amountInput = document.createElement('input');
  amountInput.className = 'cell-input';
  amountInput.placeholder = '0';
  if (defaults.amount !== undefined && defaults.amount !== '') {
    amountInput.value = String(defaults.amount);
  }
  attachAmountInputFormatting(
    amountInput,
    () => getCurrencyMeta(getExpenseCurrency()).decimals
  );
  if (amountInput.value) amountInput.formatAmountValue();
  amountWrap.appendChild(amountInput);
  amountTd.appendChild(amountWrap);

  const monthlyTd = document.createElement('td');
  monthlyTd.className = 'align-right';
  monthlyTd.dataset.label = 'Monthly';
  const monthlyStrong = document.createElement('strong');
  monthlyStrong.textContent = formatInCurrency(0, getExpenseCurrency());
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
  tr.appendChild(amountTd);
  tr.appendChild(monthlyTd);
  tr.appendChild(foreignTd);
  tr.appendChild(removeTd);

  function recalcRow() {
    const expenseCode = getExpenseCurrency();
    const incomeCode = getIncomeCurrency();
    const amount = parseAmount(amountInput.value);
    const frequency = freqSelect.value;
    const monthly = frequencyToMonthly(amount, frequency);
    monthlyStrong.textContent = formatInCurrency(monthly, expenseCode);
    equivStrong.textContent = formatConvertDisplay(monthly, expenseCode, incomeCode);
    recomputeAll();
  }

  amountInput.addEventListener('input', recalcRow);
  freqSelect.addEventListener('change', recalcRow);
  removeBtn.addEventListener('click', () => {
    tr.remove();
    recomputeAll();
  });

  tbody.appendChild(tr);
  recalcRow();
}

function sumMonthlyFromTable(tbody) {
  let total = 0;
  tbody.querySelectorAll('tr').forEach((tr) => {
    const amountInput = tr.querySelector('td:nth-child(3) input');
    const freqSelect = tr.querySelector('td:nth-child(2) select');
    if (!amountInput || !freqSelect) return;
    const amount = parseAmount(amountInput.value);
    const frequency = freqSelect.value;
    total += frequencyToMonthly(amount, frequency);
  });
  return total;
}

function updatePercentages(incomePerMonthVnd, totalExpensesNative, totalExpensesVnd) {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();
  let totalPercent = 0;
  let plannedSavingsBucketsVnd = 0;

  percentageInputs.forEach((input) => {
    const raw = parseAmount(input.value);
    const safePercent = Math.max(0, Math.min(100, raw));
    if (safePercent !== raw) {
      input.value = safePercent.toString();
    }
    totalPercent += safePercent;

    const key = input.dataset.percentageInput;
    const monthlyTargetVnd = (incomePerMonthVnd * safePercent) / 100;
    const monthlyTargetIncome = fromVnd(monthlyTargetVnd, incomeCode);

    const amountEl = document.querySelector(
      `.split-amount[data-split-amount="${key}"]`
    );
    if (amountEl) {
      amountEl.textContent = Number.isFinite(monthlyTargetIncome)
        ? formatInCurrency(monthlyTargetIncome, incomeCode)
        : '—';
    }

    const splitAlt = document.querySelector(`[data-split-foreign="${key}"]`);
    if (splitAlt) {
      splitAlt.textContent = Number.isFinite(monthlyTargetVnd)
        ? formatInCurrency(fromVnd(monthlyTargetVnd, expenseCode), expenseCode)
        : '—';
    }

    if (key === 'savings' || key === 'emergency' || key === 'investments') {
      plannedSavingsBucketsVnd += monthlyTargetVnd;
    }
  });

  totalPercentageEl.textContent = `${totalPercent.toFixed(0)}%`;
  const totalBudgetedVnd = (incomePerMonthVnd * totalPercent) / 100;
  const totalBudgetedIncome = fromVnd(totalBudgetedVnd, incomeCode);
  totalBudgetedEl.textContent = Number.isFinite(totalBudgetedIncome)
    ? formatInCurrency(totalBudgetedIncome, incomeCode)
    : '—';
  if (totalBudgetedAltEl) {
    totalBudgetedAltEl.textContent = Number.isFinite(totalBudgetedVnd)
      ? formatInCurrency(fromVnd(totalBudgetedVnd, expenseCode), expenseCode)
      : '—';
  }

  const expensesTargetPercentInput = document.querySelector(
    '[data-percentage-input="expenses"]'
  );
  const expensesStatusCell = document.querySelector(
    '[data-status="expenses"]'
  );

  if (expensesTargetPercentInput && expensesStatusCell) {
    const targetPercent = parseAmount(expensesTargetPercentInput.value);
    const targetVnd = (incomePerMonthVnd * targetPercent) / 100;
    const threshold = Math.max(
      1,
      Math.abs(toVnd(1, expenseCode) || 1) * 0.01
    );

    if (!incomePerMonthVnd || incomePerMonthVnd <= 0) {
      expensesStatusCell.textContent = '';
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

  return {
    totalPercent,
    plannedSavingsBucketsVnd,
    plannedSavingsBucketsNative: fromVnd(plannedSavingsBucketsVnd, incomeCode),
  };
}

function setSummaryDualRow(primaryEl, altEl, amountNative, nativeCode, altCode, rowKind) {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();

  if (rowKind === 'income') {
    if (primaryEl) {
      primaryEl.textContent = formatInCurrency(amountNative, incomeCode);
    }
    if (altEl) {
      altEl.textContent = formatConvertDisplay(amountNative, incomeCode, expenseCode);
    }
    return;
  }

  if (rowKind === 'expense') {
    if (primaryEl) {
      primaryEl.textContent = formatConvertDisplay(amountNative, expenseCode, incomeCode);
    }
    if (altEl) {
      altEl.textContent = formatInCurrency(amountNative, expenseCode);
    }
    return;
  }

  if (rowKind === 'remaining') {
    const vnd = toVnd(amountNative, nativeCode);
    if (primaryEl) {
      primaryEl.textContent = Number.isFinite(vnd)
        ? formatInCurrency(fromVnd(vnd, incomeCode), incomeCode)
        : '—';
    }
    if (altEl) {
      altEl.textContent = Number.isFinite(vnd)
        ? formatInCurrency(fromVnd(vnd, expenseCode), expenseCode)
        : '—';
    }
  }
}

function updateSummary({
  incomePerMonth,
  incomePerMonthVnd,
  totalFixedMonthly,
  totalVariableMonthly,
  totalSubsMonthly,
  plannedSavingsBucketsNative,
}) {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();
  const allExpenses = totalFixedMonthly + totalVariableMonthly + totalSubsMonthly;
  const allExpensesVnd = toVnd(allExpenses, expenseCode);
  const remainingVnd = incomePerMonthVnd - allExpensesVnd;

  setSummaryDualRow(
    summaryIncomeEl,
    summaryIncomeAltEl,
    incomePerMonth,
    incomeCode,
    expenseCode,
    'income'
  );
  setSummaryDualRow(
    summaryFixedEl,
    summaryFixedAltEl,
    totalFixedMonthly,
    expenseCode,
    incomeCode,
    'expense'
  );
  setSummaryDualRow(
    summaryVariableEl,
    summaryVariableAltEl,
    totalVariableMonthly,
    expenseCode,
    incomeCode,
    'expense'
  );
  setSummaryDualRow(
    summarySubsEl,
    summarySubsAltEl,
    totalSubsMonthly,
    expenseCode,
    incomeCode,
    'expense'
  );
  setSummaryDualRow(
    summaryAllExpensesEl,
    summaryAllExpensesAltEl,
    allExpenses,
    expenseCode,
    incomeCode,
    'expense'
  );
  setSummaryDualRow(
    summaryRemainingEl,
    summaryRemainingAltEl,
    remainingVnd,
    'VND',
    expenseCode,
    'remaining'
  );
  setSummaryDualRow(
    summaryPlannedGoalsEl,
    summaryPlannedGoalsAltEl,
    plannedSavingsBucketsNative,
    incomeCode,
    expenseCode,
    'income'
  );

  summaryStatusTextEl.classList.remove('badge-good', 'badge-bad', 'badge-neutral');

  if (!incomePerMonthVnd || incomePerMonthVnd <= 0) {
    summaryStatusTextEl.textContent = 'Enter income to see status';
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
      'Savings plan is higher than what is left after expenses';
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

function fillBreakdownCells(prefix, monthlyNative, currencyCode) {
  const monthlyToDaily = (m) => (m * 12) / 365;
  const monthlyToWeekly = (m) => (m * 12) / 52;
  const monthlyToAnnual = (m) => m * 12;

  const dailyEl = document.getElementById(`${prefix}Daily`);
  const weeklyEl = document.getElementById(`${prefix}Weekly`);
  const monthlyEl = document.getElementById(`${prefix}Monthly`);
  const annualEl = document.getElementById(`${prefix}Annual`);

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
  totalFixedMonthly,
  totalVariableMonthly,
  totalSubsMonthly,
  plannedSavingsBucketsNative,
  incomePerMonthVnd,
}) {
  const incomeCode = getIncomeCurrency();
  const expenseCode = getExpenseCurrency();
  const allExpensesMonthly =
    totalFixedMonthly + totalVariableMonthly + totalSubsMonthly;
  const allExpensesVnd = toVnd(allExpensesMonthly, expenseCode);
  const netVnd = incomePerMonthVnd - allExpensesVnd;
  const netIncome = fromVnd(netVnd, incomeCode);
  const netExpense = fromVnd(netVnd, expenseCode);

  fillBreakdownCells('bdIncome', incomePerMonth, incomeCode);
  fillBreakdownCells('bdFixed', totalFixedMonthly, expenseCode);
  fillBreakdownCells('bdVariable', totalVariableMonthly, expenseCode);
  fillBreakdownCells('bdSubs', totalSubsMonthly, expenseCode);
  fillBreakdownCells('bdAll', allExpensesMonthly, expenseCode);
  fillBreakdownCells('bdGoals', plannedSavingsBucketsNative, incomeCode);

  if (bdNetDailyEl) {
    bdNetDailyEl.textContent = Number.isFinite(netIncome)
      ? formatInCurrency((netIncome * 12) / 365, incomeCode)
      : '—';
  }
  if (bdNetWeeklyEl) {
    bdNetWeeklyEl.textContent = Number.isFinite(netIncome)
      ? formatInCurrency((netIncome * 12) / 52, incomeCode)
      : '—';
  }
  if (bdNetMonthlyEl) {
    bdNetMonthlyEl.textContent = Number.isFinite(netIncome)
      ? formatInCurrency(netIncome, incomeCode)
      : '—';
  }
  if (bdNetAnnualEl) {
    bdNetAnnualEl.textContent = Number.isFinite(netIncome)
      ? formatInCurrency(netIncome * 12, incomeCode)
      : '—';
  }

  if (bdNetAltHintEl) {
    if (currenciesDiffer() && Number.isFinite(netExpense)) {
      bdNetAltHintEl.textContent = `Net in ${expenseCode}: ${formatInCurrency(netExpense, expenseCode)} monthly (${formatInCurrency(netExpense * 12, expenseCode)} annual)`;
    } else {
      bdNetAltHintEl.textContent = '';
    }
  }
}

function updateChart({
  totalFixedMonthly,
  totalVariableMonthly,
  totalSubsMonthly,
  plannedSavingsBucketsVnd,
  incomePerMonthVnd,
}) {
  const expenseCode = getExpenseCurrency();
  const fixedVnd = toVnd(totalFixedMonthly, expenseCode);
  const variableVnd = toVnd(totalVariableMonthly, expenseCode);
  const subsVnd = toVnd(totalSubsMonthly, expenseCode);
  const allExpensesVnd =
    (Number.isFinite(fixedVnd) ? fixedVnd : 0) +
    (Number.isFinite(variableVnd) ? variableVnd : 0) +
    (Number.isFinite(subsVnd) ? subsVnd : 0);
  const remainingAfterAll = incomePerMonthVnd - allExpensesVnd - plannedSavingsBucketsVnd;

  const labels = [
    'Fixed expenses',
    'Variable expenses',
    'Subscriptions',
    'Goals',
    'Unallocated',
  ];
  const data = [
    Math.max(Number.isFinite(fixedVnd) ? fixedVnd : 0, 0),
    Math.max(Number.isFinite(variableVnd) ? variableVnd : 0, 0),
    Math.max(Number.isFinite(subsVnd) ? subsVnd : 0, 0),
    Math.max(plannedSavingsBucketsVnd, 0),
    Math.max(remainingAfterAll, 0),
  ];

  if (!chartInstance) {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              '#7B14EF',
              '#00B4A0',
              '#FFC845',
              '#C026D3',
              '#E5E7EB',
            ],
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

function recomputeAll() {
  const { perMonth: incomePerMonth, perMonthVnd: incomePerMonthVnd } = updateIncome();
  const expenseCode = getExpenseCurrency();
  const incomeCode = getIncomeCurrency();

  const totalFixedMonthly = sumMonthlyFromTable(fixedExpensesBody);
  totalFixedMonthlyEl.textContent = formatInCurrency(totalFixedMonthly, expenseCode);

  const totalVariableMonthly = sumMonthlyFromTable(variableExpensesBody);
  totalVariableMonthlyEl.textContent = formatInCurrency(
    totalVariableMonthly,
    expenseCode
  );

  const totalSubsMonthly = sumMonthlyFromTable(subscriptionsBody);
  totalSubsMonthlyEl.textContent = formatInCurrency(totalSubsMonthly, expenseCode);

  const totalExpensesNative =
    totalFixedMonthly + totalVariableMonthly + totalSubsMonthly;
  const totalExpensesVnd = toVnd(totalExpensesNative, expenseCode);

  const { plannedSavingsBucketsVnd, plannedSavingsBucketsNative } = updatePercentages(
    incomePerMonthVnd,
    totalExpensesNative,
    Number.isFinite(totalExpensesVnd) ? totalExpensesVnd : 0
  );

  updateSummary({
    incomePerMonth,
    incomePerMonthVnd,
    totalFixedMonthly,
    totalVariableMonthly,
    totalSubsMonthly,
    plannedSavingsBucketsNative: Number.isFinite(plannedSavingsBucketsNative)
      ? plannedSavingsBucketsNative
      : 0,
  });

  updateBreakdown({
    incomePerMonth,
    totalFixedMonthly,
    totalVariableMonthly,
    totalSubsMonthly,
    plannedSavingsBucketsNative: Number.isFinite(plannedSavingsBucketsNative)
      ? plannedSavingsBucketsNative
      : 0,
    incomePerMonthVnd,
  });

  updateChart({
    incomePerMonthVnd,
    totalFixedMonthly,
    totalVariableMonthly,
    totalSubsMonthly,
    plannedSavingsBucketsVnd,
  });

  if (totalFixedEquivEl) {
    totalFixedEquivEl.textContent = formatConvertDisplay(
      totalFixedMonthly,
      expenseCode,
      incomeCode
    );
  }
  if (totalVariableEquivEl) {
    totalVariableEquivEl.textContent = formatConvertDisplay(
      totalVariableMonthly,
      expenseCode,
      incomeCode
    );
  }
  if (totalSubsEquivEl) {
    totalSubsEquivEl.textContent = formatConvertDisplay(
      totalSubsMonthly,
      expenseCode,
      incomeCode
    );
  }

  refreshExpenseTableEquiv(fixedExpensesBody);
  refreshExpenseTableEquiv(variableExpensesBody);
  refreshExpenseTableEquiv(subscriptionsBody);

  updateCurrencyHeaders();
  updateRateHints();
}

function onCurrencyChange() {
  saveCurrencyPreferences();
  updateCurrencyHeaders();
  reformatAllAmountInputs();
  recomputeAll();
}

addFixedExpenseBtn.addEventListener('click', () => {
  createExpenseRow(fixedExpensesBody);
});

addVariableExpenseBtn.addEventListener('click', () => {
  createExpenseRow(variableExpensesBody);
});

addSubscriptionBtn.addEventListener('click', () => {
  createExpenseRow(subscriptionsBody);
});

attachAmountInputFormatting(
  salaryAmountInput,
  () => getCurrencyMeta(getIncomeCurrency()).decimals
);

salaryAmountInput.addEventListener('input', recomputeAll);
salaryFrequencySelect.addEventListener('change', recomputeAll);
percentageInputs.forEach((input) => {
  input.addEventListener('input', recomputeAll);
});

if (incomeCurrencySelect) {
  incomeCurrencySelect.addEventListener('change', onCurrencyChange);
}
if (expenseCurrencySelect) {
  expenseCurrencySelect.addEventListener('change', onCurrencyChange);
}

['Rent / Mortgage', 'Groceries', 'Electricity', 'Internet', 'Water', 'Mobile phone'].forEach(
  (name) => {
    createExpenseRow(fixedExpensesBody, {
      name,
      frequency: 'monthly',
    });
  }
);

['Dining out', 'Entertainment', 'Transport (pay-as-you-go)'].forEach((name) => {
  createExpenseRow(variableExpensesBody, {
    name,
    frequency: 'monthly',
  });
});

['TV streaming', 'Music streaming', 'Gym membership'].forEach((name) => {
  createExpenseRow(subscriptionsBody, {
    name,
    frequency: 'monthly',
  });
});

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
  const rowsFrom = (tbody) => {
    const out = [];
    if (!tbody) return out;
    tbody.querySelectorAll('tr').forEach((tr) => {
      const nameInput = tr.querySelector('td:nth-child(1) input');
      const freqSelect = tr.querySelector('td:nth-child(2) select');
      const amtInput = tr.querySelector('td:nth-child(3) input');
      if (!nameInput || !freqSelect || !amtInput) return;
      out.push({
        name: nameInput.value,
        frequency: freqSelect.value,
        amount: amtInput.value,
      });
    });
    return out;
  };
  const pct = {};
  document.querySelectorAll('.percentage-input').forEach((inp) => {
    const k = inp.dataset.percentageInput;
    if (k) pct[k] = inp.value;
  });
  return {
    salaryAmount: salaryAmountInput.value,
    salaryFrequency: salaryFrequencySelect.value,
    incomeCurrency: getIncomeCurrency(),
    expenseCurrency: getExpenseCurrency(),
    fixed: rowsFrom(fixedExpensesBody),
    variable: rowsFrom(variableExpensesBody),
    subs: rowsFrom(subscriptionsBody),
    percentages: pct,
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
    } else if (hasScenarios && previous && store.scenarios.some((s) => s.id === previous)) {
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

function applyScenarioData(data) {
  if (!data) return;
  salaryAmountInput.value = data.salaryAmount ?? '';
  if (salaryAmountInput.formatAmountValue) salaryAmountInput.formatAmountValue();
  salaryFrequencySelect.value = data.salaryFrequency || 'monthly';

  let incomeCode = data.incomeCurrency;
  let expenseCode = data.expenseCurrency;
  if (incomeCode == null && expenseCode == null) {
    incomeCode = 'VND';
    expenseCode = 'VND';
  } else {
    if (!isSupportedCurrency(incomeCode)) incomeCode = DEFAULT_INCOME_CURRENCY;
    if (!isSupportedCurrency(expenseCode)) expenseCode = DEFAULT_EXPENSE_CURRENCY;
  }

  if (incomeCurrencySelect) incomeCurrencySelect.value = incomeCode;
  if (expenseCurrencySelect) expenseCurrencySelect.value = expenseCode;
  saveCurrencyPreferences();

  function fillTable(tbody, rows, addFn) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows && rows.length) {
      rows.forEach((r) => {
        addFn(tbody, {
          name: r.name || '',
          frequency: r.frequency || 'monthly',
          amount:
            r.amount !== undefined && r.amount !== ''
              ? parseAmount(r.amount)
              : undefined,
        });
      });
    } else {
      addFn(tbody, {});
    }
  }

  fillTable(fixedExpensesBody, data.fixed, createExpenseRow);
  fillTable(variableExpensesBody, data.variable, createExpenseRow);
  fillTable(subscriptionsBody, data.subs, createExpenseRow);

  if (data.percentages) {
    Object.entries(data.percentages).forEach(([k, v]) => {
      const inp = document.querySelector(`[data-percentage-input="${k}"]`);
      if (inp) inp.value = v;
    });
  }
  recomputeAll();
}

function initScenarioUI() {
  refreshScenarioUI();
  if (scenarioLoadSelect && scenarioLoadSelect.value) {
    loadSelectedScenario({ silent: true });
  }
}

populateCurrencySelects();
initScenarioUI();
updateCurrencyHeaders();

if (scenarioSaveBtn) scenarioSaveBtn.addEventListener('click', saveScenario);
if (scenarioNewBtn) scenarioNewBtn.addEventListener('click', showCreateScenario);
if (scenarioCancelBtn) scenarioCancelBtn.addEventListener('click', cancelCreateScenario);
if (scenarioLoadSelect) {
  scenarioLoadSelect.addEventListener('change', () => {
    loadSelectedScenario();
  });
}
if (scenarioDeleteBtn) {
  scenarioDeleteBtn.addEventListener('click', deleteSelectedScenario);
}
if (scenarioNameInput) {
  scenarioNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveScenario();
  });
}

recomputeAll();

if (!vndRatesCache && !ratesLoading) {
  loadExchangeRates();
}
