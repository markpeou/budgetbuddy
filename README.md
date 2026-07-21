# Budget Buddy

Budget Buddy is a browser-based planner for comparing income, expenses, and
savings goals across currencies. It is designed for people budgeting across
countries, including international moves and ongoing bills back home.

## Current capabilities

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
- `budget-core.js`: DOM-independent budget and currency logic.
- `tests/`: automated tests.
- `docs/`: product, design, architecture, API, and data documentation.
- `backlog/`: epics, stories, sprint work, and completed work.
- `.cursor/skills/`: project-specific agent workflows.
- `learnings/`: evolving project context, decisions, issues, and notes.
- `PROJECT_STATE.md`: current implementation status and constraints.
- `ROADMAP.md`: outcome-oriented delivery direction.
