const mongoose = require('mongoose');

const WorkLogSchema = new mongoose.Schema({
  author: { type: String, required: true },
  summary: { type: String, required: true },
  filesModified: [{ type: String }],
  decisions: { type: String, default: '' },
  blockers: { type: String, default: '' },
  nextSteps: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkLog', WorkLogSchema);
