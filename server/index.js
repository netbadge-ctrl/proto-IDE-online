import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';

let getUncachableGitHubClient;
try {
  const ghModule = await import('./github.js');
  getUncachableGitHubClient = ghModule.getUncachableGitHubClient;
} catch (e) {
  console.warn('GitHub integration not available:', e.message);
}

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL DEFAULT '我的新项目',
        type VARCHAR(50) NOT NULL DEFAULT 'PC',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT '首页',
        current_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        related_version_id UUID,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS code_versions (
        version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
        message_id UUID,
        files JSONB NOT NULL,
        entry_point VARCHAR(255) DEFAULT 'App.tsx',
        version_tag VARCHAR(100),
        prompt TEXT,
        author VARCHAR(100) DEFAULT 'AI',
        description TEXT,
        auto_repaired BOOLEAN DEFAULT FALSE,
        diff_from_parent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB] Tables initialized successfully');
  } catch (err) {
    console.error('[DB] Failed to initialize tables:', err.message);
  } finally {
    client.release();
  }
}

await initDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

if (isProduction) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/projects', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
        COALESCE(json_agg(
          json_build_object(
            'session_id', s.session_id,
            'name', s.name,
            'current_summary', s.current_summary,
            'created_at', s.created_at
          ) ORDER BY s.created_at
        ) FILTER (WHERE s.session_id IS NOT NULL), '[]') as pages
       FROM projects p
       LEFT JOIN sessions s ON s.project_id = p.project_id
       GROUP BY p.project_id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name = '我的新项目', type = 'PC' } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const projResult = await client.query(
      'INSERT INTO projects (name, type) VALUES ($1, $2) RETURNING *',
      [name, type]
    );
    const project = projResult.rows[0];

    const sessionResult = await client.query(
      'INSERT INTO sessions (project_id, name) VALUES ($1, $2) RETURNING *',
      [project.project_id, '首页']
    );
    const session = sessionResult.rows[0];

    const msgResult = await client.query(
      `INSERT INTO messages (session_id, role, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [session.session_id, 'ai', '您好。我是全栈架构师。请描述需求或上传设计图，我将为您构建高保真原型。']
    );

    const defaultFiles = [{
      name: 'App.tsx',
      path: 'App.tsx',
      language: 'typescript',
      content: `import React from 'react';\n\nexport default function App() {\n  return (\n    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">\n      <h1 className="text-3xl font-black text-slate-900 mb-3">你好！</h1>\n      <p className="text-slate-500">请在右侧输入您的想法</p>\n    </div>\n  );\n}`
    }];

    const versionResult = await client.query(
      `INSERT INTO code_versions (session_id, files, entry_point, prompt, author, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session.session_id, JSON.stringify(defaultFiles), 'App.tsx', '初始化', 'AI', '页面初始化']
    );

    await client.query('COMMIT');
    res.json({
      ...project,
      pages: [{
        ...session,
        messages: [msgResult.rows[0]],
        versions: [versionResult.rows[0]]
      }]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/projects error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/projects/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { name, type } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name = COALESCE($1, name), type = COALESCE($2, type), updated_at = CURRENT_TIMESTAMP WHERE project_id = $3 RETURNING *',
      [name, type, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE project_id = $1', [req.params.projectId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE session_id = $1', [sessionId]
    );
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const messagesResult = await pool.query(
      'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]
    );
    const versionsResult = await pool.query(
      'SELECT * FROM code_versions WHERE session_id = $1 ORDER BY created_at DESC', [sessionId]
    );

    res.json({
      ...sessionResult.rows[0],
      messages: messagesResult.rows,
      versions: versionsResult.rows,
    });
  } catch (err) {
    console.error('GET /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  const { project_id, name = '新页面' } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessionResult = await client.query(
      'INSERT INTO sessions (project_id, name) VALUES ($1, $2) RETURNING *',
      [project_id, name]
    );
    const session = sessionResult.rows[0];

    const msgResult = await client.query(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [session.session_id, 'ai', '您好。我是全栈架构师。请描述需求或上传设计图，我将为您构建高保真原型。']
    );

    const defaultFiles = [{
      name: 'App.tsx', path: 'App.tsx', language: 'typescript',
      content: `import React from 'react';\n\nexport default function App() {\n  return <div className="p-6"><h1>新页面</h1></div>;\n}`
    }];

    const versionResult = await client.query(
      `INSERT INTO code_versions (session_id, files, entry_point, prompt, author, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session.session_id, JSON.stringify(defaultFiles), 'App.tsx', '初始化', 'AI', '页面初始化']
    );

    await client.query('COMMIT');
    res.json({
      ...session,
      messages: [msgResult.rows[0]],
      versions: [versionResult.rows[0]]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { name, current_summary } = req.body;
  try {
    const result = await pool.query(
      `UPDATE sessions SET 
        name = COALESCE($1, name), 
        current_summary = COALESCE($2, current_summary),
        updated_at = CURRENT_TIMESTAMP 
       WHERE session_id = $3 RETURNING *`,
      [name, current_summary, sessionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE session_id = $1', [req.params.sessionId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  const { session_id, role, content, token_count = 0, related_version_id, attachments } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO messages (session_id, role, content, token_count, related_version_id, attachments)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session_id, role, content, token_count, related_version_id, attachments ? JSON.stringify(attachments) : '[]']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3',
      [sessionId, limit, offset]
    );
    const countResult = await pool.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(token_count), 0) as total_tokens FROM messages WHERE session_id = $1',
      [sessionId]
    );
    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].total),
      total_tokens: parseInt(countResult.rows[0].total_tokens)
    });
  } catch (err) {
    console.error('GET /api/messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/versions', async (req, res) => {
  const { session_id, message_id, files, entry_point = 'App.tsx', version_tag, prompt, author = 'AI', description, auto_repaired, diff_from_parent } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO code_versions (session_id, message_id, files, entry_point, version_tag, prompt, author, description, auto_repaired, diff_from_parent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [session_id, message_id, JSON.stringify(files), entry_point, version_tag, prompt, author, description, auto_repaired || false, diff_from_parent]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/versions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/versions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM code_versions WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/versions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/versions/:sessionId/:versionId', async (req, res) => {
  const { versionId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM code_versions WHERE version_id = $1', [versionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/versions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:sessionId/summary', async (req, res) => {
  const { sessionId } = req.params;
  const { summary } = req.body;
  try {
    const result = await pool.query(
      'UPDATE sessions SET current_summary = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2 RETURNING *',
      [summary, sessionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/sessions/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:sessionId/token-stats', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as message_count,
        COALESCE(SUM(token_count), 0) as total_tokens,
        MIN(created_at) as first_message_at,
        MAX(created_at) as last_message_at
       FROM messages WHERE session_id = $1`,
      [sessionId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/sessions/token-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { baseUrl, apiKey, model, messages, response_format } = req.body;
  console.log(`[AI] Request: model=${model}, baseUrl=${baseUrl}, messages=${messages?.length || 0}`);
  const startTime = Date.now();
  try {
    if (!baseUrl || !apiKey || !model) {
      console.error('[AI] Missing required fields:', { baseUrl: !!baseUrl, apiKey: !!apiKey, model: !!model });
      return res.status(400).json({ error: '缺少必要参数: baseUrl, apiKey, model' });
    }
    const targetUrl = `${baseUrl}/chat/completions`;
    console.log(`[AI] Fetching: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, response_format })
    });
    const elapsed = Date.now() - startTime;
    console.log(`[AI] Response: status=${response.status}, elapsed=${elapsed}ms`);
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI] Error body:`, errText.substring(0, 500));
      return res.status(response.status).json({ error: `AI API 请求失败: ${response.status}`, details: errText });
    }
    const data = await response.json();
    const contentLen = data.choices?.[0]?.message?.content?.length || 0;
    console.log(`[AI] Success: content_length=${contentLen}, elapsed=${elapsed}ms`);
    res.json(data);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[AI] Exception after ${elapsed}ms:`, err.message);
    res.status(502).json({ error: `AI 代理请求失败: ${err.message}` });
  }
});

