import { Router } from 'express';
import Analysis from '../models/Analysis.js';
import { protect } from '../middleware/auth.js';
import { analyzeSql, analyzePlan } from '../services/sqlAnalyzer.js';
import { getAiAdvice } from '../services/aiAdvisor.js';

const router = Router();
router.use(protect);

router.post('/', async (req, res, next) => {
  try {
    const { query, dialect = 'postgresql', explainPlan = '', useAi = true } = req.body || {};
    if (!query || !query.trim()) return res.status(400).json({ message: 'Paste a SQL query to analyze.' });
    if (query.length > 20000) return res.status(400).json({ message: 'Query is too long (20,000 characters max).' });

    const result = analyzeSql(query, dialect);
    const planFindings = analyzePlan(explainPlan);

    const ai = useAi
      ? await getAiAdvice({ query, dialect, issues: result.issues, planFindings, tables: result.tables })
      : { enabled: false };

    const doc = await Analysis.create({
      user: req.user._id,
      query,
      dialect,
      explainPlan,
      score: Math.max(0, result.score - planFindings.filter((f) => f.severity === 'critical').length * 8),
      grade: result.grade,
      tables: result.tables,
      issues: result.issues,
      indexSuggestions: result.indexSuggestions,
      planFindings,
      ai,
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const items = await Analysis.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('query score grade dialect tables issues createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const all = await Analysis.find({ user: req.user._id }).select('score issues createdAt');
    const total = all.length;
    const avgScore = total ? Math.round(all.reduce((t, a) => t + a.score, 0) / total) : 0;
    const counts = {};
    all.forEach((a) => a.issues.forEach((i) => (counts[i.title] = (counts[i.title] || 0) + 1)));
    const topIssues = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));
    const trend = all
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-12)
      .map((a) => ({ score: a.score, at: a.createdAt }));
    res.json({ total, avgScore, topIssues, trend });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Analysis.findOne({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Analysis not found.' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Analysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Analysis not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
