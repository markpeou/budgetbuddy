# Budget Buddy

Plan your income and expenses with multiple currency options to help with your international move.

## Live site

https://markpeou.github.io/budgetbuddy/

## Local server contract

- App URL: `http://127.0.0.1:5180`
- Reserved local port: `5180`

## Start

```bash
npm run dev
```

## Port preflight

Check whether the port is already in use before starting:

```bash
lsof -nP -iTCP:5180 -sTCP:LISTEN
```
