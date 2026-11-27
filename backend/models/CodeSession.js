const mongoose = require('mongoose');

const CodeSessionSchema = new mongoose.Schema({
  title: { type: String, default: 'Explanation' },
  fileName: { type: String, default: 'unknown' },
  selectedCode: { type: String, required: true },
  explanation: { type: String, required: true },
  author: { type: String, default: 'Developer' },
  bookmarked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodeSession', CodeSessionSchema);
