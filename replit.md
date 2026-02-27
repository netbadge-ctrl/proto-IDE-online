# AI Prototyper IDE

## Overview
A modern AI-driven web IDE for UI prototyping and React code generation with version control and direct manipulation. Built with React, TypeScript, and Vite. Uses configurable AI models (default: GLM-4.7 via KSYUN) for code generation. Backend powered by Express + PostgreSQL for persistent data storage.

## Project Architecture
- **Frontend**: React 19 + TypeScript + Vite 6
- **Backend**: Express.js (port 3001, localhost only)
- **Database**: PostgreSQL (Replit built-in)
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Configurable external models via OpenAI-compatible API (default: GLM-4.7 via kspmas.ksyun.com), fallback to Google Gemini
- **Icons**: Lucide React
- **GitHub**: Replit GitHub integration via @octokit/rest

## Three-Layer Memory Architecture
Based on the design doc, the data layer implements:
1. **Short-Term Memory (STM)**: Current session messages stored in `messages` table
2. **Memory Flush**: Session summaries stored in `sessions.current_summary`
3. **Code Versioning**: All generated code stored in `code_versions` table with full file content (JSONB)

## Database Schema
- `projects` - Top-level project entities (UUID PK, name, type)
- `sessions` - Pages/conversations within projects (UUID PK, current_summary for compaction)
- `messages` - Chat messages with token counting (UUID PK, role, content, token_count)
- `code_versions` - Code snapshots with full files as JSONB (UUID PK, files, entry_point, prompt, author)

## Project Structure
```
/
├── index.html              # Entry HTML with Tailwind config
├── index.tsx               # React entry point
├── App.tsx                 # Root component with AppProvider
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite config (port 5000, proxy /api -> :3001)
├── tsconfig.json           # TypeScript configuration
├── server/
│   ├── index.js            # Express backend (port 3001)
│   ├── github.js           # GitHub integration (Replit connector)
│   ├── start.sh            # Startup script (SIGHUP-safe)
│   └── start-vite.js       # Vite launcher with SIGHUP handling
├── services/
│   └── api.ts              # Frontend API client
├── components/
│   ├── ChatInterface.tsx   # AI chat with external model proxy
│   ├── GitHubSyncModal.tsx
│   ├── Layout.tsx
│   ├── PropertyEditor.tsx
│   ├── SettingsModal.tsx
│   ├── Sidebar.tsx
│   ├── TopBar.tsx          # Model selector (GLM-4.7, Gemini)
│   └── Workspace.tsx
└── context/
    └── AppContext.tsx       # App state + DB persistence via dbActions
```

## API Endpoints
- `GET /api/health` - Health check
- `GET/POST /api/projects` - List/create projects
- `PUT/DELETE /api/projects/:id` - Update/delete project
- `GET/POST /api/sessions` - Get session detail / create session
- `PUT/DELETE /api/sessions/:id` - Update/delete session
- `PUT /api/sessions/:id/summary` - Update compaction summary
- `GET /api/sessions/:id/token-stats` - Get token statistics
- `GET/POST /api/messages` - List messages / add message
- `GET/POST /api/versions` - List versions / add version
- `POST /api/ai/chat` - AI proxy (avoids CORS, forwards to external model API)
- `POST /api/github/sync` - Sync code to GitHub

## AI Model Configuration
- Default: GLM-4.7 via `https://kspmas.ksyun.com/v1`
- Frontend calls `/api/ai/chat` backend proxy to avoid CORS
- External model config stored in localStorage, default fallback in AppContext
- Supports any OpenAI-compatible API endpoint
- Model selector in TopBar and SettingsModal

## Startup & SIGHUP Handling
- `server/start.sh` launches backend and Vite
- `server/start-vite.js` runs Vite programmatically with SIGHUP signal handling
- `server/index.js` ignores SIGHUP, uncaughtException, unhandledRejection
- This prevents Replit workflow signals from killing the processes

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
  - 调试用（外网）：`postgresql://admin:Kingsoft0531@120.92.212.212:42359/postgres`
  - 部署用（内网）：`postgresql://admin:Kingsoft0531@172.31.252.66:5432/postgres`
- `GEMINI_API_KEY`: Google Gemini API key (fallback AI)
- `BACKEND_PORT`: Backend port (default 3001)
- `PORT`: Server port in production (default 3001)
- `NODE_ENV`: Set to `production` for production mode
- `DB_SSL`: Set to `true` if your database requires SSL
- `GITHUB_TOKEN`: GitHub personal access token (for non-Replit deployments)

## Development
- Dev server: `bash server/start.sh` (starts backend + Vite)
- Backend only: `npm run dev:server`
- Frontend only: `npm run dev:client`
- Build: `npm run build`

## Production Deployment
1. `npm install`
2. `npm run build` (builds frontend to `dist/`)
3. Set environment variables: `DATABASE_URL`, `PORT`, `NODE_ENV=production`
4. `npm start` (runs Express serving static files + API)
- Server auto-initializes database tables on startup
- Listens on `0.0.0.0` in production mode

## Recent Changes
- 2026-02-27: Production deployment support
  - Server auto-creates database tables on startup
  - Serves static frontend build in production mode
  - Configurable host (0.0.0.0 in production) and port (via PORT env)
  - GitHub integration supports direct GITHUB_TOKEN env var
  - Optional DB_SSL support for cloud databases
- 2026-02-26: Fixed AI model integration with GLM-4.7
  - Added `/api/ai/chat` backend proxy to avoid CORS
  - Added detailed AI request logging
  - Fixed SIGHUP signal handling for both Vite and backend
  - Created `server/start-vite.js` for programmatic Vite launch
  - Configured default external model: GLM-4.7 via KSYUN
- 2026-02-10: Added GitHub sync via Replit integration
- 2026-02-10: Added backend data storage layer with PostgreSQL
- 2026-02-10: Initial Replit setup - configured Vite for port 5000
