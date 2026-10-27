// Left-hand panel shared by Login and Register: a query plan drawn as a tree.
export default function AuthShell({ title, subtitle, onSubmit, children, footer }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <h2>See why a query is slow before your users do.</h2>
        <svg viewBox="0 0 360 250" className="plan">
          <g className="edge">
            <path d="M180 48 L90 112" />
            <path d="M180 48 L270 112" />
            <path d="M90 150 L50 200" />
            <path d="M90 150 L130 200" />
          </g>
          <g className="node">
            <rect x="120" y="14" width="120" height="34" rx="6" />
            <text x="180" y="35">Hash Join</text>
          </g>
          <g className="node bad">
            <rect x="30" y="112" width="120" height="38" rx="6" />
            <text x="90" y="129">Seq Scan</text>
            <text x="90" y="143" className="sub">orders · 2.4M rows</text>
          </g>
          <g className="node good">
            <rect x="210" y="112" width="120" height="38" rx="6" />
            <text x="270" y="129">Index Scan</text>
            <text x="270" y="143" className="sub">users_pkey</text>
          </g>
          <g className="node small">
            <rect x="0" y="200" width="100" height="30" rx="6" />
            <text x="50" y="219">Filter</text>
            <rect x="110" y="200" width="100" height="30" rx="6" />
            <text x="160" y="219">Sort</text>
          </g>
        </svg>
        <p>Paste SQL, get a score, the exact problems and the indexes to add.</p>
      </section>
      <section className="auth-form">
        <form onSubmit={onSubmit} className="card narrow">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
        </form>
        <p className="auth-foot">{footer}</p>
      </section>
    </div>
  );
}
