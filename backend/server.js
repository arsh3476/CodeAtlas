const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // fallback for root .env
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const learnRoutes = require('./routes/learn');
const coderRoutes = require('./routes/coder');
const handoffRoutes = require('./routes/handoff');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
let isDbConnected = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeatlas';

mongoose.connect(MONGO_URI)
  .then(() => {
    isDbConnected = true;
    console.log(`[CodeAtlas DB] Connected to MongoDB: ${MONGO_URI}`);
  })
  .catch((err) => {
    isDbConnected = false;
    console.warn(`[CodeAtlas DB Warning] MongoDB not connected (${err.message}). In-memory / mock mode enabled for testing.`);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/coder', coderRoutes);
app.use('/api/handoff', handoffRoutes);

// Health & Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeAtlas Backend API',
    mongoConnected: isDbConnected,
    llmConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    aiProvider: 'Gemini'
  });
});

app.listen(PORT, () => {
  console.log(`[CodeAtlas Backend] Server running on http://localhost:${PORT}`);
});
