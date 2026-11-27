import React, { useEffect, useMemo, useState } from 'react';
import {
  Code2, GitCompare, Check, AlertTriangle, Play, RefreshCw,
  BookOpen, Bug, WandSparkles, FileCode2
} from 'lucide-react';
import { getVsCodeApi } from '../vscode';
import MarkdownView from './MarkdownView';

const MODES = [
  { id: 'generate', label: 'Generate', icon: Code2, description: 'Create a feature from a requirement.' },
  { id: 'explain', label: 'Explain', icon: BookOpen, description: 'Understand the current file.' },
  { id: 'fix', label: 'Fix bugs', icon: Bug, description: 'Find and correct a problem.' },
  { id: 'refactor', label: 'Refactor', icon: WandSparkles, description: 'Improve code without changing behaviour.' }
];

const SAMPLE_OLD_SPEC = `{
  "openapi": "3.0.0",
  "paths": {
    "/api/users": {
      "get": {
        "summary": "List users",
        "parameters": [{ "name": "page", "in": "query", "schema": { "type": "integer" } }]
      }
    }
  }
}`;

const SAMPLE_NEW_SPEC = `{
  "openapi": "3.0.0",
  "paths": {
    "/api/v2/users": {
      "get": {
        "summary": "List users",
        "parameters": [{ "name": "cursor", "in": "query", "required": true, "schema": { "type": "string" } }]
      },
      "post": { "summary": "Create user" }
    }
  }
}`;

