const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { callNemotron, callNemotronChat } = require('../llm');
const CodeSession = require('../models/CodeSession');
const Conversation = require('../models/Conversation');

// 1. Line-by-line and contextual explanation
router.post('/explain', async (req, res) => {
  try {
    const { code, fileName, contextPrompt } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code snippet is required' });
    }

    const lineCount = code.split('\n').length;
    const isLargeFile = lineCount > 120;

    let systemPrompt;
    let prompt;

    if (isLargeFile) {
      // shortcut: for files over 120 lines, group by functional blocks to prevent hitting output token ceilings
      systemPrompt = `You are CodeAtlas Learn, an expert programming instructor.
The provided file is large (${lineCount} lines). Explain the code logically by grouping definitions, classes, functions, and key blocks by their line ranges (e.g. Lines 1-30, Lines 31-75).
Format your output cleanly in Markdown:
1. High-Level Summary (What does this complete file/module do?)
2. Structural & Block Breakdown (Walk through each major section and function by line ranges, explaining inputs, outputs, and business logic)
3. Key Invariants & Edge Cases (What data validations, critical exceptions, or type constraints exist?)
4. Comprehension Check (2 quick questions to test understanding)`;

      prompt = `File: ${fileName || 'source_file'}\nTotal Lines: ${lineCount}\nAdditional Context: ${contextPrompt || 'None'}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nPlease provide a comprehensive structural breakdown covering all key components across the entire file.`;
    } else {
      const numberedCode = code.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
      systemPrompt = `You are CodeAtlas Learn, an expert programming instructor. 
Your goal is to help developers understand unfamiliar code line-by-line.
Analyze ALL lines of the provided code completely from top to bottom without skipping any definitions, statements, or fields.
Format your output cleanly in Markdown:
1. High-Level Summary (What does this complete block do in 2 sentences?)
2. Line-by-Line Breakdown (Walk through every numbered line from 1 to ${lineCount} sequentially. Explain the exact role of each line/field/declaration. Never truncate or stop early.)
3. Dry Run / Edge Cases (What happens with unexpected inputs, missing optional fields, or invalid types?)
4. Comprehension Check (2 quick questions to test understanding)`;

      prompt = `File: ${fileName || 'snippet.py'}\nTotal Lines: ${lineCount}\nAdditional Context: ${contextPrompt || 'None'}\n\nCode with line numbers:\n\`\`\`\n${numberedCode}\n\`\`\`\n\nPlease provide a complete line-by-line breakdown explaining every single numbered line from 1 to ${lineCount}.`;
    }

    const explanation = await callNemotron({ prompt, systemPrompt, maxTokens: 4096 });

    // Save session to MongoDB if available
    let session = null;
    try {
      session = await CodeSession.create({
        fileName: fileName || 'snippet.py',
        selectedCode: code,
        explanation
      });
    } catch (dbErr) {
      // shortcut: DB write failure does not break the user response, upgrade to mandatory logging when scaled
      console.warn('Could not save session to MongoDB:', dbErr.message);
    }

    res.json({
      success: true,
      explanation,
      sessionId: session ? session._id : null
    });
  } catch (err) {
    console.error('Error in /api/learn/explain:', err);
    res.status(500).json({ error: err.message });
  }
});

