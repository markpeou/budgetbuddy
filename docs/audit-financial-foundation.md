# Budget Buddy: audit and plan for a shared financial foundation

*Audit of commit 39a581e, 10 Nov 2026, against "Financial Journeys & Calculator Improvement".*

## 1. What exists today

| Area | Where | What it does |
|---|---|---|
| Budget planner | `index.html`, `script.js` (2,300 lines), `budget-core.js` | One income (amount, frequency, currency). Costs in three lists: fixed, variable, subscriptions. Each cost has name, amount, frequency (weekly to yearly) and currency. A "Savings & goals" split divides income by percentage (Expenses 50 / Long-term savings 30 / Emergency 10 / Investments 10, always 100%). Scenarios, autosave, Summary with Day/Week/Month/Year. |
| Calculators | `journeys.js` (UI), `journey-core.js` (maths, tested) | Spending breakdown, savings capacity, money snapshot, emergency fund, financial runway (job loss, no income, time off, leaving a job), savings goal, income change (incl. career). Shared essentials list (per scenario), savings balance, money by certainty, currency hold. |
| Receipts | `receipts.js`, `receipt-core.js`, `worker/` | Actual spending captured from receipts, kept separate from the plan. |
| Site | `home.js`, `home.css`, `nav.js`, `overview.js` | Homepage, journeys, calculators, About, phone navigation, Summary card. |
| Tests | `tests/` | 87 checks: budget maths, currency, splits, receipt parsing, worker, journey maths, routes. No tests for Summary maths or scenario comparison (neither is in pure code). |

## 2. Feature map

Priority: **P1** must fix first (trust or accuracy), **P2** improves an existing journey, **P3** new capability, **P4** polish. Structural = needs a change to the shared data model.

