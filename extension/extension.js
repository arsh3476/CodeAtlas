const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Global state for resilient editor tracking
 */
let lastActiveEditor = null;
let lastSelectedText = '';
let lastFileName = '';
let lastFullFileContent = '';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('[CodeAtlas] Extension activating...');

  const diffStore = new Map();

  // Register virtual document provider for native side-by-side diffing
  const diffProvider = new (class {
    provideTextDocumentContent(uri) {
      return diffStore.get(uri.toString()) || '';
    }
  })();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('codeatlas-preview', diffProvider)
  );

  // Helper to sync editor state safely without truncating code
  function syncEditorState(editor) {
    if (!editor || !editor.document) return null;
    lastActiveEditor = editor;
    lastFileName = editor.document.fileName;
    lastFullFileContent = editor.document.getText();
    const sel = editor.document.getText(editor.selection);
    
    // If text is actively highlighted, use the selection. Otherwise send full file content (all lines)
    const codeToSend = (sel && sel.trim().length > 0) ? sel : lastFullFileContent;
    if (sel && sel.trim().length > 0) {
      lastSelectedText = sel;
    } else {
      lastSelectedText = '';
    }
    
    return {
      file: lastFileName,
      code: codeToSend,
      fullCode: lastFullFileContent,
      hasSelection: Boolean(sel && sel.trim().length > 0),
      totalLines: editor.document.lineCount
    };
  }

  // Track active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document) {
        const payload = syncEditorState(editor);
        if (payload) {
          sidebarProvider.broadcast({ type: 'SELECTION_CHANGED', payload });
          tabPanels.forEach(p => p.send({ type: 'SELECTION_CHANGED', payload }));
        }
      }
    })
  );

  // Track selection changes in real-time
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (!e.textEditor || !e.textEditor.document) return;
      lastActiveEditor = e.textEditor;
      lastFileName = e.textEditor.document.fileName;
      lastFullFileContent = e.textEditor.document.getText();
      const sel = e.textEditor.document.getText(e.selections[0]);
      
      // If user highlighted text, use it; otherwise send the full file content without cutting off
      const codeToSend = (sel && sel.trim().length > 0) ? sel : lastFullFileContent;
      if (sel && sel.trim().length > 0) {
        lastSelectedText = sel;
      } else {
        lastSelectedText = '';
      }

      const payload = {
        file: lastFileName,
        code: codeToSend,
        fullCode: lastFullFileContent,
        hasSelection: Boolean(sel && sel.trim().length > 0),
        totalLines: e.textEditor.document.lineCount
      };
      sidebarProvider.broadcast({ type: 'SELECTION_CHANGED', payload });
      tabPanels.forEach(p => p.send({ type: 'SELECTION_CHANGED', payload }));
    })
  );

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'codeatlas.openSidebar';
  statusBarItem.text = '$(sparkle) CodeAtlas';
  statusBarItem.tooltip = 'Click to open CodeAtlas AI Workspace';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Sidebar Webview Provider
  const sidebarProvider = new CodeAtlasWebviewProvider(context.extensionUri, diffStore);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codeatlas.sidebarView', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Store for active tab panels
  const tabPanels = new Set();

  // Command: Open Full Workspace Tab
  function openWorkspaceTab() {
    const panel = vscode.window.createWebviewPanel(
      'codeatlasWorkspaceTab',
      'CodeAtlas Workspace',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    const tabProvider = new CodeAtlasTabController(panel, context.extensionUri, diffStore);
    tabPanels.add(tabProvider);

    panel.onDidDispose(() => {
      tabPanels.delete(tabProvider);
    });

    // Send initial state immediately
    const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
    const payload = syncEditorState(editor);
    if (payload) {
      setTimeout(() => tabProvider.send({ type: 'SELECTION_CHANGED', payload }), 200);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.openTab', openWorkspaceTab)
  );

  // Command: Open Sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.openSidebar', () => {
      vscode.commands.executeCommand('codeatlas.sidebarView.focus');
    })
  );

  // Command: Explain Selection
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.explainSelection', () => {
      const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      const state = syncEditorState(editor);
      const codeToExplain = (state && state.code) || lastSelectedText || lastFullFileContent;

      sidebarProvider.broadcast({
        type: 'TRIGGER_EXPLAIN',
        payload: {
          code: codeToExplain || '// No file currently open in editor',
          file: (state && state.file) || lastFileName || 'active_file.py'
        }
      });
      tabPanels.forEach(p => p.send({
        type: 'TRIGGER_EXPLAIN',
        payload: {
          code: codeToExplain || '// No file currently open in editor',
          file: (state && state.file) || lastFileName || 'active_file.py'
        }
      }));

      vscode.commands.executeCommand('codeatlas.sidebarView.focus');
    })
  );

  // Command: Generate / Refactor Code
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.generateCode', () => {
      const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      syncEditorState(editor);
      sidebarProvider.broadcast({ type: 'SWITCH_TAB', payload: { tab: 'coder' } });
      tabPanels.forEach(p => p.send({ type: 'SWITCH_TAB', payload: { tab: 'coder' } }));
      vscode.commands.executeCommand('codeatlas.sidebarView.focus');
    })
  );

  // Command: Create Shift Handover
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.createHandover', () => {
      sidebarProvider.broadcast({ type: 'SWITCH_TAB', payload: { tab: 'handoff' } });
      tabPanels.forEach(p => p.send({ type: 'SWITCH_TAB', payload: { tab: 'handoff' } }));
      vscode.commands.executeCommand('codeatlas.sidebarView.focus');
    })
  );
}

