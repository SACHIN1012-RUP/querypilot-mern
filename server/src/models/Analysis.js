import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    id: String,
    severity: { type: String, enum: ['critical', 'warning', 'info'] },
    title: String,
    detail: String,
    fix: String,
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query: { type: String, required: true, maxlength: 20000 },
    dialect: { type: String, default: 'postgresql' },
    explainPlan: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100 },
    grade: String,
    tables: [String],
    issues: [issueSchema],
    indexSuggestions: [String],
    planFindings: [issueSchema],
    ai: {
      enabled: { type: Boolean, default: false },
      summary: String,
      rewrittenQuery: String,
      notes: [String],
      error: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Analysis', analysisSchema);
