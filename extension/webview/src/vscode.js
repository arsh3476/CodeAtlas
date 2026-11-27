// Safe helper to interact with acquireVsCodeApi
let vscodeInstance = null;

export function getVsCodeApi() {
  if (!vscodeInstance) {
    if (typeof acquireVsCodeApi !== 'undefined') {
      vscodeInstance = acquireVsCodeApi();
    } else {
      // Mock for browser testing outside VS Code
      vscodeInstance = {
        postMessage: (msg) => console.log('[VS Code Mock postMessage]:', msg),
        getState: () => ({}),
        setState: (state) => console.log('[VS Code Mock setState]:', state),
      };
    }
  }
  return vscodeInstance;
}