function astToMermaid(rootNode) {
  if (!rootNode) return "";
  const lines = [
    "graph TD",
    "  classDef control fill:#cce5ff,stroke:#66b2ff,stroke-width:1.5px,color:#0f172a;",
    "  classDef op fill:#dbeafe,stroke:#93c5fd,stroke-width:1.5px,color:#0f172a;",
    "  classDef var fill:#d4edda,stroke:#8fd19e,stroke-width:1.5px,color:#0f172a;",
    "  classDef const fill:#fff3cd,stroke:#ffeeba,stroke-width:1.5px,color:#0f172a;",
    "  classDef default fill:#f1f5f9,stroke:#cbd5e1,stroke-width:1.5px,color:#0f172a;"
  ];
  let counter = 0;
  function traverse(node) {
    counter++;
    const nodeId = `n${counter}`;
    const rawName = node.name || "node";
    const label = rawName.replace(/"/g, "'").replace(/\n/g, "<br/>");
    const ntype = node.type || "control";
    let css = "control";
    if (ntype === "op") css = "op";
    else if (ntype === "variable") css = "var";
    else if (ntype === "constant") css = "const";
    lines.push(`  ${nodeId}["${label}"]:::${css}`);
    if (node.children) {
      for (const child of node.children) {
        if (child) {
          const childId = traverse(child);
          if (child.edge) {
            lines.push(`  ${nodeId} -- "${child.edge}" --> ${childId}`);
          } else {
            lines.push(`  ${nodeId} --> ${childId}`);
          }
        }
      }
    }
    return nodeId;
  }
  traverse(rootNode);
  return lines.join("\n");
}

// Helper: Universal AST parser for JavaScript, TypeScript, and general code
function parseUniversalAST(code) {
  const lines = code.split('\n');
  const functions = [];
  const classes = [];
  const imports = [];

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();

    if (/^(import|from|const\s+.*\s*=\s*require)\b/.test(trimmed)) {
      imports.push(trimmed.replace(/;$/, ''));
    }

    const classMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:class|interface)\s+([A-Za-z0-9_$]+)/);
    if (classMatch) {
      classes.push({
        name: classMatch[1],
        line: lineNum,
        endLine: lineNum,
        methods: []
      });
    }

    const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?(?:function\s+|def\s+)([A-Za-z0-9_$]+)\s*\(([^)]*)\)/)
      || trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/)
      || trimmed.match(/^([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*\{\s*$/);

    if (fnMatch) {
      const name = fnMatch[1];
      const rawArgs = fnMatch[2] || '';
      const args = rawArgs.split(',').map(a => a.trim().split(/[:=]/)[0].trim()).filter(Boolean);
      
      const calls = new Set();
      for (let j = idx + 1; j < Math.min(lines.length, idx + 40); j++) {
        const nextLine = lines[j].trim();
        if (/^(?:export\s+)?(?:async\s+)?(?:function|def|class|interface)\b/.test(nextLine)) break;
        const callMatches = nextLine.matchAll(/([A-Za-z0-9_$]+)\s*\(/g);
        for (const m of callMatches) {
          const callName = m[1];
          if (!['if', 'for', 'while', 'switch', 'catch', 'function', 'return'].includes(callName)) {
            calls.add(callName);
          }
        }
      }

      functions.push({
        name,
        line: lineNum,
        endLine: Math.min(lines.length, lineNum + 10),
        args,
        calls: Array.from(calls).slice(0, 12)
      });
    }
  });

  const definedFnNames = new Set(functions.map(f => f.name));
  const calledFnNames = new Set();

  functions.forEach(f => {
    f.internalCalls = f.calls.filter(c => definedFnNames.has(c));
    f.externalCalls = f.calls.filter(c => !definedFnNames.has(c));
    f.internalCalls.forEach(c => calledFnNames.add(c));
  });

  functions.forEach(f => {
    f.isEntryPoint = !calledFnNames.has(f.name);
  });

  // Extract control flow statements for diagram
  const stmtNodes = [];
  lines.forEach((lineText) => {
    const trimmed = lineText.trim();
    const whileMatch = trimmed.match(/^while\s*\((.*)\)/);
    if (whileMatch) {
      stmtNodes.push({
        name: "while",
        type: "control",
        children: [
          { name: `condition<br/>${whileMatch[1] || 'test'}`, type: "op", edge: "condition" },
          { name: "body", type: "control", edge: "body", children: [] }
        ]
      });
    }

    const ifMatch = trimmed.match(/^if\s*\((.*)\)/);
    if (ifMatch) {
      stmtNodes.push({
        name: "branch",
        type: "control",
        children: [
          { name: `compare<br/>op: ${ifMatch[1] || 'test'}`, type: "op", edge: "condition" },
          { name: "if-body", type: "control", edge: "if-body", children: [] }
        ]
      });
    }

    const returnMatch = trimmed.match(/^return\s*(.*);?$/);
    if (returnMatch && returnMatch[1]) {
      stmtNodes.push({
        name: "return",
        type: "control",
        children: [
          { name: `variable<br/>name: ${returnMatch[1].replace(/;$/, '').trim()}`, type: "variable" }
        ]
      });
    }
  });

  functions.forEach(fn => {
    const fnChildren = [];
    if (fn.internalCalls && fn.internalCalls.length > 0) {
      fn.internalCalls.forEach(callee => {
        fnChildren.push({ name: `call<br/>${callee}()`, type: "control", edge: "calls internal" });
      });
    }
    if (fn.externalCalls && fn.externalCalls.length > 0) {
      fn.externalCalls.slice(0, 5).forEach(callee => {
        fnChildren.push({ name: `call<br/>${callee}()`, type: "op", edge: "calls api" });
      });
    }
    stmtNodes.push({
      name: `function<br/>${fn.name}()`,
      type: "control",
      children: fnChildren
    });
  });

  let astTree = null;
  let mermaidDiagram = "";
  if (stmtNodes.length > 0) {
    astTree = {
      name: "statement<br/>sequence",
      type: "control",
      children: stmtNodes
    };
    mermaidDiagram = astToMermaid(astTree);
  }

  const hasClassHierarchy = classes.some(c => c.methods && c.methods.length > 0);
  const hasCallHierarchy = functions.some(f => (f.internalCalls && f.internalCalls.length > 0) || (f.externalCalls && f.externalCalls.length > 0));
  const hasHierarchy = Boolean(stmtNodes.length > 0 || hasClassHierarchy || hasCallHierarchy);

  return { imports, classes, functions, astTree, mermaidDiagram, hasHierarchy };
}

// 2. Python & Universal AST Call Flow & Feature Trace
router.post('/trace', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const scriptPath = path.join(__dirname, '..', 'scripts', 'ast_analyzer.py');
    let responded = false;

    const child = spawn('python', [scriptPath]);

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('error', (spawnErr) => {
      if (responded) return;
      responded = true;
      // Fallback cleanly to universal AST parser if python is not in PATH
      const parsed = parseUniversalAST(code);
      return res.json({ success: true, ...parsed, language: 'Universal' });
    });

    child.on('close', (exitCode) => {
      if (responded) return;
      responded = true;

      if (exitCode !== 0) {
        const fallback = parseUniversalAST(code);
        return res.json({ success: true, ...fallback, language: 'Universal' });
      }

      try {
        const parsed = JSON.parse(output);
        if (parsed.error) {
          // SyntaxError in Python AST means non-Python code (e.g. TypeScript, JavaScript)
          const fallback = parseUniversalAST(code);
          return res.json({ success: true, ...fallback, language: 'Universal' });
        }
        return res.json({ success: true, ...parsed, language: 'Python' });
      } catch (e) {
        const fallback = parseUniversalAST(code);
        return res.json({ success: true, ...fallback, language: 'Universal' });
      }
    });

    child.stdin.write(code);
    child.stdin.end();
  } catch (err) {
    const fallback = parseUniversalAST(req.body.code || '');
    res.json({ success: true, ...fallback, language: 'Universal' });
  }
});

