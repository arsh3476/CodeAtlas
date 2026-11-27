# CodeAtlas — AI Developer Workspace

CodeAtlas is a VS Code extension with a React webview, a Node.js/Express backend, MongoDB-backed team features, and Gemini-powered AI features.

## AI Coder features

- Generate code from a natural-language requirement.
- Explain the current file in beginner-friendly language.
- Fix bugs from a user-described problem.
- Refactor existing code.
- Review proposed code in VS Code's side-by-side diff before applying it.
- Compare old and new OpenAPI specifications for potential API impact.

AI-generated code is a proposal. Review and test it before using it. CodeAtlas does not claim that generated code has been executed or verified.

## Setup (Windows / VS Code)

### 1. Install prerequisites

Install Node.js 18.17+ (Node 20 LTS recommended), VS Code, and MongoDB Community Server if you want persistent database features. The AI Coder itself does not require MongoDB.

### 2. Configure Gemini

1. Open Google AI Studio: https://aistudio.google.com/apikey
2. Create a Gemini API key. Check the current free-tier availability and limits in AI Studio.
3. Open `backend/.env` in VS Code.
4. Replace `paste_your_new_gemini_api_key_here` with your new key.
5. Keep the key private. Do not put it in React files, commit it, or share the `.env` file.

The default model is `gemini-3.8-flash`. If that model is not enabled for your account, set `GEMINI_MODEL` to a model currently available in your Google AI Studio project.

### 3. Install backend dependencies

Open a terminal in the project root and run:

```powershell
cd backend
npm install
```

### 4. Start the backend

In the same terminal:

```powershell
npm start
```

Expected address: `http://localhost:5000`.

Open this address in a browser to confirm the API responds. Then open `http://localhost:5000/api/health`; it should return `status: "ok"` and `llmConfigured: true` after the Gemini key is configured.

### 5. Install webview dependencies

Open a **second** terminal at the project root:

```powershell
cd extension/webview
npm install
npm run build
```

### 6. Run CodeAtlas in VS Code

1. In VS Code, choose **File → Open Folder**.
2. Select the `CodeAtlas-AI-Coder` project folder.
3. Open **Run and Debug** from the left sidebar.
4. Select **Run CodeAtlas Extension**.
5. Press **F5**. If your Lenovo uses an Fn key for function keys, press **Fn + F5**.
6. A new **Extension Development Host** window opens. Select the CodeAtlas icon in its Activity Bar.

### 7. Test AI Coder

1. Open a source file in the Extension Development Host window.
2. Open the CodeAtlas panel and choose **AI Coder**.
3. Choose **Generate**, **Explain**, **Fix bugs**, or **Refactor**.
4. Enter a requirement for Generate/Fix/Refactor. Explain uses the open file.
5. Click the action button and wait for the response.
6. For generated code, click **Review in VS Code Diff** first.
7. Only after reviewing, click **Apply Proposal to File**. Save the file yourself.

## Troubleshooting

- `llmConfigured: false`: check `backend/.env` and restart the backend.
- `API key not valid`: create a new key in Google AI Studio and update `GEMINI_API_KEY`.
- `model not found`: choose a model enabled for your AI Studio project and update `GEMINI_MODEL`.
- `429` or quota error: check your current Gemini API usage and limits in AI Studio. Free-tier limits can change.
- Backend offline: make sure the backend terminal is still running on port 5000.
- Blank or stale webview: run `npm run build` again inside `extension/webview`, then restart the Extension Development Host.

## Project structure

- `backend/`: Express API, AI integration, routes, models.
- `extension/`: VS Code extension host.
- `extension/webview/`: React + Vite interface.

## API Analyzer (AI Coder)

The API Analyzer is available from **AI Coder → API Analyzer** and contains three tools:

1. **API Tester** — send GET, POST, PUT, PATCH and DELETE requests to local or external HTTP/HTTPS APIs. Add JSON headers, query parameters and a JSON/text body. The response panel shows HTTP status, response time, content type, response body and response headers. Requests time out after 20 seconds.
2. **Endpoint Scanner & Status** — click **Scan Workspace** to inspect up to 250 supported source files in the open VS Code workspace. It recognizes common Express `app/router/server` route declarations and common static `fetch`/Axios calls. Endpoints are marked Active, Possibly unused, or Deprecated. Use the server base URL and **Test** action beside an endpoint to check its live HTTP status and response time.
3. **Impact Analysis** — compare old and new OpenAPI specifications. Use **Refresh workspace evidence** first so Gemini receives the scanned route definitions and detected frontend references as evidence when preparing its report.

The scanner is intentionally conservative: **Possibly unused is only a static-analysis warning, not proof**. Dynamic route construction, router mount prefixes, aliases, indirect calls, runtime traffic and external consumers may not be discovered. Deprecated markers and route naming are heuristics. The tool never deletes or edits endpoints automatically. Test endpoints against a development server; API calls can have real side effects (especially POST/PUT/PATCH/DELETE).

### API Analyzer quick test

1. Start the CodeAtlas backend (`cd backend`, `npm start`).
2. Open the project in the Extension Development Host and choose **AI Coder → API Analyzer → API Tester**.
3. Send `GET http://localhost:5000/api/health`. You should receive `200 OK` with CodeAtlas health JSON.
4. Open **Endpoint Scanner**, click **Scan Workspace**, enter the API server base URL (for example `http://localhost:5000`), then click **Test** beside an endpoint to populate its live status.
5. Open **Impact Analysis**, paste old/new API specifications, refresh workspace evidence, and run the Gemini analysis.

### Important setup note

The delivered project intentionally does not include `.env` files because they can contain private API keys. Copy `backend/.env.example` to `backend/.env`, add your own `GEMINI_API_KEY`, and keep that file private. After installing webview dependencies, `F5` now runs the **Build CodeAtlas Webview** task automatically before launching the extension. You can also build manually with `cd extension/webview` followed by `npm install` and `npm run build`.
