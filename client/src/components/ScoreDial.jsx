const COLORS = { A: '#2A8C63', B: '#5E9F3B', C: '#D9A300', D: '#D9731F', F: '#C23B2B' };

export default function ScoreDial({ score, grade }) {
  const r = 70;
  const arc = Math.PI * r; // half circle length
  const filled = (Math.max(0, Math.min(100, score)) / 100) * arc;
  const color = COLORS[grade] || COLORS.F;

  return (
    <figure className="dial" aria-label={`Performance score ${score} out of 100, grade ${grade}`}>
      <svg viewBox="0 0 180 104" role="img">
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="#DCE4EC" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`}
          className="dial-fill"
        />
        <text x="90" y="82" textAnchor="middle" className="dial-score">{score}</text>
        <text x="90" y="100" textAnchor="middle" className="dial-label">out of 100</text>
      </svg>
      <figcaption style={{ color }}>Grade {grade}</figcaption>
    </figure>
  );
}
