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

## 7. Decisions taken (10 Nov 2026)

1. **Money left over = money in − money out.** What people plan to do with it is theirs to decide; the savings & goals split is shown, never subtracted.
2. **Savings split unchanged** (including the "Expenses" row).
3. **Cost groups unchanged.** No essential tick in the planner; costs get a hidden permanent id so essential choices survive renames. Yearly and 2-yearly costs use the frequency menu (spread monthly), not a new group.
4. **Merge** Spending breakdown, Savings capacity and Money snapshot into "Understand my money" (Phase 2).

## 8. Phase 1 status: done

- `budgetModel()` and `compareModels()` in `budget-core.js`, with 17 tests (`tests/budget-model.test.js`). Summary, money strip, welcome card, planner tables and every calculator read it; calculators no longer read the page's input boxes.
- One definition of money left over everywhere.
- Take-home pay label and hint; optional **other money coming in** (amount, frequency, currency, reliable or not); **every 2 years** frequency; **your savings** card (money you can access + other savings), saved with each scenario and shared with the calculators.
- Costs carry permanent ids; essential choices keyed by id (older name-keyed choices still apply).
- Migrations: the calculators' old savings figure moves into the budget; old scenarios load unchanged.

Not done in Phase 1 (moved to Phase 2): debt type on costs (debt is counted once as a cost today and suggested as essential); naming the missing currency inside the planner's own tables.

## 9. Phase 2 status: done

- **Understand my money** replaces Spending breakdown, Savings capacity and Money snapshot (old links redirect). Answer, a monthly/yearly table (money coming in with take-home/other, money going out split into costs you must pay and other spending, money left over), what this means, your costs ranked with "Must pay" tags, and a next step. Five question presets (where it goes, cost of living, a year's saving, income needed, full picture).
- **Emergency fund:** 3, 6, 9 and 12 months side by side, nothing preselected; "what you've set aside covers about N months"; optional target date gives the monthly amount; "no single right amount" note.
- **Savings goal:** three ways to ask (how long / how much to save / how much I'll have), weekly/fortnightly/monthly saving, optional yearly interest (off unless entered). Handles already reached, no saving, more than 100 years, and a monthly amount above money left over.
- **Plain language:** calculator names, field labels, job-loss and time-off wording ("Keep spending as I do today" / "Spend only on what I need", "About 3½ months"), "What this means" and "Next step" on the new pages.
- **Planner** names the currency it can't convert.
- **Tests:** 9 more (emergency 9 months and target date, goal time/contribution/projection with frequency, interest and edge cases). 113 in total.

Still to decide or do: debt type on costs (kept out because the cost groups stay as they are; debt is counted once as a cost and suggested as a must-pay cost by its name). Phase 3: time off with one-off costs and 3/6/12 side by side, moving, income change with start date and goal impact, scenario comparison. Phase 4: the same result layout on the remaining pages (planner Summary, time off, income change), accessibility review.

## 10. Phase 3 status: done (plus projections)

**Projections (new calculators, all in `journey-core.js`, tested against independent figures)**
- Investment growth (`investProjection`): starting amount and/or regular contributions, 5/10/20/30 years, yearly return compounded monthly, optional fees and inflation (today's money), ±2% range, year-by-year chart.
- Pay off debt (`payoff`): date, time and interest; extra-repayment comparison side by side; "never paid off" when the repayment doesn't cover interest.
- Home loan extra repayments (`extraRepayment`, `loanPayment`): repayment given or worked out from years left; extra monthly and/or one-off; time and interest saved; balance chart. Check: A$500k, 6%, 25 yrs + A$500/month saves 6 yrs 4 months and A$135,195.
- Savings goal presets: trip (on your current budget: defaults to money left over, shows share of left over and the fastest date) and home deposit (amount by a date).
- Quick chips: preset amounts and "My money left over (A$…)".

**Phase 3**
- Time off / leaving a job: one-off costs, 3/6/12 months side by side for both scenarios, "if it lasted longer".
- Moving somewhere new (`moveCompare`): costs there in any currency (converted, rate noted), upfront costs, left over there vs here, savings at 6 and 12 months, payback.
- Change in income: optional start date (keep saving until then), effect on the savings & goals plan, next step.
- Compare scenarios: two saved scenarios (or the budget now) side by side in the income currency, with differences and the biggest cost changes. `BudgetScenarios.model` keeps other income, savings and essentials alongside the migrated data.

**Still open:** multiple debts (avalanche vs snowball), offset accounts, debt as a cost type.

## 11. Phase 4 status: done

- **Charts move:** bars grow from the baseline one after another, lines draw left to right, and changes glide to the new figures. Starts when the chart is on screen; off for people who ask for less motion (`prefers-reduced-motion`). Charts are drawn at their real size so text stays 12px.
- **One result layout:** the planner Summary now has "What this means" and a next step, like every calculator; job loss and time off have next steps.
- **Accessibility (scripted check of every page at 320px and 1280px):** muted text darkened to pass 4.5:1 on every surface; nav links readable on the grey planner background; teal buttons and the "100%" total darkened for contrast; scenario name field labelled; chart heading order fixed; chart years reachable by keyboard with spoken values. Every focus stop shows a focus ring.
- **Mobile:** no sideways scrolling on any page at 320px, including very long VND amounts (tables wrap, cover targets stack).
- **Edge cases:** huge values show 6 significant figures (no floating-point noise); 0% loans and 0% returns read naturally; junk and negative input ask for a valid figure.
- **Robustness:** the planner no longer breaks (or stops autosaving) if the chart library can't load; the library is pinned to a fixed version.
- **User test script:** `docs/user-test-script.md`.

## 12. Ongoing budget: receipts and bank statements

- **Bank statements (CSV)** in the Spending tab, read on the device and never uploaded (`statement-core.js`, tested against CommBank, ANZ, NAB, Westpac, credit card and Vietnamese layouts). Detects the layout, which sign is spending, and day/month order; tidies merchant names; categorises (known Australian and Vietnamese shops, remembered choices, keywords).
- **Checked before adding:** money in, transfers between your accounts and card repayments are left out (rent paid by transfer is kept); lines already imported, or matching a receipt you added (same amount, ±3 days), are left out. One category change applies to every line from the same shop and is remembered.
- **This month so far:** each category's spending against the plan; day-to-day spending paced through the month (rent and bills aren't); "Over plan", "Ahead of pace", "Not in your budget".
- **Keep your budget real:** from whole months a statement covers, one-tap suggestions to update a cost or add a missing one. Never lowers a cost to zero (it may be paid from another account) or changes a yearly bill to match monthly spending.
- **Monthly reminder:** a calendar file for the 1st of each month at 7pm.
- **Receipt reader:** on-device by default until the reader service is set up (Claude needs it, or a personal key).
