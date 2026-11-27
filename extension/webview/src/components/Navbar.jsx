import React from 'react';
import { BookOpen, Code2, Users, ExternalLink, Activity } from 'lucide-react';
import { getVsCodeApi } from '../vscode';

export default function Navbar({ activeTab, setActiveTab, backendStatus }) {
  const vscode = getVsCodeApi();

  const tabs = [
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'coder', label: 'AI Coder', icon: Code2 },
    { id: 'handoff', label: 'HandoffIQ', icon: Users },
  ];

  const handlePopOut = () => {
    vscode.postMessage({ type: 'OPEN_FULL_TAB' });
  };

  const isOnline = backendStatus?.status === 'ok';
  const isMongoReady = backendStatus?.mongoConnected;

  return (
    <header className="border-b border-[#232936] bg-[#11141b] px-4 py-2.5 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
            <span className="text-emerald-400 font-mono font-bold text-xs">C</span>
          </div>
          <span className="font-semibold text-xs tracking-wider text-slate-100 uppercase">CodeAtlas</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1c222d] text-slate-400 border border-[#2d3647] font-mono">v1.0</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status Pip */}
          <div 
            className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[#181d27] border border-[#273040]" 
            title={isOnline ? `Backend: Online | MongoDB: ${isMongoReady ? 'Connected' : 'Offline'}` : 'Backend: Offline (Run npm start in /backend)'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? (isMongoReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400') : 'bg-rose-500'}`}></span>
            <span className="text-slate-300 text-[10px] font-mono">
              {isOnline ? (isMongoReady ? 'Ready' : 'Mock DB') : 'Offline'}
            </span>
          </div>

          {/* Pop out to Tab button */}
          <button
            onClick={handlePopOut}
            title="Open in full editor tab beside active file"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2635] transition"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      <nav className="flex space-x-1.5 bg-[#0a0c10] p-1 rounded-lg border border-[#232936]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#1b222f] text-emerald-400 shadow-sm border border-[#2e3a4e]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141923]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
