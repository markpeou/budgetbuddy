# Budget Buddy

Budget Buddy is a browser-based planner for comparing income, expenses, and
savings goals across currencies. It is designed for people budgeting across
countries, including international moves and ongoing bills back home.

## Current capabilities

- Homepage with two ways in: guided financial journeys (question-led) or straight to the calculators.
- Journey calculators: spending breakdown, savings capacity, money snapshot, emergency fund, financial runway, savings goal and income change. Each gives one answer, the figures behind it and the levers that change it (see `docs/journeys.md`).

- Normalize income and expenses across common payment frequencies.
- Enter expenses in different currencies and report a combined total.
- Create custom budget splits and compare them with actual spending.
- Save and restore scenarios in the current browser.
- View summary tables and a spending chart.

## Live site

https://markpeou.github.io/budgetbuddy/

## Local server contract

- App URL: `http://127.0.0.1:5180`
- Reserved local port: `5180`

## Start

```bash
npm run dev
```

## Test

```bash
npm test
```

## Project map

- `index.html`, `styles.css`, `script.js`: current static application.
- `home.js`, `home.css`: Home, Financial journeys, Calculators and About views; links into calculators via `#tool/<id>[/<preset>]` and the planner via `#go/income`.
- `journey-core.js`: pure maths for the journey calculators (unit tested). `journeys.js`: their pages.
- `budget-core.js`: DOM-independent budget and currency logic.
- `tests/`: automated tests.
- `docs/`: product, design, architecture, API, and data documentation.
- `backlog/`: epics, stories, sprint work, and completed work.
- `.cursor/skills/`: project-specific agent workflows.
- `learnings/`: evolving project context, decisions, issues, and notes.
- `PROJECT_STATE.md`: current implementation status and constraints.
- `ROADMAP.md`: outcome-oriented delivery direction.