| Feature | Current behaviour | Issues | Proposed improvement | Priority | Depends on | Structural? |
|---|---|---|---|---|---|---|
| **Shared data** | Calculators read the planner by scraping input fields (`budgetRows()` in journeys.js); Summary, strip, welcome card and calculators each add things up their own way. | Same budget gives different "left over" figures (see next row). Logic duplicated in 4 places. Untestable in parts. | One pure `budgetModel(data, rates)` in `budget-core.js` that turns saved budget data into monthly figures in one currency (in, out by type, essential/optional, irregular, debt, planned saving, left over, missing rates). Everything reads it. | **P1** | — | Yes (new module; data shape unchanged at first) |
| **"Left over"** | Summary/strip/welcome: income − costs − *planned* savings. Calculators: income − costs. | Planned savings treated as money spent. Two answers to "how much do I have left?". | Define once: **Money left over = money in − money out**. Show planned saving as "Of that, you plan to save …", and actual savings separately. | **P1** | Shared data | No (definitions + wording) |
| **Income** | One amount, labelled "Amount"/"salary". | No take-home vs before-tax; no second or irregular income. Calculators may treat before-tax pay as spendable. | Label as **take-home pay** (what lands in your account) with a one-line explanation; add optional "Other money coming in" rows (amount, frequency, regular/irregular). Irregular income averaged monthly and flagged as an estimate. | **P1** | Shared data | Yes (extra income rows) |
| **Costs: essential vs optional** | Three groups (fixed/variable/subscriptions). Essentials exist only in the calculators' list, keyed by cost name. | Essential choice lives outside the planner; renaming a cost loses it; planner can't show essential vs optional. | Store an **essential flag on each cost** in the budget (suggested as today, user-confirmed). Calculators' list becomes a view of it. Variable never means optional. | **P1** | Shared data | Yes (field on each cost) |
| **Irregular and one-off costs** | Frequency covers quarterly/yearly bills. No one-off or occasional costs. | Repairs, medical, moving, annual purchases missing → plans look rosier than reality. | Add **"Costs that don't come every month"**: yearly or occasional amounts, spread monthly (÷12) with the spread shown. One-off costs belong to a journey (moving, time off), not the monthly plan. | **P1** | Shared data | Yes (new cost group) |
| **Debt repayments** | Can be entered as a cost with any name. | No way to mark debt; risk of counting a loan both as a cost and as a "goal". | Optional "Debt repayment" type on a cost; never also in the savings split. Keep simple: no interest/payoff maths in Phase 1. | P2 | Essential flag | Small |
| **Savings: planned vs actual** | Split = planned % of income. Savings balance = one figure stored only in calculator storage. | Planned treated like spent; actual savings not part of the budget/scenarios; no separate investments. | Budget gets **Money you can access** (one figure + currency) and optional **Other savings/investments** (not counted as available). Split shows "Planned saving", never "saved". | **P1** | Shared data | Yes (fields in budget) |
| **Currency** | Safe: missing rates put answers on hold; cached rates labelled; >3 days warned. | Planner shows "—" rather than naming the missing currency; per-row equivalents fine. | Keep. Name the missing currency in the planner too. Model returns `missingRates`. | P1 (small) | Shared data | No |
| **Language** | Mixed: "Reporting currency", "Fixed / Unfixed / variable", "Equiv.", "Status vs actual", "Financial runway", "Savings capacity", "Monthly shortfall", "Reliable income". | Jargon for first-time users. | Apply the brief's vocabulary everywhere (money coming in/going out/left over; how long your savings will last; costs you must pay). Rename calculators and journeys. | P2 (runs through all phases) | — | No |
| **Understand my money (A)** | Breakdown ranks costs; capacity gives left/year; snapshot gives rates. Three tools for one question. | Split across tools; no essentials vs other in breakdown; no irregular costs; mixes left over with planned saving. | One journey: money in, money out (essentials / other, incl. spread irregular costs), left over, planned saving, monthly and yearly. | **P2** | P1 model | No (after P1) |
| **Emergency fund (B)** | 3/6/12 targets, essentials list, set-aside and monthly amount, time to build. | No 9 months; no target date; "months your savings cover" only in a sub-line. | Add 9 months, optional target date (→ monthly amount needed), clear "covers X months today", and a note that the right amount depends on your situation. | **P2** | P1 savings field | No |
| **Savings goal (C)** | Target, saved, monthly, optional deadline. | Missing mode 3 ("I save X, how much will I have?"), contribution frequency, optional interest. | Three modes as a simple switch; frequency; optional simple interest rate (off by default, clearly labelled, no assumed returns). | **P2** | — | No |
| **Job loss (D)** | Two scenarios, essentials, money by certainty, assumptions. | Wording ("Financial runway", "Monthly shortfall"); savings not from the budget. | Wording pass; savings from the budget's "money you can access". | P2 | P1 savings field | No |
| **Time off (E)** | Two scenarios for one chosen length (3/6/12). | No one-off costs (travel, course); can't see 3/6/12 together; "what if longer" not shown. | Add one-off costs; show 3, 6 and 12 months side by side for the chosen spending level. | **P3** | — | No |
| **Moving (F)** | Not built. | — | New journey: upfront money needed (moving, deposit, overlap), monthly change, money left after the move, difference over 6 and 12 months. Uses the comparison pattern. | **P3** | Comparison pattern | No |
| **Income change (G)** | New income, % chips, career transition. | No start date, no extra income, no effect on savings goals. | Add start date and other income; show effect on the savings goal (later or earlier). | **P3** | Savings goal (C) | No |
| **Scenario comparison** | Scenarios can be saved and loaded one at a time. | Can't see two side by side; no duplicate-and-tweak. | "Compare" view: pick 2–3 scenarios (or duplicate the current one and change a few inputs); show money out, left over, planned saving, savings over 12 months. One small bar chart at most. | **P3** | P1 model (needs pure maths per scenario) | No (after P1) |
| **Result design** | Calculators: answer, behind it, change the numbers. | No "What this means" or "Next step"; Summary uses a different layout. | One result layout everywhere: answer → how we worked it out → what this means → try another option (one or two "what if" buttons) → next step (another journey). | P4 (start in P2) | — | No |
| **Receipts** | Separate actual spending. | Not compared with the plan except one line. | Out of scope for this brief; keep as is. | — | — | — |

