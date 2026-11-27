import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Network, 
  Bookmark, 
  RefreshCw, 
  FileCode, 
  CornerDownLeft, 
  Copy, 
  Check, 
  Search, 
  FileText, 
  ExternalLink, 
  BookOpen,
  Layers,
  X,
  MessageSquare,
  Send,
  Trash2,
  User,
  Bot,
  History,
  Plus,
  Clock,
  GitBranch,
  CornerDownRight,
  Boxes
} from 'lucide-react';
import { getVsCodeApi } from '../vscode';
import MarkdownView from './MarkdownView';
import AstVisualizer from './AstVisualizer';

const SAMPLE_CODE = `export interface ExceptionCase {
  id: number;
  payment_id?: number;
  invoice_id?: number;
  payment_reference?: string;
  invoice_reference?: string;
  customer?: string;
  amount?: string | number;
  type: string;
  status: string;
  investigation_status?: string;
  assignee?: string;
  priority?: string;
  notes?: string;
  evidence?: string;
  due_date?: string;
  reason: string;
  created_at: string;
  resolved_at?: string;
}`;

export default function LearnView({ 
  activeCode, 
  activeFullCode, 
  hasSelection, 
  totalLines, 
  activeFile, 
  backendUrl 
}) {
  const [code, setCode] = useState(activeCode || SAMPLE_CODE);
  const [currentFileName, setCurrentFileName] = useState(activeFile || 'types.ts');
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [astData, setAstData] = useState(null);
  const [astViewMode, setAstViewMode] = useState('tree'); // 'tree' | 'flat'
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);

  // Codebase Search & Bulk Summarize State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSummary, setActiveSummary] = useState(null);
  const [summarizingFile, setSummarizingFile] = useState(null);

  // Conversational Code Q&A & Conversation History State (MongoDB Backed)
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('New Session');
  const [chatMessages, setChatMessages] = useState([]);
  const [savedConversations, setSavedConversations] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const chatBottomRef = useRef(null);

  const vscode = getVsCodeApi();

  // Sync active code from editor
  useEffect(() => {
    if (activeCode && activeCode.trim().length > 0) {
      setCode(activeCode);
    }
    if (activeFile) {
      setCurrentFileName(activeFile);
    }
  }, [activeCode, activeFile]);

  // Fetch saved conversations on mount & when backendUrl changes
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/learn/conversations`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSavedConversations(data);
      }
    } catch (e) {
      console.warn('Could not fetch conversations:', e.message);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [backendUrl]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0 && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatThinking]);

  // Message listener for workspace file results and loaded contents
  useEffect(() => {
    const handleExtensionMsg = async (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'WORKSPACE_FILES_READY') {
        const { files, query } = msg.payload;
        try {
          const res = await fetch(`${backendUrl}/api/learn/search-codebase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, files })
          });
          const data = await res.json();
          if (data.matches) {
            setSearchResults(data.matches);
          }
        } catch (e) {
          console.error('Search ranking error:', e);
        } finally {
          setIsSearching(false);
        }
      }

      if (msg.type === 'FILE_CONTENT_LOADED') {
        const { path: filePath, content, action } = msg.payload;
        if (action === 'inspect') {
          setCode(content);
          setCurrentFileName(filePath);
          setIsEditingCode(false);
        } else if (action === 'summarize') {
          handleBulkSummarize(filePath, content);
        }
      }
    };

    window.addEventListener('message', handleExtensionMsg);
    return () => window.removeEventListener('message', handleExtensionMsg);
  }, [backendUrl]);

  const handleSyncEditor = () => {
    vscode.postMessage({ type: 'REQUEST_EDITOR_SYNC' });
  };

  const handleStartSearch = (queryOverride) => {
    const query = queryOverride || searchQuery;
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    vscode.postMessage({
      type: 'SEARCH_WORKSPACE_FILES',
      payload: { query }
    });
  };

  const handleInspectFile = (filePath) => {
    vscode.postMessage({
      type: 'LOAD_FILE_CONTENT',
      payload: { path: filePath, action: 'inspect' }
    });
  };

  const handleRequestSummarize = (filePath) => {
    setSummarizingFile(filePath);
    vscode.postMessage({
      type: 'LOAD_FILE_CONTENT',
      payload: { path: filePath, action: 'summarize' }
    });
  };

  const handleBulkSummarize = async (filePath, content) => {
    setSummarizingFile(filePath);
    try {
      const res = await fetch(`${backendUrl}/api/learn/summarize-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary({ file: filePath, summary: data.summary });
      }
    } catch (e) {
      alert(`Summarization failed: ${e.message}`);
    } finally {
      setSummarizingFile(null);
    }
  };

  const handleOpenFileInEditor = (filePath) => {
    vscode.postMessage({
      type: 'OPEN_FILE_IN_EDITOR',
      payload: { path: filePath }
    });
  };

  const handleExplain = async () => {
    const codeToExplain = code || activeCode || SAMPLE_CODE;
    setLoading(true);
    setAstData(null);
    try {
      const res = await fetch(`${backendUrl}/api/learn/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToExplain,
          fileName: currentFileName || 'snippet.py'
        })
      });
      const data = await res.json();
      if (data.explanation) {
        setExplanation(data.explanation);
      } else if (data.error) {
        setExplanation(`Backend Error: ${data.error}`);
      }
    } catch (e) {
      setExplanation(`Backend error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceAst = async () => {
    const codeToTrace = code || activeCode || SAMPLE_CODE;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/learn/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToTrace })
      });
      const data = await res.json();
      if (data.functions || data.classes) {
        setAstData(data);
      } else if (data.error) {
        alert(`AST Notice: ${data.error}`);
      }
    } catch (e) {
      alert(`AST Trace error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Conversational Multi-turn Code Q&A with MongoDB Persistence
  const handleSendChatMessage = async (questionOverride) => {
    const question = questionOverride || chatInput;
    if (!question.trim()) return;

    const newMessages = [
      ...chatMessages,
      { role: 'user', content: question.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatThinking(true);

    try {
      const res = await fetch(`${backendUrl}/api/learn/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code || activeCode || SAMPLE_CODE,
          fileName: currentFileName || 'snippet.py',
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
          service: currentFileName ? currentFileName.split(/[/\\]/)[0] : 'General'
        })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages([
          ...newMessages,
          { role: 'assistant', content: data.reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        if (data.title) {
          setConversationTitle(data.title);
        }
        fetchConversations();
      } else if (data.error) {
        setChatMessages([
          ...newMessages,
          { role: 'assistant', content: `Error: ${data.error}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      }
    } catch (e) {
      setChatMessages([
        ...newMessages,
        { role: 'assistant', content: `Connection error: ${e.message}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsChatThinking(false);
    }
  };

  const handleStartNewChat = () => {
    setConversationId(null);
    setConversationTitle('New Session');
    setChatMessages([]);
    setShowHistoryDrawer(false);
  };

  const handleSelectConversation = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/learn/conversations/${id}`);
      const conv = await res.json();
      if (conv._id) {
        setConversationId(conv._id);
        setConversationTitle(conv.title);
        setChatMessages(conv.messages || []);
        if (conv.codeSnippet) {
          setCode(conv.codeSnippet);
        }
        if (conv.fileName) {
          setCurrentFileName(conv.fileName);
        }
        setShowHistoryDrawer(false);
      }
    } catch (e) {
      alert(`Could not load conversation: ${e.message}`);
    }
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`${backendUrl}/api/learn/conversations/${id}`, { method: 'DELETE' });
      setSavedConversations(savedConversations.filter(c => c._id !== id));
      if (conversationId === id) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const conceptQuickQueries = [
    "authentication service",
    "database models",
    "API routes",
    "data preprocessing",
    "test suites"
  ];

  const quickQuestions = [
    "Can any parameter be undefined or null?",
    "What are potential edge cases & exceptions?",
    "What is the time and space complexity?",
    "Suggest 2 unit test cases for this"
  ];

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* 1. CODEBASE CONCEPT SEARCH BAR */}
      <div className="bg-[#11141b] border border-[#232936] rounded-lg p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Search size={13} className="text-emerald-400" /> Codebase Concept & File Explorer
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Workspace Search</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts (e.g., 'authentication service', 'data loader')..."
              className="w-full bg-[#0a0c10] border border-[#2c3342] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
              onKeyDown={(e) => e.key === 'Enter' && handleStartSearch()}
            />
          </div>
          <button
            onClick={() => handleStartSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            {isSearching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            <span>{isSearching ? 'Scanning...' : 'Find Files'}</span>
          </button>
        </div>

        {/* Quick Query Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Explore:</span>
          {conceptQuickQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(q);
                handleStartSearch(q);
              }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#181d27] hover:bg-emerald-950/40 hover:text-emerald-300 text-slate-300 border border-[#273040] transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        {searchResults.length > 0 && (
          <div className="pt-2.5 border-t border-[#232936] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Matched {searchResults.length} files related to "{searchQuery}":</span>
              <button 
                onClick={() => setSearchResults([])}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {searchResults.map((match, idx) => (
                <div 
                  key={idx} 
                  className="bg-[#161b24] p-2.5 rounded border border-[#232936] flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-[#353f52] transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs text-emerald-400 truncate max-w-xs">
                        {match.path}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-mono">
                        {match.relevance}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{match.role}</p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end md:self-auto">
                    <button
                      onClick={() => handleInspectFile(match.path)}
                      title="Load this file into the Code Viewer below for line-by-line explanation"
                      className="text-[11px] px-2 py-1 bg-[#1e2430] hover:bg-[#283142] text-slate-200 rounded border border-[#2c3342] transition flex items-center gap-1"
                    >
                      <FileCode size={11} className="text-cyan-400" />
                      <span>Inspect</span>
                    </button>

                    <button
                      onClick={() => handleRequestSummarize(match.path)}
                      disabled={summarizingFile === match.path}
                      title="Generate a high-level architectural overview of this file"
                      className="text-[11px] px-2 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded font-medium transition flex items-center gap-1"
                    >
                      {summarizingFile === match.path ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <BookOpen size={11} />
                      )}
                      <span>Summarize</span>
                    </button>

                    <button
                      onClick={() => handleOpenFileInEditor(match.path)}
                      title="Open file in VS Code editor"
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#202735] rounded transition"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. BULK ARCHITECTURAL SUMMARY CARD (If generated) */}
      {activeSummary && (
        <div className="bg-[#11141b] border border-emerald-500/40 rounded-lg p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#232936] pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Layers size={13} /> Bulk Architectural Summary: {activeSummary.file.split(/[/\\]/).pop()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(activeSummary.summary)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#202735] transition"
                title="Copy summary"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
              <button
                onClick={() => setActiveSummary(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#202735] transition"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="p-3 bg-[#0a0c10] rounded border border-[#232936] max-h-80 overflow-y-auto">
            <MarkdownView content={activeSummary.summary} />
          </div>
        </div>
      )}

      {/* 3. CODE INSPECTOR CARD */}
      <div className="bg-[#11141b] border border-[#232936] rounded-lg shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="bg-[#161b24] px-3.5 py-2.5 border-b border-[#232936] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-emerald-400" />
            <span className="font-mono text-xs font-semibold text-slate-200">
              {currentFileName ? currentFileName.split(/[/\\]/).pop() : 'snippet.py'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2430] text-emerald-400 border border-[#2c3342] font-mono">
              {hasSelection ? `Selection: ${code.split('\n').length} of ${totalLines || (activeFullCode ? activeFullCode.split('\n').length : code.split('\n').length)} lines` : `${code.split('\n').length} lines (Complete file)`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {hasSelection && activeFullCode && (
              <button
                onClick={() => {
                  setCode(activeFullCode);
                }}
                title="Load the complete file into placeholder instead of the partial selection"
                className="text-[11px] px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 flex items-center gap-1 font-medium transition"
              >
                <BookOpen size={11} /> Load Full File ({totalLines || activeFullCode.split('\n').length} lines)
              </button>
            )}
            <button
              onClick={() => setIsEditingCode(!isEditingCode)}
              className="text-[11px] px-2 py-1 rounded bg-[#1e2430] hover:bg-[#283142] text-slate-300 border border-[#2c3342] transition"
            >
              {isEditingCode ? 'View Preview' : 'Edit / Paste'}
            </button>
            <button
              onClick={handleSyncEditor}
              title="Sync selection from the active VS Code editor"
              className="text-[11px] px-2 py-1 rounded bg-[#1e2430] hover:bg-[#283142] text-slate-300 border border-[#2c3342] flex items-center gap-1 transition"
            >
              <RefreshCw size={11} /> Sync
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="p-3">
          {isEditingCode ? (
            <textarea
              rows={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste or edit code here..."
              className="w-full bg-[#0a0c10] text-[#c9d1d9] font-mono text-xs p-3 rounded border border-[#232936] focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
            />
          ) : (
            <div className="bg-[#0a0c10] rounded text-xs font-mono overflow-auto max-h-72 border border-[#232936] select-text">
              <table className="w-full border-collapse">
                <tbody>
                  {code.split('\n').map((line, idx) => (
                    <tr key={idx} className="hover:bg-[#141a24]/60">
                      <td className="text-slate-600 select-none py-0.5 px-2.5 text-right text-[11px] align-top w-10 border-r border-[#1e2430] bg-[#0c0f14]">
                        {idx + 1}
                      </td>
                      <td className="text-[#d1d7e0] py-0.5 px-3 whitespace-pre font-mono">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Row */}
          <div className="flex gap-2.5 mt-3">
            <button
              onClick={handleExplain}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Sparkles size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Analyzing Code...' : 'Explain Code Line-by-Line'}</span>
            </button>

            <button
              onClick={handleTraceAst}
              disabled={loading}
              title="Parse AST to identify function definitions, arguments, and call hierarchy"
              className="flex items-center justify-center gap-1.5 py-2 px-3.5 bg-[#1a202c] hover:bg-[#242c3d] disabled:opacity-50 text-slate-200 border border-[#2d3748] rounded-md text-xs font-medium transition"
            >
              <Network size={14} className="text-cyan-400" />
              <span>Trace Flow (AST)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. AST CALL GRAPH & SYNTAX TREE VISUALIZER */}
      <AstVisualizer astData={astData} />

      {/* 5. NEMOTRON EXPLANATION CARD (Rendered in Rich Markdown) */}
      {explanation && (
        <div className="bg-[#11141b] border border-[#232936] rounded-lg shadow-sm overflow-hidden">
          <div className="bg-[#161b24] px-3.5 py-2.5 border-b border-[#232936] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-400" /> Explanation & Line-by-Line Breakdown
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(explanation)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#202735] transition"
                title="Copy explanation"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
              <button
                onClick={() => setBookmarked(!bookmarked)}
                className={`p-1 rounded hover:bg-[#202735] transition ${bookmarked ? 'text-amber-400' : 'text-slate-400'}`}
                title="Bookmark explanation"
              >
                <Bookmark size={13} />
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[550px] overflow-y-auto select-text">
            <MarkdownView content={explanation} />
          </div>
        </div>
      )}

      {/* 6. DEDICATED CODE Q&A CONVERSATION THREAD (Organized Conversations Saved in MongoDB) */}
      <div className="bg-[#11141b] border border-[#232936] rounded-lg shadow-sm overflow-hidden space-y-0">
        {/* Block Header with Thread Switcher & History Drawer */}
        <div className="bg-[#161b24] px-3.5 py-2.5 border-b border-[#232936] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[220px]" title={conversationTitle}>
              {conversationTitle}
            </span>
            {chatMessages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1c222d] text-slate-400 font-mono">
                {chatMessages.length} msgs
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Chat Button */}
            <button
              onClick={handleStartNewChat}
              title="Start a fresh conversation thread for another file or service"
              className="text-[11px] px-2 py-1 bg-[#1e2430] hover:bg-emerald-950/40 hover:text-emerald-300 text-slate-300 border border-[#2c3342] rounded flex items-center gap-1 font-medium transition"
            >
              <Plus size={11} className="text-emerald-400" /> New Chat
            </button>

            {/* History Toggle Button */}
            <button
              onClick={() => {
                fetchConversations();
                setShowHistoryDrawer(!showHistoryDrawer);
              }}
              title="View past conversation logs stored in MongoDB"
              className={`text-[11px] px-2 py-1 rounded flex items-center gap-1 font-medium transition border ${
                showHistoryDrawer
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-[#1e2430] hover:bg-[#283142] text-slate-300 border-[#2c3342]'
              }`}
            >
              <History size={11} /> 
              <span>Past Chats ({savedConversations.length})</span>
            </button>
          </div>
        </div>

        {/* Saved Conversations Dropdown / Drawer */}
        {showHistoryDrawer && (
          <div className="bg-[#0d1017] p-3 border-b border-[#232936] space-y-2 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-[#232936]/40">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Clock size={11} /> Saved Conversation Logs (MongoDB)
              </span>
              <span className="text-[10px] text-slate-500">Click to resume thread</span>
            </div>

            {savedConversations.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No previous conversations logged yet.</p>
            ) : (
              <div className="space-y-1.5">
                {savedConversations.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => handleSelectConversation(c._id)}
                    className={`p-2 rounded border cursor-pointer flex items-center justify-between text-xs transition ${
                      conversationId === c._id
                        ? 'bg-[#182232] border-emerald-500/40 text-emerald-300'
                        : 'bg-[#141923] border-[#232936] hover:bg-[#1a2130] text-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 truncate max-w-[80%]">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>{c.fileName ? c.fileName.split(/[/\\]/).pop() : 'General'}</span>
                        <span>•</span>
                        <span>{c.messageCount} messages</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteConversation(e, c._id)}
                      title="Delete thread from MongoDB"
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation Message List */}
        <div className="p-4 space-y-3.5 max-h-[420px] overflow-y-auto">
          {chatMessages.length === 0 ? (
            <div className="py-6 px-3 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Bot size={16} />
              </div>
              <p className="text-xs text-slate-300 font-medium">Ask questions grounded directly in this code</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Questions and answers are permanently logged in MongoDB. When you switch services, click "+ New Chat" to start an organized new thread!
              </p>
            </div>
          ) : (
            chatMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={13} className="text-emerald-400" />
                  </div>
                )}

                <div 
                  className={`max-w-[85%] rounded-lg p-3 text-xs shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[#1e2533] text-slate-100 border border-[#2d3a4e]'
                      : 'bg-[#0f1218] border border-[#232936] text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-[#232936]/40 pb-1">
                    <span className="font-semibold">{msg.role === 'user' ? 'You' : 'CodeAtlas Assistant'}</span>
                    <span className="font-mono text-[9px]">{msg.timestamp}</span>
                  </div>

                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownView content={msg.content} />
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-[#252f40] border border-[#35435b] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={13} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}

          {isChatThinking && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={13} className="text-emerald-400 animate-pulse" />
              </div>
              <div className="bg-[#0f1218] border border-[#232936] rounded-lg p-2.5 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-emerald-400" />
                <span>CodeAtlas Assistant is thinking...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3.5 py-2 bg-[#141821] border-t border-[#232936] flex items-center gap-1.5 flex-wrap">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendChatMessage(q)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#1c222d] hover:bg-emerald-950/40 hover:text-emerald-300 text-slate-300 border border-[#2a3444] transition"
            >
              + {q}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-[#161b24] border-t border-[#232936]">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask anything about this code (e.g. edge cases, bugs, types)..."
              disabled={isChatThinking}
              className="flex-1 bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              onKeyDown={(e) => e.key === 'Enter' && !isChatThinking && handleSendChatMessage()}
            />
            <button
              onClick={() => handleSendChatMessage()}
              disabled={isChatThinking || !chatInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Ask</span>
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
