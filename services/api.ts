const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export interface DbProject {
  project_id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  pages?: DbSession[];
}

export interface DbSession {
  session_id: string;
  project_id: string;
  name: string;
  current_summary: string | null;
  created_at: string;
  updated_at?: string;
  messages?: DbMessage[];
  versions?: DbVersion[];
}

export interface DbMessage {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  token_count: number;
  related_version_id: string | null;
  attachments: string[];
  created_at: string;
}

export interface DbVersion {
  version_id: string;
  session_id: string;
  message_id: string | null;
  files: Array<{ name: string; path: string; content: string; language: string }>;
  entry_point: string;
  version_tag: string | null;
  prompt: string;
  author: string;
  description: string;
  auto_repaired: boolean;
  diff_from_parent: string | null;
  created_at: string;
}

export interface TokenStats {
  message_count: string;
  total_tokens: string;
  first_message_at: string | null;
  last_message_at: string | null;
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  getProjects: () => request<DbProject[]>('/projects'),

  createProject: (name: string, type: string = 'PC') =>
    request<DbProject>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),

  updateProject: (projectId: string, data: { name?: string; type?: string }) =>
    request<DbProject>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProject: (projectId: string) =>
    request<{ success: boolean }>(`/projects/${projectId}`, {
      method: 'DELETE',
    }),

  getSession: (sessionId: string) =>
    request<DbSession>(`/sessions/${sessionId}`),

  createSession: (projectId: string, name: string = '新页面') =>
    request<DbSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, name }),
    }),

  updateSession: (sessionId: string, data: { name?: string; current_summary?: string }) =>
    request<DbSession>(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSession: (sessionId: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  updateSessionSummary: (sessionId: string, summary: string) =>
    request<DbSession>(`/sessions/${sessionId}/summary`, {
      method: 'PUT',
      body: JSON.stringify({ summary }),
    }),

  getTokenStats: (sessionId: string) =>
    request<TokenStats>(`/sessions/${sessionId}/token-stats`),

  getMessages: (sessionId: string, limit = 50, offset = 0) =>
    request<{ messages: DbMessage[]; total: number; total_tokens: number }>(
      `/messages/${sessionId}?limit=${limit}&offset=${offset}`
    ),

  addMessage: (data: {
    session_id: string;
    role: string;
    content: string;
    token_count?: number;
    related_version_id?: string;
    attachments?: string[];
  }) =>
    request<DbMessage>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVersions: (sessionId: string) =>
    request<DbVersion[]>(`/versions/${sessionId}`),

  getVersion: (sessionId: string, versionId: string) =>
    request<DbVersion>(`/versions/${sessionId}/${versionId}`),

  addVersion: (data: {
    session_id: string;
    version_id?: string;
    message_id?: string;
    files: Array<{ name: string; path: string; content: string; language: string }>;
    entry_point?: string;
    version_tag?: string;
    prompt: string;
    author?: string;
    description: string;
    auto_repaired?: boolean;
    diff_from_parent?: string;
  }) =>
    request<DbVersion>('/versions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  syncToGitHub: (repoName: string, files: Array<{ path: string; content: string }>, commitMessage?: string) =>
    request<{ success: boolean; url: string }>('/github/sync', {
      method: 'POST',
      body: JSON.stringify({ repoName, files, commitMessage }),
    }),
};
