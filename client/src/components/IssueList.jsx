const LABEL = { critical: 'Critical', warning: 'Warning', info: 'Suggestion' };

export default function IssueList({ items, empty }) {
  if (!items?.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="issues">
      {items.map((i) => (
        <li key={i.id} className={`issue ${i.severity}`}>
          <div className="issue-head">
            <span className="tag">{LABEL[i.severity]}</span>
            <h4>{i.title}</h4>
          </div>
          <p>{i.detail}</p>
          <p className="fix"><strong>Fix:</strong> {i.fix}</p>
        </li>
      ))}
    </ul>
  );
}
