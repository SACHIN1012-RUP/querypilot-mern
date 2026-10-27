import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSql } from '../src/services/sqlAnalyzer.js';

test('flags SELECT * and leading wildcard', () => {
  const r = analyzeSql("SELECT * FROM users WHERE name LIKE '%son'");
  const ids = r.issues.map((i) => i.id);
  assert.ok(ids.includes('select-star'));
  assert.ok(ids.includes('leading-wildcard'));
  assert.ok(r.score < 80);
});

test('flags DELETE without WHERE as critical', () => {
  const r = analyzeSql('DELETE FROM orders');
  assert.equal(r.issues[0].severity, 'critical');
});

test('clean indexed query scores high and suggests an index', () => {
  const r = analyzeSql('SELECT id, email FROM users WHERE email = $1 LIMIT 1');
  assert.ok(r.score >= 90);
  assert.ok(r.indexSuggestions[0].includes('users'));
});