// 3. Get Learning Sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await CodeSession.find().sort({ createdAt: -1 }).limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Bookmark a session
router.post('/bookmark/:id', async (req, res) => {
  try {
    const session = await CodeSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.bookmarked = !session.bookmarked;
    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Codebase Concept & File Search
router.post('/search-codebase', async (req, res) => {
  try {
    const { query, files } = req.body;
    if (!query || !files || files.length === 0) {
      return res.json({ success: true, matches: [] });
    }

    // Heuristic keyword pre-filter for speed
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const candidateFiles = files.map(f => {
      const lowerPath = f.path.toLowerCase();
      const lowerPreview = (f.preview || '').toLowerCase();
      let score = 0;
      queryTokens.forEach(token => {
        if (lowerPath.includes(token)) score += 5;
        const matchesInPreview = (lowerPreview.match(new RegExp(token, 'g')) || []).length;
        score += Math.min(matchesInPreview, 10);
      });
      return { ...f, score };
    }).sort((a, b) => b.score - a.score).slice(0, 15);

    // Prompt Nemotron to rank and describe top matches
    const systemPrompt = `You are CodeAtlas Codebase Search Engine.
Given a user search query and candidate source files with preview snippets:
1. Identify the files most relevant to the query.
2. For each relevant file, describe its primary responsibility in one clear sentence.
3. Assign a relevance percentage (e.g., "95%", "85%").
Output strictly valid JSON in this exact structure without markdown fences:
[
  { "path": "path/to/file.py", "relevance": "95%", "role": "Handles user login and JWT signing" }
]`;

    const candidateStr = candidateFiles.map(f => 
      `Path: ${f.path}\nLines: ${f.totalLines || 'unknown'}\nPreview:\n${(f.preview || '').substring(0, 300)}`
    ).join('\n---\n');

    const prompt = `Search Query: "${query}"\n\nCandidate Files:\n${candidateStr}\n\nReturn JSON array of matched files:`;

    let matches = [];
    try {
      const rawResponse = await callNemotron({ prompt, systemPrompt, temperature: 0.1 });
      const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      }
    } catch (llmErr) {
      console.warn('Nemotron search parsing fallback:', llmErr.message);
    }

    // Fallback if LLM parsing produced no results
    if (matches.length === 0 && candidateFiles.length > 0) {
      matches = candidateFiles.filter(f => f.score > 0).slice(0, 5).map(f => ({
        path: f.path,
        relevance: `${Math.min(95, 60 + f.score * 5)}%`,
        role: `Matched keywords for "${query}" in path or symbols.`
      }));
    }

    res.json({ success: true, matches });
  } catch (err) {
    console.error('Error in /api/learn/search-codebase:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Bulk File Architectural Summary
router.post('/summarize-file', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'File content is required' });
    }

    const systemPrompt = `You are CodeAtlas Senior Architect. Provide a comprehensive architectural overview of this file.
Structure your reply in clean Markdown:
1. Primary Responsibility (What problem does this file solve in 2 sentences?)
2. Core Components & Exports (Functions, Classes, Routers)
3. External Dependencies & Integration Points
4. Critical Invariants or Potential Vulnerabilities
5. Quick Start Guide for New Contributors`;

    const prompt = `File: ${filePath || 'source_file'}\n\nContent:\n\`\`\`\n${content.substring(0, 8000)}\n\`\`\`\n\nPlease provide the architectural summary.`;
    const summary = await callNemotron({ prompt, systemPrompt });

    res.json({ success: true, summary });
  } catch (err) {
    console.error('Error in /api/learn/summarize-file:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Interactive Conversational Q&A (Code Q&A Thread with MongoDB Persistence)
router.post('/chat', async (req, res) => {
  try {
    const { code, fileName, messages, conversationId, service } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemPrompt = `You are CodeAtlas Learn Assistant, an expert AI programming mentor.
You are in a multi-turn conversation with a developer discussing this specific code snippet:
File: ${fileName || 'active_file'}
Code:
\`\`\`
${code || '// No code provided'}
\`\`\`

Guidelines:
- Answer the developer's questions specifically and concisely based on this code.
- If they ask about edge cases, variables, or missing types, refer directly to lines or symbols.
- Format all code, lists, and tables using clean GitHub-flavored Markdown.`;

    const chatPayload = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const reply = await callNemotronChat({ messages: chatPayload });

    // Persist conversation to MongoDB in real-time
    let convDoc = null;
    try {
      const lastUserMsg = messages[messages.length - 1];
      const assistantMsg = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (conversationId) {
        convDoc = await Conversation.findById(conversationId);
        if (convDoc) {
          convDoc.messages.push(lastUserMsg);
          convDoc.messages.push(assistantMsg);
          convDoc.updatedAt = new Date();
          await convDoc.save();
        }
      }

      if (!convDoc) {
        // Auto-create a new conversation thread with clean title
        const titleSnippet = lastUserMsg.content.substring(0, 36) + (lastUserMsg.content.length > 36 ? '...' : '');
        const threadTitle = `${titleSnippet} (${(fileName || 'snippet.py').split(/[/\\]/).pop()})`;
        
        convDoc = await Conversation.create({
          title: threadTitle,
          fileName: fileName || 'snippet.py',
          codeSnippet: (code || '').substring(0, 2000),
          service: service || 'General',
          messages: [...messages, assistantMsg],
          updatedAt: new Date()
        });
      }
    } catch (dbErr) {
      console.warn('Could not persist conversation to MongoDB:', dbErr.message);
    }

    res.json({ 
      success: true, 
      reply,
      conversationId: convDoc ? convDoc._id : null,
      title: convDoc ? convDoc.title : null
    });
  } catch (err) {
    console.error('Error in /api/learn/chat:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. List all saved conversations (sorted by recency)
router.get('/conversations', async (req, res) => {
  try {
    const list = await Conversation.find()
      .select('title fileName service createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(50);
    
    const formatted = list.map(c => ({
      _id: c._id,
      title: c.title,
      fileName: c.fileName,
      service: c.service,
      messageCount: c.messages ? c.messages.length : 0,
      updatedAt: c.updatedAt
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get single conversation with full message logs
router.get('/conversations/:id', async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Delete a conversation thread
router.delete('/conversations/:id', async (req, res) => {
  try {
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
