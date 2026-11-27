import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { GitBranch, Layers, Copy, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function AstVisualizer({ astData }) {
  const containerRef = useRef(null);
  const [renderError, setRenderError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewTab, setViewTab] = useState('diagram'); // 'diagram' | 'nodes' | 'flat'

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  useEffect(() => {
    if (!astData?.mermaidDiagram || !containerRef.current) return;
    setRenderError(null);

    const renderId = `mermaid-ast-${Date.now()}`;
    mermaid.render(renderId, astData.mermaidDiagram)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        console.warn('Mermaid syntax rendering error:', err);
        setRenderError(err.message || 'Diagram render fallback');
      });
  }, [astData?.mermaidDiagram, viewTab]);

  const copyDiagramSource = () => {
    if (astData?.mermaidDiagram) {
      navigator.clipboard.writeText(astData.mermaidDiagram);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!astData) return null;

  return (
    <div className="bg-[#11141b] border border-cyan-500/30 rounded-lg p-3.5 space-y-3 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232936] pb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-300">
            {astData.language === 'Python' ? 'Python AST Flow & Syntax Tree' : 'AST Flow & Syntax Tree'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Topology Badge */}
          {astData.hasHierarchy ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 flex items-center gap-1 font-mono">
              <GitBranch size={10} /> Hierarchical Syntax Tree
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 font-mono">
              <Layers size={10} /> Flat (Independent Units)
            </span>
          )}

          {/* View Tab Switcher */}
          {astData.hasHierarchy && (
            <div className="flex items-center bg-[#161d27] rounded border border-[#232936] p-0.5 text-[10px]">
              <button
                onClick={() => setViewTab('diagram')}
                className={`px-2 py-0.5 rounded transition ${viewTab === 'diagram' ? 'bg-cyan-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Tree Diagram
              </button>
              <button
                onClick={() => setViewTab('nodes')}
                className={`px-2 py-0.5 rounded transition ${viewTab === 'nodes' ? 'bg-cyan-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Node Details
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Case 1: Tree Diagram (Exact Match to User AST Visualization) */}
      {astData.hasHierarchy && viewTab === 'diagram' && astData.mermaidDiagram && (
        <div className="space-y-2">
          {/* Legend and Controls Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 px-1">
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#cce5ff] border border-[#66b2ff]"></span>
                <span className="text-slate-300">Control / Statement</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#dbeafe] border border-[#93c5fd]"></span>
                <span className="text-slate-300">Operator</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#d4edda] border border-[#8fd19e]"></span>
                <span className="text-slate-300">Variable</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#fff3cd] border border-[#ffeeba]"></span>
                <span className="text-slate-300">Constant</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2634] transition"
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2634] transition"
                title="Reset Zoom"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2634] transition"
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </button>
              <button
                onClick={copyDiagramSource}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1f2634] transition flex items-center gap-1 text-[10px] ml-1"
                title="Copy Mermaid syntax"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Mermaid'}</span>
              </button>
            </div>
          </div>

          {/* Diagram Canvas with Zoom / Pan */}
          <div className="bg-[#ffffff] rounded-lg p-4 overflow-auto border border-[#232936] max-h-96 flex justify-center items-start">
            <div
              ref={containerRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
              className="w-full flex justify-center select-none"
            />
          </div>
        </div>
      )}

      {/* Case 2: Node Details / Function Cards */}
      {astData.hasHierarchy && viewTab === 'nodes' && (
        <div className="space-y-2">
          {astData.functions && astData.functions.map((fn, idx) => (
            <div key={idx} className="bg-[#0a0c10] rounded-lg border border-[#232936] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-semibold">{fn.name}({fn.args?.join(', ') || ''})</span>
                <span className="text-slate-500 text-[11px]">Lines {fn.line}–{fn.endLine}</span>
              </div>
              <div className="border-l-2 border-emerald-500/30 ml-2 pl-3 space-y-1 text-xs">
                {fn.internalCalls && fn.internalCalls.length > 0 && (
                  <div className="text-[11px] text-emerald-300">
                    <span>↳ Calls internal: {fn.internalCalls.join(', ')}</span>
                  </div>
                )}
                {fn.externalCalls && fn.externalCalls.length > 0 && (
                  <div className="text-[11px] text-cyan-400">
                    <span>↳ APIs / Calls: {fn.externalCalls.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case 3: Flat Structure Fallback (When no hierarchy exists) */}
      {!astData.hasHierarchy && (
        <div className="space-y-2.5">
          <div className="p-2.5 rounded bg-[#0e131d] border border-[#232936] text-[11px] text-slate-300 flex items-center gap-2">
            <Layers size={13} className="text-cyan-400 shrink-0" />
            <span>Independent components detected. This file contains modular declarations with no direct nested control flow.</span>
          </div>

          {/* Declarations Grid */}
          {astData.classes && astData.classes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {astData.classes.map((cls, idx) => (
                <div key={idx} className="bg-[#0a0c10] p-2.5 rounded border border-[#232936] flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-300 font-semibold">{cls.name}</span>
                  <span className="text-slate-500 text-[11px]">Line {cls.line}</span>
                </div>
              ))}
            </div>
          )}

          {astData.functions && astData.functions.length > 0 && (
            <div className="space-y-1.5">
              {astData.functions.map((fn, idx) => (
                <div key={idx} className="bg-[#0a0c10] p-2.5 rounded border border-[#232936] flex justify-between items-center text-xs font-mono">
                  <span className="text-emerald-400 font-semibold">{fn.name}({fn.args?.join(', ') || ''})</span>
                  <span className="text-slate-500 text-[11px]">Lines {fn.line}–{fn.endLine}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
