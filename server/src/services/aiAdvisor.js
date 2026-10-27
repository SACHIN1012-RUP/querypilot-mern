/**
 * Optional AI layer. If ANTHROPIC_API_KEY is missing, the app still works
 * with the rule-based analyzer and the UI simply hides the AI panel.
 */
export async function getAiAdvice({ query, dialect, issues, planFindings, tables }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { enabled: false };

  const system =
    'You are a senior database performance engineer. Reply with ONLY a JSON object, no markdown fences: ' +
    '{"summary": string (2-3 sentences, plain language), "rewrittenQuery": string (optimized SQL, same results), ' +
    '"notes": string[] (up to 4 short, specific tips)}. Never change what the query returns.';

  const user = JSON.stringify({
    dialect,
    tables,
    query,
    detectedIssues: issues.map((i) => i.title),
    planFindings: planFindings.map((i) => i.title),
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { enabled: true, error: `AI request failed (${res.status}). ${body.slice(0, 160)}` };
    }

    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return {
      enabled: true,
      summary: parsed.summary,
      rewrittenQuery: parsed.rewrittenQuery,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 4) : [],
    };
  } catch (err) {
    return { enabled: true, error: `AI advice unavailable: ${err.message}` };
  }
}
