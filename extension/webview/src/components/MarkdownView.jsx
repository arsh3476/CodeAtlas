import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked for GitHub Flavored Markdown (tables, task lists, code blocks)
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownView({ content }) {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content);
    } catch (e) {
      console.error('Markdown parse error:', e);
      return content;
    }
  }, [content]);

  return (
    <div 
      className="markdown-body text-xs text-slate-300 leading-relaxed space-y-2 select-text"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