/**
 * Shared message handler for both Sidebar and Tab Webviews
 */
async function handleWebviewMessage(message, webview, diffStore) {
  switch (message.type) {
    case 'WEBVIEW_READY':
    case 'REQUEST_EDITOR_SYNC': {
      const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      if (editor && editor.document) {
        lastActiveEditor = editor;
        lastFileName = editor.document.fileName;
        lastFullFileContent = editor.document.getText();
        const sel = editor.document.getText(editor.selection);
        const codeToSend = (sel && sel.trim().length > 0) ? sel : lastFullFileContent;
        if (sel && sel.trim().length > 0) {
          lastSelectedText = sel;
        } else {
          lastSelectedText = '';
        }
        webview.postMessage({
          type: 'SELECTION_CHANGED',
          payload: {
            code: codeToSend,
            fullCode: lastFullFileContent,
            file: lastFileName,
            hasSelection: Boolean(sel && sel.trim().length > 0),
            totalLines: editor.document.lineCount
          }
        });
      }
      break;
    }

    case 'OPEN_FULL_TAB': {
      vscode.commands.executeCommand('codeatlas.openTab');
      break;
    }

    case 'SHOW_DIFF': {
      const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      if (!editor || !editor.document) {
        vscode.window.showErrorMessage('CodeAtlas: Open a target file to compare diff');
        return;
      }

      const originalUri = editor.document.uri;
      const previewUri = vscode.Uri.parse(`codeatlas-preview://${path.basename(originalUri.fsPath)}`);
      diffStore.set(previewUri.toString(), message.payload.proposedCode);

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        previewUri,
        `${path.basename(originalUri.fsPath)} (Current ↔ Proposed Patch)`
      );
      break;
    }

    case 'APPLY_PATCH': {
      const editor = lastActiveEditor || vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      if (!editor || !editor.document) {
        vscode.window.showErrorMessage('CodeAtlas: Open the target file to apply patch');
        return;
      }

      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, message.payload.code);
      });

      vscode.window.showInformationMessage('CodeAtlas: Patch applied successfully to active file!');
      break;
    }

    case 'SEARCH_WORKSPACE_FILES': {
      try {
        const uris = await vscode.workspace.findFiles(
          '**/*.{py,js,ts,jsx,tsx,json,sql,md,html,css,ipynb}',
          '**/{node_modules,.git,dist,build,.vscode,venv,.env}/**',
          60
        );

        const fileCandidates = await Promise.all(
          uris.slice(0, 30).map(async (uri) => {
            try {
              const doc = await vscode.workspace.openTextDocument(uri);
              const relativePath = vscode.workspace.asRelativePath(uri);
              const preview = doc.getText(new vscode.Range(0, 0, Math.min(40, doc.lineCount), 0));
              return { path: relativePath, preview, totalLines: doc.lineCount };
            } catch {
              return null;
            }
          })
        );

        webview.postMessage({
          type: 'WORKSPACE_FILES_READY',
          payload: {
            files: fileCandidates.filter(Boolean),
            query: message.payload.query
          }
        });
      } catch (err) {
        console.error('Error finding workspace files:', err);
      }
      break;
    }

    case 'SCAN_WORKSPACE_API_FILES': {
      try {
        const uris = await vscode.workspace.findFiles(
          '**/*.{js,cjs,mjs,ts,jsx,tsx,vue,html,py,java,go,php,rb}',
          '**/{node_modules,.git,dist,build,.vscode,coverage,venv,.next}/**',
          100
        );
        const files = await Promise.all(uris.map(async (uri) => {
          try {
            const doc = await vscode.workspace.openTextDocument(uri);
            return { path: vscode.workspace.asRelativePath(uri), content: doc.getText().slice(0, 20000) };
          } catch { return null; }
        }));
        webview.postMessage({ type: 'WORKSPACE_API_FILES_READY', payload: { files: files.filter(Boolean) } });
      } catch (err) {
        webview.postMessage({ type: 'WORKSPACE_API_FILES_ERROR', payload: { error: err.message } });
      }
      break;
    }

    case 'LOAD_FILE_CONTENT': {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        let targetUri;
        if (path.isAbsolute(message.payload.path)) {
          targetUri = vscode.Uri.file(message.payload.path);
        } else if (root) {
          targetUri = vscode.Uri.joinPath(root, message.payload.path);
        } else {
          targetUri = vscode.Uri.file(message.payload.path);
        }
        const doc = await vscode.workspace.openTextDocument(targetUri);
        const content = doc.getText();
        webview.postMessage({
          type: 'FILE_CONTENT_LOADED',
          payload: {
            path: message.payload.path,
            content,
            action: message.payload.action // 'inspect' | 'summarize'
          }
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to read file: ${err.message}`);
      }
      break;
    }

    case 'OPEN_FILE_IN_EDITOR': {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        let targetUri;
        if (path.isAbsolute(message.payload.path)) {
          targetUri = vscode.Uri.file(message.payload.path);
        } else if (root) {
          targetUri = vscode.Uri.joinPath(root, message.payload.path);
        } else {
          targetUri = vscode.Uri.file(message.payload.path);
        }
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
      }
      break;
    }
  }
}

function getWebviewContent(webview, extensionUri) {
  const webviewDist = path.join(extensionUri.fsPath, 'webview', 'dist');
  const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDist, 'assets', 'index.js')));
  const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDist, 'assets', 'index.css')));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>CodeAtlas</title>
</head>
<body class="bg-[#0a0c10] text-[#c9d1d9] antialiased">
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

class CodeAtlasWebviewProvider {
  constructor(extensionUri, diffStore) {
    this._extensionUri = extensionUri;
    this._diffStore = diffStore;
    this._view = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri);
    webviewView.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg, webviewView.webview, this._diffStore));
  }

  broadcast(data) {
    if (this._view && this._view.webview) {
      this._view.webview.postMessage(data);
    }
  }
}

class CodeAtlasTabController {
  constructor(panel, extensionUri, diffStore) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._diffStore = diffStore;
    panel.webview.html = getWebviewContent(panel.webview, extensionUri);
    panel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg, panel.webview, diffStore));
  }

  send(data) {
    if (this._panel && this._panel.webview) {
      this._panel.webview.postMessage(data);
    }
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
