# CodeAtlas — AI Developer Workspace

CodeAtlas is an AI-powered developer workspace built as a **VS Code extension** paired with a **React webview**, a **Node.js/Express backend**, **MongoDB** for team collaboration, and **Google Gemini AI** for code generation, explanation, refactoring, and AST visual analysis.

---

## 🌟 Key Features

### 1. 🤖 AI Coder & Assistant
- **Code Generation:** Create new functions, modules, or boilerplate from natural language prompts.
- **Code Explanation:** Break down complex files or highlighted code snippets into beginner-friendly explanations.
- **Bug Fixing:** Automatically diagnose problems described in plain text and propose actionable code fixes.
- **Code Refactoring:** Improve maintainability, performance, and readability of your existing codebase.
- **Side-by-Side Diff Review:** Inspect AI-proposed changes using VS Code’s native side-by-side diff editor before applying them to your files.

### 2. 🔍 API Analyzer & Tester
Accessible under **AI Coder → API Analyzer**:
- **API Tester:** Send `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests directly inside VS Code. Configure JSON headers, query parameters, and request payloads with live response time, status codes, and body visualization.
- **Endpoint Scanner:** Statically scan workspace source files (up to 250 files) to discover Express route definitions (`app/router`) and frontend API calls (`fetch`, `axios`). Endpoints are categorized as **Active**, **Possibly unused**, or **Deprecated** with 1-click live testing.
- **Impact Analysis:** Compare old and new OpenAPI specifications with AI. Feed scanned workspace evidence into Gemini to assess breaking changes and frontend impact before deploying API updates.

### 3. 🧠 Learn & AST Visualizer
- **Visual AST Flow:** Parse and visualize Abstract Syntax Trees (AST) for JavaScript and Python files to understand how code is structured.
- **Interactive Code Breakdown:** Explore functions, declarations, and imports interactively.

### 4. 🤝 Team Handover & Collaboration
- **Shift Handovers:** Document work progress, blockers, completed tasks, and next steps for team handoffs.
- **Persistent Logs:** Track development sessions and work logs backed by MongoDB.
- **Editor Context Menus:** Quick access via right-click on code selections (*Explain Selected Code*, *Generate / Refactor Code*, *Create Shift Handover*).

---

## 🛠️ Prerequisites

Before getting started, make sure you have:
- **Node.js**: `v18.17+` (Node 20 LTS recommended) & `npm`
- **Visual Studio Code**: `v1.80.0` or higher
- **Google Gemini API Key**: Free key from [Google AI Studio](https://aistudio.google.com/apikey)
- **MongoDB Community Server** *(Optional)*: Required for shift handovers and task persistence. AI Coder and API Analyzer work without MongoDB.

---

## 🚀 Setup & Installation

### Step 1: Clone Repository & Configure Environment

Clone the repository and prepare the backend configuration:

```powershell
git clone https://github.com/arsh3476/CodeAtlas.git
cd CodeAtlas
```

Copy the environment template:
```powershell
copy backend\.env.example backend\.env
```

Open `backend/.env` in your editor and configure your Gemini API key:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/codeatlas
JWT_SECRET=your_jwt_secret_here

# Create a key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
> [!IMPORTANT]
> Keep `backend/.env` secret. Never commit `.env` files to git.

---

### Step 2: Install Backend Dependencies & Start Server

From the root project directory:

```powershell
cd backend
npm install
npm start
```

The backend starts at `http://localhost:5000`.
- Verify the server is running by opening: `http://localhost:5000/api/health`
- Expected response: `{"status":"ok", "llmConfigured": true}`

---

### Step 3: Install & Build Webview

Open a **new terminal** in the root directory:

```powershell
cd extension/webview
npm install
npm run build
```

*(Note: Whenever you make changes to UI components in `extension/webview/src`, run `npm run build` to update the extension's bundle).*

---

### Step 4: Run the Extension in VS Code

1. Open the **`CodeAtlas`** root folder in VS Code (`File → Open Folder...`).
2. Switch to the **Run and Debug** view (`Ctrl + Shift + D` or `Cmd + Shift + D`).
3. Select **Run CodeAtlas Extension** from the dropdown at the top.
4. Press **F5** (or **Fn + F5** on laptops).
5. A new window titled **[Extension Development Host]** will launch.
6. Look for the **CodeAtlas** logo in the Activity Bar (left sidebar) or use `Ctrl + Shift + P` and search:
   - `CodeAtlas: Open Workspace in Sidebar`
   - `CodeAtlas: Open Full Workspace Tab`

---

## 📖 Quick Usage Guide

### Using AI Coder & Diff Review
1. Open any source code file in the Extension Development Host window.
2. In the CodeAtlas panel, select the **AI Coder** tab.
3. Choose an action: **Generate**, **Explain**, **Fix bugs**, or **Refactor**.
4. Enter your prompt (e.g., *"Add error handling to this async function"*).
5. Click the action button.
6. When the response arrives, click **Review in VS Code Diff** to compare original vs suggested changes side by side.
7. Click **Apply Proposal to File** to overwrite, then save your file (`Ctrl + S`).

### Using the API Analyzer
1. In the sidebar, navigate to **AI Coder → API Analyzer**.
2. **Test Endpoints:** In **API Tester**, enter `http://localhost:5000/api/health` and click **Send**. Inspect the status, latency, and response JSON.
3. **Scan Workspace:** Switch to **Endpoint Scanner** and click **Scan Workspace**. View discovered Express routes and frontend API calls.
4. **Compare OpenAPI Specs:** Switch to **Impact Analysis**, paste old and new OpenAPI JSON/YAML specs, click **Refresh workspace evidence**, and run Gemini analysis.

---

## 📂 Project Architecture

```text
CodeAtlas/
├── backend/
│   ├── models/            # Mongoose schemas (CodeSession, User, Handover, Task)
│   ├── routes/            # Express routes (auth, coder, handoff, learn)
│   ├── scripts/           # Python AST analysis scripts (ast_analyzer.py)
│   ├── llm.js             # Google Gemini API connector
│   └── server.js          # Express server entry point
├── extension/
│   ├── media/             # Icons and visual assets
│   ├── webview/           # React + Tailwind + Vite webview UI
│   │   ├── src/           # Components (AstVisualizer, CoderView, HandoffView, etc.)
│   │   └── dist/          # Compiled production assets
│   ├── extension.js       # VS Code extension host & command registrations
│   └── package.json       # Extension manifest and contributions
├── package.json           # Workspace root scripts
└── README.md
```

---

## 🔧 Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `llmConfigured: false` | Missing or invalid key in `backend/.env` | Add a valid key to `GEMINI_API_KEY` in `backend/.env` and restart the backend. |
| `API key not valid` | Expired or incorrect key | Re-generate an API key at [Google AI Studio](https://aistudio.google.com/apikey). |
| `model not found` | Selected Gemini model unavailable | Set `GEMINI_MODEL=gemini-2.5-flash` in `backend/.env`. |
| `Backend offline` | Express server not started | Run `npm start` in the `backend/` folder and verify `http://localhost:5000/api/health`. |
| Blank webview in VS Code | Missing webview production build | Run `cd extension/webview && npm run build`, then reload the VS Code window (`Ctrl + R`). |
| Push rejected: secrets detected | Real API key committed to git | Remove keys from `.env.example`, stage changes (`git add -A`), amend (`git commit --amend --no-edit`), and re-push. |

---

## 📜 License

This project is licensed under the MIT License.
