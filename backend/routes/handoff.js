const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Handover = require('../models/Handover');
const WorkLog = require('../models/WorkLog');
const { callNemotron } = require('../llm');

// --- TASKS ---
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { title, description, priority, owner, blockers, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await Task.create({
      title,
      description,
      priority: priority || 'medium',
      owner: owner || 'Unassigned',
      blockers: blockers || '',
      deadline: deadline || ''
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WORK LOGS ---
router.get('/logs', async (req, res) => {
  try {
    const logs = await WorkLog.find().sort({ createdAt: -1 }).limit(30);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs', async (req, res) => {
  try {
    const { author, summary, filesModified, decisions, blockers, nextSteps } = req.body;
    const log = await WorkLog.create({
      author: author || 'Developer',
      summary,
      filesModified: Array.isArray(filesModified) ? filesModified : [filesModified],
      decisions,
      blockers,
      nextSteps
    });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HANDOVERS ---
router.get('/handovers', async (req, res) => {
  try {
    const handovers = await Handover.find().sort({ createdAt: -1 });
    res.json(handovers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/handovers', async (req, res) => {
  try {
    const { title, fromUser, toUser, summary, modifiedFiles, decisions, blockers, nextSteps } = req.body;
    if (!title || !summary || !nextSteps) {
      return res.status(400).json({ error: 'Title, summary, and nextSteps are required' });
    }

    const handover = await Handover.create({
      title,
      fromUser: fromUser || 'Developer',
      toUser: toUser || 'Team',
      summary,
      modifiedFiles: Array.isArray(modifiedFiles) ? modifiedFiles : (modifiedFiles ? [modifiedFiles] : []),
      decisions: decisions || '',
      blockers: blockers || '',
      nextSteps
    });
    res.json(handover);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/handovers/:id/accept', async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id);
    if (!handover) return res.status(404).json({ error: 'Handover not found' });
    handover.status = 'accepted';
    handover.acceptedAt = new Date();
    await handover.save();
    res.json(handover);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI-Assisted Handover generation from rough notes / git diff
router.post('/generate-summary', async (req, res) => {
  try {
    const { rawNotes, filesChanged } = req.body;
    const systemPrompt = `You are HandoffIQ Assistant. Convert raw developer notes and changed files into a structured, crystal-clear engineering handover.
Format with:
- Executive Summary (1-2 sentences)
- Technical Decisions Made
- Known Blockers / Edge Cases
- Exact Next Steps for the Next Teammate`;

    const prompt = `Files Changed: ${(filesChanged || []).join(', ')}\n\nRaw Notes:\n${rawNotes || 'No notes provided'}`;
    const structuredSummary = await callNemotron({ prompt, systemPrompt });

    res.json({ success: true, structuredSummary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
