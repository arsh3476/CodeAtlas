const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fileName: { type: String, default: 'General' },
  codeSnippet: { type: String, default: '' },
  service: { type: String, default: 'General' },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: String }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
