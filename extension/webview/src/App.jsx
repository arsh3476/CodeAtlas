import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LearnView from './components/LearnView';
import CoderView from './components/CoderView';
import HandoffView from './components/HandoffView';
import { getVsCodeApi } from './vscode';

const BACKEND_URL = 'http://localhost:5000';

export default function App() {
  const [activeTab, setActiveTab] = useState('learn');
  const [activeFile, setActiveFile] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [activeFullCode, setActiveFullCode] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const [totalLines, setTotalLines] = useState(0);
  const [backendStatus, setBackendStatus] = useState(null);

  // Poll backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`);
        const data = await res.json();
        setBackendStatus(data);
      } catch (e) {
        setBackendStatus({ status: 'offline', mongoConnected: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen to messages from VS Code extension host
  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (!message || !message.type) return;

      switch (message.type) {
        case 'SELECTION_CHANGED':
          if (message.payload?.code) {
            setActiveCode(message.payload.code);
          }
          if (message.payload?.fullCode) {
            setActiveFullCode(message.payload.fullCode);
          }
          if (message.payload?.file) {
            setActiveFile(message.payload.file);
          }
          setHasSelection(Boolean(message.payload?.hasSelection));
          if (message.payload?.totalLines) {
            setTotalLines(message.payload.totalLines);
          }
          break;
        case 'SWITCH_TAB':
          if (message.payload?.tab) {
            setActiveTab(message.payload.tab);
          }
          break;
        case 'TRIGGER_EXPLAIN':
          setActiveTab('learn');
          if (message.payload?.code) {
            setActiveCode(message.payload.code);
          }
          if (message.payload?.fullCode) {
            setActiveFullCode(message.payload.fullCode);
          }
          if (message.payload?.file) {
            setActiveFile(message.payload.file);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Tell extension we are ready
    const vscode = getVsCodeApi();
    vscode.postMessage({ type: 'WEBVIEW_READY' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
      />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'learn' && (
          <LearnView
            activeCode={activeCode}
            activeFullCode={activeFullCode}
            hasSelection={hasSelection}
            totalLines={totalLines}
            activeFile={activeFile}
            backendUrl={BACKEND_URL}
          />
        )}
        {activeTab === 'coder' && (
          <CoderView
            activeCode={activeCode}
            activeFullCode={activeFullCode}
            activeFile={activeFile}
            backendUrl={BACKEND_URL}
          />
        )}
        {activeTab === 'handoff' && (
          <HandoffView
            activeFile={activeFile}
            backendUrl={BACKEND_URL}
          />
        )}
      </main>
    </div>
  );
}
