const mongoose = require('mongoose');

const HandoverSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fromUser: { type: String, required: true },
  toUser: { type: String, required: true },
  summary: { type: String, required: true },
  modifiedFiles: [{ type: String }],
  decisions: { type: String, default: '' },
  blockers: { type: String, default: '' },
  nextSteps: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  acceptedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Handover', HandoverSchema);
