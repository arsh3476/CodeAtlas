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
        calls: Array.from(calls).slice(0, 8)
      });
    }
  });

  return { imports, classes, functions };
}

const sampleTS = `export interface Row { [key: string]: any; }
export interface User { username: string; }
export interface ExceptionCase { id: number; }
export function processCase(caseId: number, autoResolve: boolean) {
  validateCase(caseId);
  sendNotification(caseId);
}`;

console.log('PARSED TS RESULT:', JSON.stringify(parseUniversalAST(sampleTS), null, 2));