app.post('/api/github/sync', async (req, res) => {
  const { repoName, files, commitMessage = 'Sync from AI IDE' } = req.body;
  if (!getUncachableGitHubClient) {
    return res.status(500).json({ error: 'GitHub integration not available' });
  }
  try {
    const octokit = await getUncachableGitHubClient();
    const user = await octokit.users.getAuthenticated();
    const owner = user.data.login;

    // Create repo if not exists
    try {
      await octokit.repos.get({ owner, repo: repoName });
    } catch (e) {
      await octokit.repos.createForAuthenticatedUser({ name: repoName, private: true });
    }

    // Get latest commit to find base tree
    let baseTreeSha;
    try {
      const { data: ref } = await octokit.git.getRef({ owner, repo: repoName, ref: 'heads/main' });
      const { data: commit } = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: ref.object.sha });
      baseTreeSha = commit.tree.sha;
    } catch (e) {
      // Branch might not exist yet
    }

    // Create blobs for files
    const tree = await Promise.all(files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo: repoName,
        content: file.content,
        encoding: 'utf-8'
      });
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      };
    }));

    // Create tree
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree,
      base_tree: baseTreeSha
    });

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage,
      tree: newTree.sha,
      parents: baseTreeSha ? [baseTreeSha] : []
    });

    // Update ref
    try {
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: 'heads/main',
        sha: newCommit.sha
      });
    } catch (e) {
      await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: 'refs/heads/main',
        sha: newCommit.sha
      });
    }

    res.json({ success: true, url: `https://github.com/${owner}/${repoName}` });
  } catch (err) {
    console.error('GitHub Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

if (isProduction) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

process.on('SIGHUP', () => {
  console.log('[Server] Received SIGHUP, ignoring...');
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || '3001');
const HOST = isProduction ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Backend server running on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
});
