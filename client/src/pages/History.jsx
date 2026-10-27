import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Trend from '../components/Trend.jsx';

const when = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function History() {
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([api.history(), api.stats()])
      .then(([h, s]) => { setItems(h); setStats(s); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm('Delete this analysis?')) return;
    try { await api.deleteAnalysis(id); load(); } catch (e) { setError(e.message); }
  };

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!items) return <div className="page"><p className="muted">Loading history</p></div>;

  return (
    <div className="page">
      <header className="page-head">
        <h1>History</h1>
        <p className="muted">Every query you have analyzed, newest first.</p>
      </header>

      {stats && stats.total > 0 && (
        <div className="stats">
          <div className="card stat"><span className="big">{stats.total}</span><span>queries analyzed</span></div>
          <div className="card stat"><span className="big">{stats.avgScore}</span><span>average score</span></div>
          <div className="card stat wide">
            <span>Score over your last {stats.trend.length} analyses</span>
            <Trend points={stats.trend} />
          </div>
          <div className="card stat wide">
            <span>Most common problems</span>
            <ol className="top">
              {stats.topIssues.map((t) => <li key={t.title}>{t.title} <b>{t.count}</b></li>)}
            </ol>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card empty">
          <h3>No analyses yet</h3>
          <p className="muted">Run your first query and it will show up here.</p>
          <Link className="btn" to="/">Analyze a query</Link>
        </div>
      ) : (
        <ul className="history">
          {items.map((a) => (
            <li key={a._id} className="card hist">
              <span className={`grade g${a.grade}`}>{a.grade}</span>
              <Link to={`/analysis/${a._id}`} className="hist-main">
                <code>{a.query.replace(/\s+/g, ' ').slice(0, 110)}{a.query.length > 110 ? '...' : ''}</code>
                <small>{a.score}/100, {a.issues.length} issues, {a.dialect}, {when(a.createdAt)}</small>
              </Link>
              <button className="btn ghost small" onClick={() => remove(a._id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
