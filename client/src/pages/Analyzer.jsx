import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import ScoreDial from '../components/ScoreDial.jsx';
import IssueList from '../components/IssueList.jsx';

const SAMPLE = `SELECT *
FROM orders o, customers c
WHERE o.customer_id = c.id
  AND LOWER(c.email) LIKE '%@gmail.com'
  AND o.status NOT IN (SELECT status FROM closed_statuses)
ORDER BY o.created_at DESC;`;

export default function Analyzer() {
  const { id } = useParams();
  const [query, setQuery] = useState('');
  const [dialect, setDialect] = useState('postgresql');
  const [plan, setPlan] = useState('');
  const [showPlan, setShowPlan] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!id) {
      setResult(null);
      setQuery('');
      setPlan('');
      setShowPlan(false);
      setError('');
      return;
    }
    api.getAnalysis(id).then((r) => {
      setResult(r);
      setQuery(r.query);
      setDialect(r.dialect);
      setPlan(r.explainPlan || '');
      setShowPlan(Boolean(r.explainPlan));
    }).catch((e) => setError(e.message));
  }, [id]);

  const run = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setResult(await api.analyze({ query, dialect, explainPlan: plan, useAi }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Analyze a query</h1>
        <p className="muted">Paste SQL. Add an EXPLAIN plan if you have one for sharper findings.</p>
      </header>

      <form className="card" onSubmit={run}>
        <div className="row">
          <label className="grow">SQL query
            <textarea className="code" rows={9} value={query} spellCheck={false}
              placeholder="SELECT id, email FROM users WHERE ..."
              onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="row controls">
          <label>Database
            <select value={dialect} onChange={(e) => setDialect(e.target.value)}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="sqlserver">SQL Server</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
            Ask the AI advisor for a rewrite
          </label>
          <button type="button" className="btn ghost" onClick={() => setShowPlan((v) => !v)}>
            {showPlan ? 'Hide EXPLAIN plan' : 'Add EXPLAIN plan'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setQuery(SAMPLE)}>Load example</button>
          <button className="btn" disabled={busy || !query.trim()}>{busy ? 'Analyzing' : 'Analyze query'}</button>
        </div>
        {showPlan && (
          <label>EXPLAIN (ANALYZE) output
            <textarea className="code" rows={7} value={plan} spellCheck={false}
              placeholder="Seq Scan on orders  (cost=0.00..18334.00 rows=1000000 ...)"
              onChange={(e) => setPlan(e.target.value)} />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {result && (
        <section className="results" aria-live="polite">
          <div className="card summary">
            <ScoreDial score={result.score} grade={result.grade} />
            <div>
              <h2>
                {result.issues.length
                  ? `${result.issues.length} ${result.issues.length === 1 ? 'problem' : 'problems'} found`
                  : 'No problems found'}
              </h2>
              <p className="muted">
                Tables: {result.tables.length ? result.tables.join(', ') : 'none detected'}
              </p>
              {result.ai?.summary && <p className="ai-summary">{result.ai.summary}</p>}
            </div>
          </div>

          <div className="card">
            <h3>Query issues</h3>
            <IssueList items={result.issues} empty="Nothing to fix. This query follows the common performance rules." />
          </div>

          {result.planFindings?.length > 0 && (
            <div className="card">
              <h3>Execution plan findings</h3>
              <IssueList items={result.planFindings} empty="" />
            </div>
          )}

          {result.indexSuggestions?.length > 0 && (
            <div className="card">
              <h3>Suggested indexes</h3>
              {result.indexSuggestions.map((s, i) => (
                <div className="snippet" key={i}>
                  <pre>{s}</pre>
                  <button className="btn ghost small" onClick={() => copy(s, `idx${i}`)}>
                    {copied === `idx${i}` ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
              <p className="muted">Test every index on a copy of your data first. Each one speeds reads and slows writes.</p>
            </div>
          )}

          {result.ai?.rewrittenQuery && (
            <div className="card">
              <h3>AI rewrite</h3>
              <div className="snippet">
                <pre>{result.ai.rewrittenQuery}</pre>
                <button className="btn ghost small" onClick={() => copy(result.ai.rewrittenQuery, 'ai')}>
                  {copied === 'ai' ? 'Copied' : 'Copy'}
                </button>
              </div>
              {result.ai.notes?.length > 0 && (
                <ul className="notes">{result.ai.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              )}
            </div>
          )}

          {result.ai?.error && <p className="muted">{result.ai.error} The rule-based results above are still valid.</p>}
        </section>
      )}
    </div>
  );
}