export default function CoderView({ activeCode, activeFullCode, activeFile, backendUrl }) {
  const [mode, setMode] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposedCode, setProposedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [showImpact, setShowImpact] = useState(false);
  const [apiTab, setApiTab] = useState('tester');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [requestUrl, setRequestUrl] = useState('http://localhost:5000/api/health');
  const [requestHeaders, setRequestHeaders] = useState('{}');
  const [requestParams, setRequestParams] = useState('{}');
  const [requestBody, setRequestBody] = useState('{\n  \"name\": \"John\"\n}');
  const [apiResponse, setApiResponse] = useState(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [endpointEvidence, setEndpointEvidence] = useState([]);
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5000');
  const [endpointChecks, setEndpointChecks] = useState({});
  const [oldSpec, setOldSpec] = useState(SAMPLE_OLD_SPEC);
  const [newSpec, setNewSpec] = useState(SAMPLE_NEW_SPEC);
  const [impactResult, setImpactResult] = useState('');
  const [impactLoading, setImpactLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const vscode = getVsCodeApi();
  const currentCode = useMemo(() => activeFullCode || activeCode || '', [activeFullCode, activeCode]);
  const fileLabel = activeFile ? activeFile.split(/[/\\]/).pop() : 'No file open';

  useEffect(() => {
    const receive = (event) => {
      const message = event.data || {};
      if (message.type === 'WORKSPACE_API_FILES_READY') {
        setScanLoading(false);
        fetch(`${backendUrl}/api/coder/scan-endpoints`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: message.payload?.files || [] })
        }).then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Endpoint scan failed');
          setScanResult(data); setEndpointEvidence(data.endpoints || []);
        }).catch(error => setScanResult({ error: error.message }));
      } else if (message.type === 'WORKSPACE_API_FILES_ERROR') {
        setScanLoading(false); setScanResult({ error: message.payload?.error || 'Could not read workspace files.' });
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [backendUrl]);

  const sendApiRequest = async () => {
    setApiTestLoading(true); setApiResponse(null);
    try {
      let headers, params, parsedBody;
      try { headers = JSON.parse(requestHeaders || '{}'); params = JSON.parse(requestParams || '{}'); }
      catch { throw new Error('Headers and query parameters must be valid JSON objects.'); }
      if (!headers || Array.isArray(headers) || typeof headers !== 'object' || !params || Array.isArray(params) || typeof params !== 'object') throw new Error('Headers and query parameters must be JSON objects.');
      if (requestBody.trim() && !['GET','DELETE'].includes(httpMethod)) {
        try { parsedBody = JSON.parse(requestBody); } catch { parsedBody = requestBody; }
      }
      const response = await fetch(`${backendUrl}/api/coder/api-test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: httpMethod, url: requestUrl, headers, params, body: parsedBody })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setApiResponse(data);
    } catch (error) { setApiResponse({ error: error.message }); }
    finally { setApiTestLoading(false); }
  };

  const scanWorkspace = () => {
    setScanLoading(true); setScanResult(null);
    vscode.postMessage({ type: 'SCAN_WORKSPACE_API_FILES' });
  };

  const testScannedEndpoint = async (item) => {
    const key = `${item.method} ${item.path}`;
    setEndpointChecks(previous => ({ ...previous, [key]: { loading: true } }));
    try {
      const response = await fetch(`${backendUrl}/api/coder/api-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: item.method, url: `${apiBaseUrl.replace(/\/$/, '')}${item.path}` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setEndpointChecks(previous => ({ ...previous, [key]: { status: data.status, success: data.success, responseTime: data.responseTime } }));
    } catch (error) { setEndpointChecks(previous => ({ ...previous, [key]: { error: error.message } })); }
  };

  const runMode = async (selectedMode = mode, overridePrompt = prompt) => {
    if (selectedMode !== 'explain' && !overridePrompt.trim()) {
      setError('Describe what you want the AI Coder to do.');
      return;
    }
    if (!currentCode.trim() && selectedMode !== 'generate') {
      setError('Open a source file in VS Code before using this action.');
      return;
    }

    setLoading(true);
    setError('');
    setProposedCode('');
    setExplanation('');
    setApplied(false);

    try {
      const endpoint = selectedMode === 'generate' ? 'generate'
        : selectedMode === 'fix' ? 'fix'
        : selectedMode === 'refactor' ? 'refactor'
        : 'explain';

      const body = selectedMode === 'explain'
        ? { code: currentCode, fileName: activeFile || 'untitled' }
        : {
            prompt: overridePrompt,
            currentFileContent: currentCode,
            fileName: activeFile || 'untitled'
          };

      const response = await fetch(`${backendUrl}/api/coder/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

      if (selectedMode === 'explain') {
        setExplanation(data.explanation || 'No explanation was returned.');
      } else {
        setProposedCode(data.proposedCode || '');
        setExplanation(data.explanation || '');
        if (!data.proposedCode) throw new Error('The AI did not return proposed code. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDiff = () => {
    if (!proposedCode) return;
    vscode.postMessage({
      type: 'SHOW_DIFF',
      payload: { proposedCode, fileName: activeFile }
    });
  };

  const handleApplyPatch = () => {
    if (!proposedCode) return;
    const confirmed = window.confirm(
      `Replace the contents of ${fileLabel} with the proposed code? Save a backup first if needed.`
    );
    if (!confirmed) return;

    vscode.postMessage({
      type: 'APPLY_PATCH',
      payload: { code: proposedCode, fileName: activeFile }
    });
    setApplied(true);
  };

  const handleImpact = async () => {
    setImpactLoading(true);
    setImpactResult('');
    try {
      const response = await fetch(`${backendUrl}/api/coder/impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSpec, newSpec, endpointEvidence, workspaceFiles: endpointEvidence.flatMap(item => [...(item.files || []), ...(item.references || [])]) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setImpactResult(data.analysis || 'No analysis was returned.');
    } catch (err) {
      setImpactResult(`**Error:** ${err.message}`);
    } finally {
      setImpactLoading(false);
    }
  };

  const suggestions = [
    'Create a function that validates an email address.',
    'Add input validation and clear error handling.',
    'Write unit tests for the important functions.',
    'Optimize this code while keeping its behaviour unchanged.'
  ];

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Code2 size={16} className="text-emerald-400" /> CodeAtlas AI Coder
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Generate, understand, fix and improve code with your current file as context.
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded border border-[#2c3342] bg-[#161b24] text-slate-300 font-mono truncate max-w-[45%]">
          {fileLabel}
        </span>
      </div>

      <div className="flex bg-[#0a0c10] border border-[#232936] rounded-lg p-1 text-xs gap-1">
        <button
          onClick={() => setShowImpact(false)}
          className={`flex-1 py-2 rounded-md font-semibold ${!showImpact ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'}`}
        >
          AI Coding Workspace
        </button>
        <button
          onClick={() => setShowImpact(true)}
          className={`flex-1 py-2 rounded-md font-semibold ${showImpact ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'}`}
        >
          API Analyzer
        </button>
      </div>

      {!showImpact ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MODES.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setMode(item.id); setError(''); setProposedCode(''); setExplanation(''); }}
                  className={`text-left p-3 rounded-lg border transition ${mode === item.id ? 'bg-emerald-950/30 border-emerald-600/60 text-emerald-300' : 'bg-[#11141b] border-[#232936] text-slate-300 hover:border-[#3b465a]'}`}
                >
                  <Icon size={15} className="mb-2" />
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className="block text-[10px] leading-relaxed text-slate-500 mt-1">{item.description}</span>
                </button>
              );
            })}
          </div>

          <section className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-3">
            {mode !== 'explain' && (
              <>
                <label className="text-xs font-semibold text-slate-200 block">
                  {mode === 'generate' ? 'Describe the feature you want to build' : mode === 'fix' ? 'Describe the bug or error' : 'Describe how you want to improve the code'}
                </label>
                <textarea
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  placeholder={
                    mode === 'generate' ? 'Example: Create a JavaScript function that validates a user registration form...'
                    : mode === 'fix' ? 'Example: This function returns undefined when the input array is empty. Find and fix the issue...'
                    : 'Example: Refactor this file into smaller reusable functions without changing its behaviour...'
                  }
                  rows={4}
                  className="w-full bg-[#0a0c10] border border-[#2c3342] rounded-md p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y"
                />
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(suggestion)}
                      className="text-[10px] px-2 py-1 rounded-full bg-[#181d27] hover:bg-emerald-950/40 text-slate-300 border border-[#273040]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="bg-[#0a0c10] border border-[#232936] rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                  <FileCode2 size={13} /> Current file context
                </span>
                <span className="text-[10px] text-slate-500">{currentCode.length.toLocaleString()} characters</span>
              </div>
              <pre className="text-[10px] leading-relaxed text-slate-400 max-h-36 overflow-auto whitespace-pre-wrap break-words">
                {currentCode ? currentCode.slice(0, 12000) : 'No file content received. Open a file in the VS Code editor.'}
                {currentCode.length > 12000 ? '\n… preview truncated; full file is sent to the backend.' : ''}
              </pre>
            </div>

            <button
              onClick={() => runMode()}
              disabled={loading || (mode !== 'explain' && !prompt.trim())}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {loading ? 'Working with AI...' : mode === 'generate' ? 'Generate Code' : mode === 'explain' ? 'Explain Current Code' : mode === 'fix' ? 'Find and Fix Bug' : 'Refactor Code'}
            </button>
          </section>

          {error && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs">
              <strong>Request failed:</strong> {error}
            </div>
          )}

          {explanation && (
            <section className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                <BookOpen size={14} className="text-cyan-400" />
                {mode === 'explain' ? 'Code Explanation' : 'AI Explanation'}
              </h3>
              <MarkdownView content={explanation} />
            </section>
          )}

          {proposedCode && (
            <section className="bg-[#11141b] border border-[#232936] rounded-lg overflow-hidden">
              <div className="px-3.5 py-3 bg-[#161b24] border-b border-[#232936] flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                  <GitCompare size={14} className="text-emerald-400" /> Proposed Code
                </span>
                <span className="text-[10px] text-amber-300 bg-amber-950/30 border border-amber-700/30 rounded-full px-2 py-1">
                  Review before applying
                </span>
              </div>
              <pre className="m-3 p-3 rounded bg-[#080a0f] border border-[#232936] text-[11px] leading-relaxed text-emerald-200 max-h-96 overflow-auto whitespace-pre select-text">
                <code>{proposedCode}</code>
              </pre>
              <div className="p-3 border-t border-[#232936] flex flex-col sm:flex-row gap-2">
                <button onClick={handleOpenDiff} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#1e2430] hover:bg-[#283142] text-slate-200 border border-[#2d3748] rounded-md text-xs font-semibold">
                  <GitCompare size={14} /> Review in VS Code Diff
                </button>
                <button onClick={handleApplyPatch} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-xs font-semibold">
                  <Check size={14} /> Apply Proposal to File
                </button>
              </div>
              {applied && <p className="px-3 pb-3 text-xs text-emerald-400">Apply request sent to VS Code. Check the editor and save the file when ready.</p>}
            </section>
          )}
        </>
      ) : (
        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-slate-100">API Analyzer</h3><p className="text-[11px] text-slate-400 mt-1">Test requests, discover backend routes and inspect API change impact inside your workspace.</p></div>
          <div className="grid grid-cols-3 gap-1 bg-[#0a0c10] border border-[#232936] rounded-lg p-1 text-[11px]">
            {[['tester','API Tester'],['scanner','Endpoint Scanner'],['impact','Impact Analysis']].map(([id,label]) => <button key={id} onClick={() => setApiTab(id)} className={`py-2 rounded-md font-semibold ${apiTab === id ? 'bg-[#1b222f] text-emerald-400 border border-[#2e3a4e]' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>)}
          </div>
          {apiTab === 'tester' && <div className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-100">HTTP Request</h4>
            <div className="flex gap-2"><select value={httpMethod} onChange={e => setHttpMethod(e.target.value)} className="bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-2 text-xs text-emerald-300">{['GET','POST','PUT','PATCH','DELETE'].map(method => <option key={method}>{method}</option>)}</select><input value={requestUrl} onChange={e => setRequestUrl(e.target.value)} placeholder="http://localhost:3000/api/users" className="flex-1 min-w-0 bg-[#0a0c10] border border-[#2c3342] rounded-md px-3 py-2 text-xs text-slate-200" /><button onClick={sendApiRequest} disabled={apiTestLoading || !requestUrl.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md text-xs font-semibold text-white">{apiTestLoading ? 'Sending…' : 'Send'}</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="text-[11px] text-slate-300">Headers (JSON)<textarea value={requestHeaders} onChange={e => setRequestHeaders(e.target.value)} rows={4} className="mt-1 w-full bg-[#0a0c10] border border-[#2c3342] rounded-md p-2 font-mono text-[10px] text-slate-300" /></label><label className="text-[11px] text-slate-300">Query parameters (JSON)<textarea value={requestParams} onChange={e => setRequestParams(e.target.value)} rows={4} className="mt-1 w-full bg-[#0a0c10] border border-[#2c3342] rounded-md p-2 font-mono text-[10px] text-slate-300" /></label></div>
            {!['GET','DELETE'].includes(httpMethod) && <label className="block text-[11px] text-slate-300">Request body (JSON or text)<textarea value={requestBody} onChange={e => setRequestBody(e.target.value)} rows={6} className="mt-1 w-full bg-[#0a0c10] border border-[#2c3342] rounded-md p-2 font-mono text-[10px] text-slate-300" /></label>}
            {apiResponse && <div className="border border-[#2c3342] rounded-lg overflow-hidden"><div className="flex flex-wrap gap-3 items-center px-3 py-2 bg-[#161b24] text-[11px]">{apiResponse.error ? <span className="text-rose-300">Request error: {apiResponse.error}</span> : <><strong className={apiResponse.success ? 'text-emerald-400' : 'text-rose-300'}>{apiResponse.status} {apiResponse.statusText}</strong><span className="text-slate-400">{apiResponse.responseTime} ms</span><span className="text-slate-400">{apiResponse.contentType}</span></>}</div>{!apiResponse.error && <><pre className="p-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-300">{JSON.stringify(apiResponse.body, null, 2)}</pre><details className="px-3 pb-3 text-[10px] text-slate-400"><summary className="cursor-pointer">Response headers</summary><pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(apiResponse.headers, null, 2)}</pre></details></>}</div>}
            <p className="text-[10px] text-slate-500">Requests run through your CodeAtlas backend. Timeout: 20 seconds. Only HTTP/HTTPS URLs are accepted.</p>
          </div>}
          {apiTab === 'scanner' && <div className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-3"><div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="text-xs font-semibold text-slate-100">Workspace Endpoint Scanner & Status</h4><p className="text-[10px] text-slate-400 mt-1">Scan source routes, then test each endpoint against its running server.</p></div><button onClick={scanWorkspace} disabled={scanLoading} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md text-xs text-white font-semibold">{scanLoading ? 'Scanning workspace…' : 'Scan Workspace'}</button></div>
            {scanResult && !scanResult.error && <><label className="block text-[10px] text-slate-400">API server base URL<input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} className="mt-1 w-full bg-[#0a0c10] border border-[#2c3342] rounded-md px-2 py-1.5 text-xs text-slate-200" placeholder="http://localhost:5000" /></label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['Endpoints',scanResult.total],['Active',scanResult.active],['Possibly unused',scanResult.possiblyUnused],['Deprecated',scanResult.deprecated]].map(([label,value]) => <div key={label} className="bg-[#0a0c10] border border-[#232936] rounded-md p-2"><div className="text-[10px] text-slate-500">{label}</div><div className="text-lg font-semibold text-slate-100">{value}</div></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-[10px]"><thead className="text-slate-400 border-b border-[#2c3342]"><tr><th className="py-2">Method</th><th>Endpoint</th><th>Status</th><th>Definition / callers</th><th>Live test</th></tr></thead><tbody>{scanResult.endpoints.map((item,index) => <tr key={`${item.method}-${item.path}-${index}`} className="border-b border-[#232936]"><td className="py-2 pr-2 font-semibold text-cyan-300">{item.method}</td><td className="pr-2 font-mono text-slate-200">{item.path}</td><td className="pr-2"><span className={item.status === 'Active' ? 'text-emerald-400' : item.status === 'Deprecated' ? 'text-amber-300' : 'text-rose-300'}>{item.status}</span></td><td className="text-slate-400 pr-2">{[...(item.files || []), ...(item.references || [])].join(', ') || 'No reference found'}</td><td className="py-2"><button onClick={() => testScannedEndpoint(item)} disabled={endpointChecks[`${item.method} ${item.path}`]?.loading} className="px-2 py-1 rounded border border-[#2c3342] text-[10px] text-cyan-300">{endpointChecks[`${item.method} ${item.path}`]?.loading ? 'Testing…' : 'Test'}</button><div className="mt-1 text-[9px]">{endpointChecks[`${item.method} ${item.path}`]?.error ? <span className="text-rose-300">Error</span> : endpointChecks[`${item.method} ${item.path}`]?.status ? <span className={endpointChecks[`${item.method} ${item.path}`].success ? 'text-emerald-400' : 'text-rose-300'}>{endpointChecks[`${item.method} ${item.path}`].status} · {endpointChecks[`${item.method} ${item.path}`].responseTime} ms</span> : <span className="text-slate-500">Not tested</span>}</div></td></tr>)}</tbody></table></div><p className="text-[10px] text-amber-300">{scanResult.note}</p></>}
            {scanResult?.error && <p className="text-xs text-rose-300">{scanResult.error}</p>}{!scanResult && <p className="text-[11px] text-slate-500">Click Scan Workspace to inspect the currently opened VS Code project. No files are modified.</p>}
          </div>}
          {apiTab === 'impact' && <div className="bg-[#11141b] border border-[#232936] rounded-lg p-4 space-y-3"><div><h4 className="text-xs font-semibold text-slate-100">API Change Impact Analysis</h4><p className="text-[10px] text-slate-400 mt-1">Compare old/new OpenAPI specs. Scan the workspace first to include discovered endpoint definitions and callers as evidence.</p></div><div className="flex justify-end"><button onClick={scanWorkspace} disabled={scanLoading} className="px-3 py-1.5 border border-[#2c3342] rounded-md text-[10px] text-emerald-300">{scanLoading ? 'Scanning…' : `Refresh workspace evidence (${endpointEvidence.length})`}</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="text-[11px] text-slate-300 space-y-1">Old OpenAPI specification<textarea rows={8} value={oldSpec} onChange={event => setOldSpec(event.target.value)} className="w-full bg-[#0a0c10] font-mono text-[10px] border border-[#2c3342] rounded-md p-2.5 text-slate-300" /></label><label className="text-[11px] text-slate-300 space-y-1">New OpenAPI specification<textarea rows={8} value={newSpec} onChange={event => setNewSpec(event.target.value)} className="w-full bg-[#0a0c10] font-mono text-[10px] border border-[#2c3342] rounded-md p-2.5 text-slate-300" /></label></div><button onClick={handleImpact} disabled={impactLoading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2">{impactLoading ? 'Analyzing API changes…' : 'Analyze API Impact'}</button>{impactResult && <div className="bg-[#0a0c10] p-3.5 rounded-lg border border-[#232936] text-xs max-h-96 overflow-y-auto"><MarkdownView content={impactResult} /></div>}</div>}
        </section>

      )}
    </div>
  );
}