## 3. Key problems, in order

1. **Two definitions of "left over".** The planner subtracts *planned* savings; the calculators don't. The brief's rule "savings allocations must not be treated as actual savings" is broken in the Summary, the money strip and the welcome card.
2. **No single source of budget data.** Calculators read input boxes on the page. This is why logic is duplicated, why renaming a cost loses its essential choice, and why some maths can't be tested.
3. **Missing parts of real life:** take-home pay, other income, irregular costs, debt, accessible savings in the budget.
4. **Jargon** in labels, calculator names and results.

Everything in Phase 2 and 3 is easier and safer once 1 and 2 are fixed, so the order below starts there.

## 4. Recommended phases

### Phase 1: Fix the foundations
1. **`budgetModel()`** in `budget-core.js`: pure, tested, reads the saved budget shape (`collectScenarioData()`), returns monthly figures in one currency with `missingRates`. Summary, strip, welcome card and calculators switch to it. *No data model change yet: proves the numbers match before anything moves.*
2. **One definition of left over** (money in − money out), with planned saving shown separately. *Wording and maths; no data change.*
3. **Data additions** (backwards compatible; old scenarios load with sensible defaults):
   - income: `takeHome: true` label + optional `otherIncome[]` (amount, frequency, currency, regular/irregular)
   - each cost: `essential` (true/false/unset = suggested) and `type` (`bill`, `debt`, `other`)
   - new cost group `irregular[]` (yearly/occasional costs, spread monthly)
   - savings: `accessibleSavings` and `otherSavings` (amount + currency)
4. Calculators read essentials and savings from the budget (existing per-scenario essentials list migrates onto the costs).
5. Tests for every item in section 8 of the brief.

### Phase 2: Improve existing journeys
Understand my money (one journey replacing breakdown/capacity/snapshot as entry points), Emergency fund (+9 months, target date), Savings goals (three modes, frequency, optional interest), Job loss (wording, budget savings). Language pass applied as each is touched.

### Phase 3: Scenario planning
Time off (one-off costs, 3/6/12 side by side), Moving (new), Income change (start date, other income, goal impact), Scenario comparison view (duplicate and change).

### Phase 4: Polish
One result layout everywhere, explanations, mobile and accessibility review, edge cases, a short user test script.

## 5. What changes the data model, and what doesn't

| Without data model changes | Needs data model changes (Phase 1, step 3) |
|---|---|
| `budgetModel()` over today's data; single left-over definition; wording; emergency fund 9 months and target date; savings goal modes and interest; time off side by side; moving journey (its inputs live in the journey); result layout | Take-home + other income; essential flag and debt type on costs; irregular costs group; accessible savings and other savings in the budget |

## 6. Decisions needed

1. **Left over vs planned saving in the Summary.** Proposed: headline "Money left over: $X a month", then "You plan to save $Y of it" (or "Your plan needs $Z more than you have"). Today it shows only what's left after planned saving.
2. **Keep the percentage split?** It mixes a spending target ("Expenses 50%") with savings plans. Proposed: keep percentages for savings goals only, drop the "Expenses %" row, show savings plans as amounts with the % alongside.
3. **Three cost groups.** Keep Fixed / Variable / Subscriptions and add the essential tick to each cost, or regroup as "Costs you must pay" / "Other spending"? Proposed: keep the groups (less disruption), add the tick, and show essentials vs other in results.
4. **Interest in savings goals.** Proposed: off by default, simple annual rate on the balance, labelled "if your savings earn interest", no investment returns.
5. **Calculators list after Phase 2.** Proposed: merge Spending breakdown, Savings capacity and Money snapshot into "Understand my money", leaving one tool per question.
