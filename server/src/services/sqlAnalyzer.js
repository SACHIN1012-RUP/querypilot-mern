/**
 * Rule-based SQL performance analyzer.
 * Works without any external service. Each rule returns an issue with a
 * severity, a plain-language explanation and a concrete fix.
 */

const PENALTY = { critical: 22, warning: 10, info: 3 };

const stripNoise = (sql) =>
  sql
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "'?'")
    .replace(/\s+/g, ' ')
    .trim();

const grade = (s) => (s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');

function statementType(clean) {
  const m = clean.match(/^\s*(\(?\s*)?(with|select|insert|update|delete)\b/i);
  return m ? m[2].toLowerCase() : 'unknown';
}

function extractTables(clean) {
  const tables = new Set();
  const re = /\b(?:from|join|update|into)\s+([a-zA-Z_][\w.]*)/gi;
  let m;
  while ((m = re.exec(clean))) tables.add(m[1].toLowerCase());
  return [...tables];
}

function clauseOf(clean, keyword, stops) {
  const re = new RegExp(`\\b${keyword}\\b([\\s\\S]*?)(?=\\b(?:${stops.join('|')})\\b|;|$)`, 'i');
  const m = clean.match(re);
  return m ? m[1].trim() : '';
}

function columnsIn(fragment) {
  const cols = new Set();
  const re = /([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)?)\s*(?:=|<>|!=|<=|>=|<|>|\bnot\s+like\b|\blike\b|\bilike\b|\bin\b|\bbetween\b|\bis\b)/gi;
  let m;
  while ((m = re.exec(fragment))) {
    const c = m[1];
    if (!/^(and|or|not|null|true|false)$/i.test(c)) cols.add(c.toLowerCase());
  }
  return [...cols];
}

const bare = (col) => col.split('.').pop();

export function analyzeSql(sql, dialect = 'postgresql') {
  const clean = stripNoise(sql);
  // Keeps string literals (needed to inspect LIKE patterns), drops comments only
  const withLiterals = sql.replace(/--.*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const type = statementType(clean);
  const tables = extractTables(clean);
  const issues = [];
  const add = (id, severity, title, detail, fix) => issues.push({ id, severity, title, detail, fix });

  const where = clauseOf(clean, 'where', ['group\\s+by', 'order\\s+by', 'limit', 'having', 'offset', 'returning']);
  const orderBy = clauseOf(clean, 'order\\s+by', ['limit', 'offset']);
  const hasLimit = /\blimit\b|\bfetch\s+first\b|\btop\s+\d+/i.test(clean);
  const joinCount = (clean.match(/\bjoin\b/gi) || []).length;

  if (!clean) {
    return { score: 0, grade: 'F', type, tables, issues: [], indexSuggestions: [] };
  }

  // 1. UPDATE / DELETE without WHERE
  if ((type === 'update' || type === 'delete') && !where) {
    add('no-where-write', 'critical', `${type.toUpperCase()} without WHERE`,
      'Every row in the table is rewritten or removed, takes a long lock and generates heavy logging.',
      'Add a WHERE clause on an indexed column, or batch the work in small ranges.');
  }

  // 2. SELECT *
  if (/select\s+(distinct\s+)?\*/i.test(clean) || /select\s+[\w.]+\.\*/i.test(clean)) {
    add('select-star', 'warning', 'SELECT * reads every column',
      'Wider rows mean more I/O, more memory and they block index-only scans.',
      'List only the columns the screen or API actually needs.');
  }

  // 3. SELECT with no filter and no limit
  if (type === 'select' && !where && !hasLimit && !/\bgroup\s+by\b/i.test(clean) && !/\b(count|sum|avg|min|max)\s*\(/i.test(clean)) {
    add('full-scan', 'critical', 'Unfiltered SELECT scans the whole table',
      'No WHERE and no LIMIT means the database reads and returns every row.',
      'Filter with WHERE, paginate with LIMIT, or aggregate before returning.');
  }

  // 4. Leading wildcard LIKE
  if (/\b(i?like)\s+'[%_]/i.test(withLiterals)) {
    add('leading-wildcard', 'critical', 'LIKE pattern starts with a wildcard',
      'A B-tree index cannot be used when the match starts with % or _, so the table is scanned.',
      dialect === 'postgresql'
        ? 'Use a trigram index (pg_trgm GIN) or full-text search (tsvector).'
        : 'Use a FULLTEXT index, or anchor the pattern as LIKE \'abc%\'.');
  }

  // 5. Function on indexed column in WHERE
  const fnOnCol = where.match(/\b(lower|upper|date|year|month|day|substr|substring|trim|cast|coalesce|to_char|date_trunc)\s*\(\s*[a-zA-Z_][\w.]*/i);
  if (fnOnCol) {
    add('function-on-column', 'warning', `${fnOnCol[1].toUpperCase()}() wraps a column in WHERE`,
      'Wrapping a column in a function hides it from a normal index, forcing a scan.',
      'Compare the raw column against a computed value (ranges for dates), or create an expression index.');
  }

  // 6. OR conditions
  if (/\bor\b/i.test(where)) {
    add('or-condition', 'info', 'OR in WHERE can defeat index use',
      'The planner may fall back to a scan when OR spans different columns.',
      'Rewrite as UNION ALL of two indexed queries, or use IN (...) for one column.');
  }

  // 7. NOT IN with subquery
  if (/\bnot\s+in\s*\(\s*select\b/i.test(clean)) {
    add('not-in-subquery', 'warning', 'NOT IN (subquery) is slow and NULL-unsafe',
      'It often runs row by row and returns no rows if the subquery yields a NULL.',
      'Use NOT EXISTS or a LEFT JOIN ... IS NULL anti-join.');
  }

  // 8. IN (subquery)
  if (/\bin\s*\(\s*select\b/i.test(clean)) {
    add('in-subquery', 'info', 'IN (subquery) can usually be a join',
      'Older planners materialise the subquery for every outer row.',
      'Rewrite with EXISTS or an INNER JOIN so the planner can pick a join strategy.');
  }

  // 9. Correlated subquery in SELECT list
  if (/select[\s\S]*\(\s*select\b[\s\S]*?\bfrom\b[\s\S]*?\bwhere\b[\s\S]*?\)\s*(as\s+\w+)?\s*,?[\s\S]*\bfrom\b/i.test(clean) && type === 'select' && /select\s[^()]*\(\s*select/i.test(clean)) {
    add('correlated-subquery', 'warning', 'Subquery inside the SELECT list',
      'It may execute once per returned row (the N+1 pattern inside SQL).',
      'Pre-aggregate in a CTE or join to a grouped derived table.');
  }

  // 10. ORDER BY without LIMIT
  if (orderBy && !hasLimit) {
    add('order-no-limit', 'warning', 'ORDER BY without LIMIT sorts every row',
      'Sorting a large result is memory heavy and may spill to disk.',
      'Add LIMIT for pagination, or index the sort column so rows come pre-sorted.');
  }

  // 11. Deep OFFSET
  const off = clean.match(/\boffset\s+(\d+)/i);
  if (off && Number(off[1]) >= 1000) {
    add('deep-offset', 'warning', `OFFSET ${off[1]} skips rows the hard way`,
      'The database still reads and discards every skipped row.',
      'Use keyset pagination: WHERE id > :last_seen_id ORDER BY id LIMIT n.');
  }

  // 12. Implicit cross join
  const fromClause = clauseOf(clean, 'from', ['where', 'group\\s+by', 'order\\s+by', 'limit', 'join', 'having']);
  if (type === 'select' && /,/.test(fromClause) && !/\(/.test(fromClause)) {
    add('implicit-join', 'warning', 'Comma-separated tables in FROM',
      'Old-style joins are easy to turn into accidental cross products.',
      'Use explicit JOIN ... ON conditions.');
  }

  // 13. Many joins
  if (joinCount >= 4) {
    add('many-joins', 'info', `${joinCount} joins in one query`,
      'Join order search space grows quickly and estimates get less accurate.',
      'Check that each join column is indexed and consider splitting into CTEs.');
  }

  // 14. DISTINCT
  if (/select\s+distinct\b/i.test(clean) && joinCount > 0) {
    add('distinct-join', 'info', 'DISTINCT over a join may hide duplicate rows',
      'The database must sort or hash the full result to de-duplicate it.',
      'Fix the join condition or use EXISTS instead of joining just to filter.');
  }

  // 15. HAVING without aggregates
  const having = clauseOf(clean, 'having', ['order\\s+by', 'limit']);
  if (having && !/\b(count|sum|avg|min|max)\s*\(/i.test(having)) {
    add('having-filter', 'info', 'HAVING used as a row filter',
      'HAVING runs after grouping, so rows are grouped before they are filtered.',
      'Move non-aggregate conditions into WHERE.');
  }

  // 16. INSERT in a loop hint
  if (type === 'insert' && !/\bvalues\s*\([^)]*\)\s*,\s*\(/i.test(clean) && !/\bselect\b/i.test(clean)) {
    add('single-insert', 'info', 'Single-row INSERT',
      'If this runs in a loop, each call pays a network and commit round trip.',
      'Batch rows into one multi-row INSERT or use COPY / bulk write.');
  }

  // Index suggestions from WHERE / JOIN ON / ORDER BY columns
  const mainTable = tables[0];
  const eqCols = columnsIn(where).map(bare);
  const joinCols = [];
  const joinRe = /\bon\s+([\s\S]*?)(?=\b(?:join|where|group\s+by|order\s+by|limit)\b|;|$)/gi;
  let jm;
  while ((jm = joinRe.exec(clean))) joinCols.push(...columnsIn(jm[1]).map(bare));
  const orderCols = orderBy
    ? orderBy.split(',').map((c) => bare(c.trim().split(' ')[0].toLowerCase())).filter(Boolean)
    : [];

  const indexSuggestions = [];
  if (mainTable && eqCols.length) {
    const cols = [...new Set([...eqCols, ...orderCols])].slice(0, 3);
    indexSuggestions.push(`CREATE INDEX idx_${mainTable.replace(/\W/g, '_')}_${cols.join('_')} ON ${mainTable} (${cols.join(', ')});`);
  } else if (mainTable && orderCols.length) {
    indexSuggestions.push(`CREATE INDEX idx_${mainTable.replace(/\W/g, '_')}_${orderCols.join('_')} ON ${mainTable} (${orderCols.join(', ')});`);
  }
  [...new Set(joinCols)].slice(0, 3).forEach((c) => {
    const stmt = `-- Join key: confirm ${c} is indexed on the joined table\nCREATE INDEX IF NOT EXISTS idx_${c} ON <joined_table> (${c});`;
    indexSuggestions.push(stmt);
  });

  const penalty = issues.reduce((t, i) => t + PENALTY[i.severity], 0);
  const score = Math.max(0, 100 - penalty);

  return { score, grade: grade(score), type, tables, issues, indexSuggestions };
}

/**
 * Reads pasted EXPLAIN / EXPLAIN ANALYZE output (PostgreSQL or MySQL text)
 * and reports the usual red flags.
 */
export function analyzePlan(plan = '') {
  const findings = [];
  if (!plan.trim()) return findings;
  const add = (id, severity, title, detail, fix) => findings.push({ id, severity, title, detail, fix });

  const seq = plan.match(/Seq Scan on (\w+)/i);
  if (seq) add('seq-scan', 'warning', `Sequential scan on ${seq[1]}`,
    'The whole table is read. That is fine for tiny tables and costly for large ones.',
    `Index the columns in the filter that touches ${seq[1]}.`);

  if (/type:\s*ALL\b|\bALL\b\s+NULL\s+NULL/i.test(plan))
    add('mysql-all', 'warning', 'MySQL full table scan (type=ALL)',
      'The optimizer found no usable index.', 'Add an index on the WHERE or JOIN columns.');

  if (/Sort Method:\s*external/i.test(plan))
    add('disk-sort', 'critical', 'Sort spilled to disk',
      'The sort did not fit in work_mem, which makes it much slower.',
      'Index the ORDER BY column, add LIMIT, or raise work_mem for this session.');

  if (/Using filesort/i.test(plan))
    add('filesort', 'warning', 'MySQL filesort', 'Rows are sorted outside an index.',
      'Create an index that matches the ORDER BY.');

  if (/Using temporary/i.test(plan))
    add('temp-table', 'warning', 'MySQL temporary table', 'Grouping or sorting built a temp table.',
      'Index the GROUP BY columns or simplify the query.');

  if (/Nested Loop/i.test(plan) && /Seq Scan/i.test(plan))
    add('nested-seq', 'critical', 'Nested loop over a sequential scan',
      'The inner side is scanned again for every outer row.',
      'Index the join column on the inner table.');

  const est = plan.match(/rows=(\d+)[^)]*\)\s*\(actual[^)]*rows=(\d+)/i);
  if (est) {
    const [e, a] = [Number(est[1]), Number(est[2])];
    if (e > 0 && (a / e > 10 || e / Math.max(a, 1) > 10))
      add('bad-estimate', 'info', `Row estimate off: planned ${e}, actual ${a}`,
        'The planner is working from stale or too-coarse statistics.', 'Run ANALYZE on the table.');
  }

  const time = plan.match(/Execution Time:\s*([\d.]+)\s*ms/i);
  if (time && Number(time[1]) > 500)
    add('slow-exec', 'warning', `Execution took ${time[1]} ms`,
      'Anything above about half a second is noticeable on interactive pages.',
      'Fix the highest-cost node in the plan first.');

  return findings;
}
