export default function Trend({ points }) {
  if (!points?.length) return null;
  const w = 220, h = 56, pad = 4;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [pad + i * step, h - pad - (p.score / 100) * (h - pad * 2)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend" role="img" aria-label="Score trend over recent analyses">
      <path d={d} fill="none" stroke="#0E8E9B" strokeWidth="2" strokeLinejoin="round" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#0F2A43" />)}
    </svg>
  );
}
