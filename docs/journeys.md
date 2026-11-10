# Financial journeys: what each one answers

Every journey ends the same way:

1. **The answer** — one sentence with one number.
2. **Behind it** — the two or three figures that produce it, so the maths is visible.
3. **What would change it** — the one or two levers that move the answer most, adjustable in place.

Calculators fill in from the budget planner when there is one, and every figure can also be typed straight in, so no journey requires building a budget first.

## Decisions

- **Essentials are suggested, then confirmed.** (Updated: was "fixed costs only", which undercounted groceries, transport and utilities.) The list starts from the budget: fixed costs and variable costs whose names suggest necessities, each marked *Suggested*. Users tick, untick, edit amounts, add missing costs, or confirm the lot. Runway and emergency fund share the list, and **each scenario keeps its own essentials** (saved with the budget, so changing them prompts "You've changed …").
- **Money by certainty.** Available now + confirmed money count; uncertain or estimated money is excluded unless the user includes it, and its effect is shown either way. No redundancy or benefit entitlements are calculated.
- **Never guess a conversion.** A missing exchange rate puts the affected answer on hold and names the currency. The last good rates are cached and labelled as a saved copy. Rates older than 3 days (live or saved) show an amber warning wherever converted amounts are used.
- **Emergency fund cover is the user's choice.** Targets for 3, 6 and 12 months show side by side; nothing is preselected.
- **Savings balance is one figure**, entered once and shared by every calculator. Savings in several countries is a backlog item.
- **Neutral readings.** No "good" or "bad" verdicts on someone's finances; show the figure and what moves it.

## Calculators

| Calculator | Journeys and questions |
|---|---|
| Spending breakdown | Where does my money go? · How much does it really cost to live? |
| Savings capacity | How much can I realistically save? · How much can I save over the next year? · How much income do I need to cover my expenses? |
| Money snapshot | What does my financial situation look like? |
| Emergency fund | How much should I have in an emergency fund? |
| Financial runway | How long could I manage without an income? · Could I afford six months off? · What if I lost my job? · How much should I save before leaving my job? |
| Savings goal | How can I reach my savings goal? |
| Income change | What happens if my income decreases? · Could I afford to change careers? · Could I afford to work less? |

## Journeys

### Understand my money

**Where does my money go each month?** — *What eats my money, and what could I change?*
Answer: "Your 3 biggest costs take 62% of your spending: rent, groceries, transport." Behind it: every cost ranked by share; fixed vs flexible (variable + subscriptions). Lever: flexible spending is the part you control. Inputs: budget expenses.

**How much can I realistically save?** — *A number that's true, not hopeful.*
Answer: "You can save ₫8.4M a month, 22% of your income — ₫100M a year." Behind it: income − all costs; flags when the savings & goals split asks for more than is left. Lever: trimming flexible spending by 10%. Inputs: income, costs.

**What does my financial situation look like?** — *Am I okay, at a glance?*
Answer: four neutral readings — savings rate, share of income locked into fixed costs, biggest single cost, months of runway (if savings entered). Inputs: budget, optional savings.

### Build my financial safety net

**How much should I have in an emergency fund?** — *A target, and how far away I am.*
Answer: "Aim for ₫72M (6 months of essential costs). You have ₫20M — ₫52M to go, about 10 months at your current rate." Behind it: essentials × months; gap ÷ monthly contribution. Levers: months of cover (3/6/12), monthly contribution. Inputs: essential costs (shared essentials list), amount set aside, monthly contribution (from the Emergency fund split).

**How long could I manage without an income?** — *How much time I'd have.*
Answer: "Your savings would last 5 months — until April 2027." Behind it: savings ÷ monthly costs. Levers: cutting to essentials, any income you'd still have. Inputs: savings, monthly costs.

**How can I reach my savings goal?** — *When, or how much a month.*
Answer: "You'll reach ₫50M by March 2028." With a deadline: "To get there by December 2026, save ₫4.2M a month — ₫1.1M more than now." Behind it: (target − saved) ÷ monthly. Levers: monthly amount, deadline. Inputs: target, already saved, monthly (from the Long-term savings split), optional deadline.

### Plan a big life change

**Could I afford to take six months off?** / **How much should I save before leaving my job?** — *Yes or no, and by how much.*
Same two scenarios as job loss (current spending / essentials only), same money split (available now + confirmed; uncertain opt-in) and reliable income. Length is 3, 6 or 12 months (the title follows). Each scenario shows the cost of the break, what's left or how much short, and how long the gap would take to save at the current saving rate (income − spending from the budget). The leaving-a-job version leads with the amount needed.

**What happens if my income decreases?** — *Would I still be okay?*
Answer: "On ₫20M you'd have ₫2.1M left a month instead of ₫8.4M — ₫75M less a year." If negative: "You'd be ₫3M short each month; your savings cover that for 13 months." Lever: new income, as an amount or a % drop.

**Could I afford to change careers?** — *Can I survive the switch, and is it worth it?*
Answer: "The switch costs ₫60M in total. Afterwards you'd have ₫4M a month left (vs ₫8.4M now)." If the new pay is higher: "You'd be ahead after 18 months." Inputs: months of transition, income during it, one-off costs, new salary.

**What would happen if I lost my job?** — *How long my money lasts, and what changes it.*
Two scenarios side by side (stacked on phones), each with monthly spending, reliable income, monthly shortfall, available funds, runway (to one decimal) and the estimated run-out date:
- **Current spending:** "Based on your current spending and the funds you've entered, your money could last about 8.1 months."
- **Essentials only:** "If you reduced spending to the essential costs you've selected, your funds could last about 9.3 months." A what-if, not a recommendation.

Underneath: what drives the difference (the non-essential spending, with its biggest items), the effect of uncertain money, and a visible "How this is worked out" list (date calculated, starting funds, spending and income assumptions, which payments are included, currency and rates). Edge cases each have their own wording: not drawn down (income ≥ spending), no funds, under a month (in days), more than 50 years. Never Infinity, NaN or an invented date. "How long could I manage without an income?" uses the same page.
