# Terminal Commands

Quick command reference for running Budget Buddy.

## 0) Quick preflight (what's already running)

```bash
lsof -nP -iTCP:5180 -sTCP:LISTEN
```

---

## Start Static App (`5180`)

```bash
cd "/Users/markpeou/Desktop/Cursor/Projects/BudgetPlannr"
npm run dev
```

## Health check

```bash
curl -I "http://127.0.0.1:5180"
```

---

## Common fixes

### "Connection refused"

```bash
lsof -nP -iTCP:5180 -sTCP:LISTEN
```

- If empty: start the server.
- If occupied by wrong process: kill it.

### Kill by PID

```bash
kill <PID>
```

### Kill by port (one-liner)

```bash
kill $(lsof -t -iTCP:5180 -sTCP:LISTEN)
```
