# AI Coder implementation notes

This update extends the existing CodeAtlas project rather than replacing the application.

## Updated files

- `backend/llm.js`: Gemini API client using the backend-only `GEMINI_API_KEY` environment variable. Exports `callNemotron` as a compatibility alias so Learn/HandoffIQ routes continue to call the same helper.
- `backend/routes/coder.js`: `/generate`, `/explain`, `/fix`, `/refactor`, and `/impact` endpoints with input validation and structured proposed-code responses.
- `backend/server.js`: health endpoint reports whether Gemini is configured.
- `extension/webview/src/components/CoderView.jsx`: Generate, Explain, Fix bugs, Refactor, proposal preview, VS Code diff review, confirmation before applying, and API Impact Analysis.
- `extension/webview/src/App.jsx`: passes full active-file content to AI Coder.
- `extension/extension.js`: prefers the original active editor when opening/applying a proposal, so the diff tab does not accidentally become the patch target.
- `.env` and `backend/.env`: sanitized placeholders only; no API key is included.

## API endpoints

- `POST /api/coder/generate` — `{ "prompt": "...", "currentFileContent": "...", "fileName": "..." }`
- `POST /api/coder/explain` — `{ "code": "...", "fileName": "..." }`
- `POST /api/coder/fix` — same body shape as generate.
- `POST /api/coder/refactor` — same body shape as generate.
- `POST /api/coder/impact` — `{ "oldSpec": "...", "newSpec": "..." }`

The AI Coder returns proposed code for review. The user must explicitly approve applying it in VS Code. Generated code is not automatically tested or guaranteed correct.
