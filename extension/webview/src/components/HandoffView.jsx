import React, { useState, useEffect } from 'react';
import { Plus, Check, Clock, AlertCircle, ArrowRight, UserCheck, Sparkles, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

export default function HandoffView({ backendUrl, activeFile }) {
  const [subTab, setSubTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('');

  // Handover form
  const [handoverTitle, setHandoverTitle] = useState('Authentication Module Handover');
  const [toUser, setToUser] = useState('Alice (Frontend Lead)');
  const [summary, setSummary] = useState('Completed JWT token issuance and user password verification logic in auth controller.');
  const [blockers, setBlockers] = useState('Redis token blacklist connection times out in unit tests.');
  const [nextSteps, setNextSteps] = useState('Connect refresh token route to frontend login form and write integration test.');
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/handoff/tasks`);
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch (e) {
      console.warn('Tasks fetch warning:', e.message);
    }
  };

  const fetchHandovers = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/handoff/handovers`);
      const data = await res.json();
      if (Array.isArray(data)) setHandovers(data);
    } catch (e) {
      console.warn('Handovers fetch warning:', e.message);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchHandovers();
  }, [backendUrl]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/handoff/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          owner: newTaskOwner || 'Developer',
          status: 'todo'
        })
      });
      const created = await res.json();
      if (created._id) {
        setTasks([created, ...tasks]);
        setNewTaskTitle('');
        setNewTaskOwner('');
      }
    } catch (e) {
      alert(`Error creating task: ${e.message}`);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${backendUrl}/api/handoff/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const updated = await res.json();
      setTasks(tasks.map((t) => (t._id === taskId ? updated : t)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAiFormatHandover = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch(`${backendUrl}/api/handoff/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawNotes: `${handoverTitle}. ${summary}. Blockers: ${blockers}. Next: ${nextSteps}`,
          filesChanged: [activeFile || 'auth_service.py']
        })
      });
      const data = await res.json();
      if (data.structuredSummary) {
        setSummary(data.structuredSummary);
      }
    } catch (e) {
      alert(`AI error: ${e.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmitHandover = async (e) => {
    e.preventDefault();
    if (!handoverTitle.trim() || !summary.trim() || !nextSteps.trim()) {
      alert('Please fill in Title, Summary, and Next Steps');
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/api/handoff/handovers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: handoverTitle,
          fromUser: 'Current Dev',
          toUser,
          summary,
          modifiedFiles: [activeFile || 'auth_service.py'],
          blockers,
          nextSteps
        })
      });
      const created = await res.json();
      if (created._id) {
        setHandovers([created, ...handovers]);
        setSubTab('handovers');
      }
    } catch (e) {
      alert(`Error creating handover: ${e.message}`);
    }
  };

  const handleAcceptHandover = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/handoff/handovers/${id}/accept`, {
        method: 'POST'
      });
      const updated = await res.json();
      setHandovers(handovers.map((h) => (h._id === id ? updated : h)));
    } catch (e) {
      alert(`Error accepting handover: ${e.message}`);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* Sub-Navigation */}
      <div className="flex bg-[#0a0c10] border border-[#232936] rounded-lg p-1 text-xs">
        <button
          onClick={() => setSubTab('tasks')}
          className={`flex-1 py-1.5 rounded-md transition text-center font-semibold ${
            subTab === 'tasks' ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Team Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setSubTab('createHandover')}
          className={`flex-1 py-1.5 rounded-md transition text-center font-semibold ${
            subTab === 'createHandover' ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Draft Handover
        </button>
        <button
          onClick={() => setSubTab('handovers')}
          className={`flex-1 py-1.5 rounded-md transition text-center font-semibold ${
            subTab === 'handovers' ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Handover Feed ({handovers.length})
        </button>
      </div>

      {/* TASKS VIEW */}
      {subTab === 'tasks' && (
        <div className="space-y-3">
          {/* Quick Add Bar */}
          <form onSubmit={handleCreateTask} className="bg-[#11141b] border border-[#232936] rounded-lg p-3 flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a new engineering task..."
              className="flex-1 bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={newTaskOwner}
              onChange={(e) => setNewTaskOwner(e.target.value)}
              placeholder="Assignee"
              className="w-24 bg-[#0a0c10] border border-[#2c3342] rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              Add Task
            </button>
          </form>

          {/* Task Items */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-[#232936] rounded-lg">
                No active tasks logged. Add your first team milestone above!
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task._id} className="bg-[#11141b] border border-[#232936] rounded-lg p-3 text-xs flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{task.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1c222d] text-slate-300 font-mono border border-[#2a3444]">
                      {task.owner || 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#1e2430]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Status:</span>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task._id, e.target.value)}
                        className="bg-[#0a0c10] text-[11px] border border-[#2c3342] rounded px-2 py-1 text-slate-300"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                      task.status === 'done' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                      task.status === 'blocked' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' :
                      task.status === 'in_progress' ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 bg-slate-500/10'
                    }`}>
                      {task.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CREATE HANDOVER VIEW */}
      {subTab === 'createHandover' && (
        <form onSubmit={handleSubmitHandover} className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-3.5 text-xs shadow-sm">
          <div className="flex items-center justify-between border-b border-[#232936] pb-2.5">
            <div>
              <span className="font-semibold text-slate-200 text-sm block">Structure Shift / Task Handover</span>
              <p className="text-slate-400 text-xs">Transmit full context, decisions, and blockers to your teammate.</p>
            </div>
            <button
              type="button"
              onClick={handleAiFormatHandover}
              disabled={aiGenerating}
              className="text-xs px-2.5 py-1 bg-[#192231] hover:bg-[#202c40] text-emerald-400 border border-emerald-500/30 rounded-md flex items-center gap-1 font-semibold transition"
            >
              <Sparkles size={12} className={aiGenerating ? 'animate-spin' : ''} />
              <span>{aiGenerating ? 'Structuring...' : 'AI Auto-Draft'}</span>
            </button>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Handover Subject:</label>
            <input
              type="text"
              value={handoverTitle}
              onChange={(e) => setHandoverTitle(e.target.value)}
              className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Incoming Developer:</label>
              <input
                type="text"
                value={toUser}
                onChange={(e) => setToUser(e.target.value)}
                className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Associated File:</label>
              <div className="truncate font-mono text-[11px] text-slate-400 bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5">
                {activeFile ? activeFile.split(/[/\\]/).pop() : 'auth_service.py'}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Work Accomplished & Decisions:</label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-rose-400 block mb-1">Known Blockers / Failed Attempts:</label>
            <input
              type="text"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-cyan-400 block mb-1">Immediate Next Actions:</label>
            <input
              type="text"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <Send size={13} />
            <span>Publish Handover to Team Feed</span>
          </button>
        </form>
      )}

      {/* HANDOVER FEED VIEW */}
      {subTab === 'handovers' && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {handovers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-[#232936] rounded-lg">
              No handovers logged yet. Create your first handover above!
            </div>
          ) : (
            handovers.map((h) => (
              <div key={h._id} className="bg-[#11141b] border border-[#232936] rounded-lg p-4 text-xs space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-sm">{h.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                    h.status === 'accepted' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                  }`}>
                    {h.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Author: <strong className="text-slate-200">{h.fromUser}</strong></span>
                  <span>→</span>
                  <span>Recipient: <strong className="text-slate-200">{h.toUser}</strong></span>
                </div>

                <div className="bg-[#0a0c10] p-3 rounded-md border border-[#232936] text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {h.summary}
                </div>

                {h.blockers && (
                  <div className="text-[11px] text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-500/20">
                    <strong>Blocker:</strong> {h.blockers}
                  </div>
                )}

                <div className="text-[11px] text-cyan-300 bg-cyan-950/20 p-2 rounded border border-cyan-500/20">
                  <strong>Next Actions:</strong> {h.nextSteps}
                </div>

                {h.status !== 'accepted' && (
                  <button
                    onClick={() => handleAcceptHandover(h._id)}
                    className="w-full mt-2 py-1.5 bg-[#1a2230] hover:bg-emerald-700 hover:text-white border border-[#2d3a4e] rounded-md text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    <span>Accept Handover & Assume Ownership</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
