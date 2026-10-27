# QueryPilot - AI Database Query Performance Advisor (MERN)

Paste a SQL query (and optionally its `EXPLAIN` output). QueryPilot scores it out of 100,
lists each performance problem with a plain-language fix, suggests indexes, and can ask an
AI model for a rewritten query. Every analysis is saved to your account.

## Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| MongoDB   | Mongoose models: `User`, `Analysis`                     |
| Express   | REST API, JWT auth, Helmet, rate limiting               |
| React     | Vite, React Router, context-based auth, SVG score dial  |
| Node.js   | ES modules, built-in test runner, optional AI via fetch |

## Features

- Register, login, protected routes (JWT, bcrypt-hashed passwords)
- 16 rule checks: `SELECT *`, `UPDATE/DELETE` without `WHERE`, leading-wildcard `LIKE`,
  functions on columns, `NOT IN (subquery)`, deep `OFFSET`, `ORDER BY` without `LIMIT`, implicit joins and more
- `EXPLAIN` reader for PostgreSQL and MySQL: sequential scans, disk sorts, filesort, bad row estimates
- Index suggestions generated from `WHERE`, `JOIN ON` and `ORDER BY` columns
- Optional AI advisor (rewrite + explanation) via the Anthropic API
- History page with average score, trend line and most common problems

## Run it (3 commands, no database account needed)

Requirements: Node 18+ only. MongoDB is built in.

```bash
cd querypilot-mern
npm run install:all     # takes a few minutes the first time
npm run dev
```

When the terminal shows **QueryPilot API is ready**, open http://localhost:5173
and click **Create an account** (any name, any email, password of 8+ characters).

- The API runs on port 5001 and the web app on 5173. The ports are fixed in the code, so they always connect.
- Your data is saved in `server/.data` and survives restarts.
- `server/.env` is already filled in. To use your own MongoDB or Atlas, put its connection string in `MONGO_URI`.
  If that connection fails, the app falls back to the built-in database.
- Add `ANTHROPIC_API_KEY` to `server/.env` to switch on the AI rewrite panel.

### If something goes wrong

| Message | Fix |
|---|---|
| Port 5001 is already in use | `lsof -ti :5001 \| xargs kill`, then `npm run dev` |
| Port 5173 is already in use | `lsof -ti :5173 \| xargs kill`, then `npm run dev` |
| "API server is not ready yet" | Wait for "QueryPilot API is ready" in the terminal |
| Check the API directly | `curl http://localhost:5001/api/health` should print `{"ok":true,...}` |

## Production

```bash
npm run build      # builds client/dist
npm start          # Express serves the API and the built React app
```

## API

| Method | Path                  | Auth | Purpose                          |
|--------|-----------------------|------|----------------------------------|
| POST   | /api/auth/register    | no   | Create account, returns JWT      |
| POST   | /api/auth/login       | no   | Sign in, returns JWT             |
| GET    | /api/auth/me          | yes  | Current user                     |
| POST   | /api/analyze          | yes  | Analyze and save a query         |
| GET    | /api/analyze/history  | yes  | Your past analyses               |
| GET    | /api/analyze/stats    | yes  | Totals, average, trend, top issues |
| GET    | /api/analyze/:id      | yes  | One analysis                     |
| DELETE | /api/analyze/:id      | yes  | Delete an analysis               |

## Folder structure

```
querypilot-mern/
  server/
    src/
      config/db.js
      models/        User.js  Analysis.js
      middleware/    auth.js  error.js
      routes/        auth.js  analyze.js
      services/      sqlAnalyzer.js  aiAdvisor.js
      index.js
    test/analyzer.test.js
  client/
    src/
      components/    Layout  ProtectedRoute  ScoreDial  IssueList  Trend
      pages/         Login  Register  Analyzer  History  AuthShell
      api.js  AuthContext.jsx  App.jsx  main.jsx  styles.css
```

Run the analyzer tests with `npm test --prefix server`.
