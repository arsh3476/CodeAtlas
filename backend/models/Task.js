const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['todo', 'in_progress', 'blocked', 'done'], 
    default: 'todo' 
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  owner: { type: String, default: 'Unassigned' },
  blockers: { type: String, default: '' },
  deadline: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);
