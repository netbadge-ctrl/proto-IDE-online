
import React, { createContext, useContext, useReducer, PropsWithChildren, useEffect, useCallback, useRef } from 'react';
import { Project, Page, Version, ProjectType, MOCK_TEMPLATES, FileEntry, Message, LogEntry, GithubConfig, ExternalModelConfig } from '../types';
import { api, DbProject, DbSession, DbMessage, DbVersion } from '../services/api';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createDefaultMessage = (): Message => ({
    id: generateId(),
    role: 'ai',
    content: '您好。我是全栈架构师。请描述需求或上传设计图，我将为您构建高保真原型。',
    timestamp: Date.now()
});

const createInitialPage = (name = '首页'): Page => {
    const id = generateId();
    const versionId = 'v_init_' + id;
    return {
        id,
        name,
        currentVersionId: versionId,
        messages: [createDefaultMessage()],
        versions: [{
            id: versionId,
            timestamp: Date.now(),
            files: MOCK_TEMPLATES.EMPTY.files,
            entryPoint: MOCK_TEMPLATES.EMPTY.entryPoint,
            prompt: '初始化',
            author: 'AI',
            description: '页面初始化'
        }]
    };
};

const createInitialProject = (name = '我的新项目', type: ProjectType = 'PC'): Project => {
    const initialPage = createInitialPage();
    return {
        id: generateId(),
        name,
        type,
        createdAt: Date.now(),
        activePageId: initialPage.id,
        pages: [initialPage]
    };
};

const DEFAULT_EXTERNAL_CONFIG: ExternalModelConfig = {
    enabled: true,
    baseUrl: 'https://kspmas.ksyun.com/v1',
    apiKey: '3f8615f8-7f46-4ca9-89a0-665cb8e22955',
    modelId: 'glm-4.7'
};

const getStoredExternalConfig = (): ExternalModelConfig => {
    const stored = localStorage.getItem('external_ai_config');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.baseUrl && parsed.apiKey && parsed.modelId) {
                return parsed;
            }
        } catch (e) { console.error(e); }
    }
    return DEFAULT_EXTERNAL_CONFIG;
};

function mapDbVersionToVersion(v: DbVersion): Version {
    return {
        id: v.version_id,
        timestamp: new Date(v.created_at).getTime(),
        files: v.files as FileEntry[],
        entryPoint: v.entry_point,
        prompt: v.prompt,
        author: v.author as 'AI' | 'User',
        description: v.description,
        autoRepaired: v.auto_repaired,
    };
}

function mapDbMessageToMessage(m: DbMessage): Message {
    let attachments: string[] | undefined;
    if (m.attachments) {
        if (typeof m.attachments === 'string') {
            try { attachments = JSON.parse(m.attachments); } catch { attachments = []; }
        } else if (Array.isArray(m.attachments)) {
            attachments = m.attachments;
        }
    }
    return {
        id: m.message_id,
        role: m.role as 'user' | 'ai' | 'system',
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        relatedVersionId: m.related_version_id || undefined,
        attachments,
    };
}

function mapDbSessionToPage(s: DbSession): Page {
    const versions = (s.versions || []).map(mapDbVersionToVersion);
    const messages = (s.messages || []).map(mapDbMessageToMessage);
    return {
        id: s.session_id,
        name: s.name,
        currentVersionId: versions.length > 0 ? versions[0].id : '',
        versions,
        messages,
    };
}

function mapDbProjectToProject(p: DbProject): Project {
    const pages = (p.pages || []).map(mapDbSessionToPage);
    return {
        id: p.project_id,
        name: p.name,
        type: p.type as ProjectType,
        createdAt: new Date(p.created_at).getTime(),
        activePageId: pages.length > 0 ? pages[0].id : '',
        pages,
    };
}

const INITIAL_STATE: AppState = {
    projects: [createInitialProject('我的原型项目')],
    activeProjectId: '',
    selectedModel: 'glm-4.7',
    githubConfig: {
        token: localStorage.getItem('gh_token') || '',
        user: null
    },
    externalModelConfig: getStoredExternalConfig(),
    logs: [],
    dbReady: false,
};
INITIAL_STATE.activeProjectId = INITIAL_STATE.projects[0].id;

type Action =
    | { type: 'SET_ACTIVE_PROJECT'; payload: string }
    | { type: 'CREATE_PROJECT'; payload: { name: string, type: ProjectType } }
    | { type: 'RENAME_PROJECT'; payload: { projectId: string, name: string } }
    | { type: 'DELETE_PROJECT'; payload: string }
    | { type: 'SET_ACTIVE_PAGE'; payload: string }
    | { type: 'ADD_PAGE'; payload: string }
    | { type: 'RENAME_PAGE'; payload: { pageId: string, name: string } }
    | { type: 'DELETE_PAGE'; payload: string }
    | { type: 'ADD_VERSION'; payload: { id?: string; pageId: string; files: FileEntry[]; entryPoint: string; prompt: string; description: string; autoRepaired?: boolean } }
    | { type: 'MARK_VERSION_REPAIRED'; payload: { pageId: string; versionId: string } }
    | { type: 'ROLLBACK_VERSION'; payload: { pageId: string; versionId: string } }
    | { type: 'UPDATE_FILE_CONTENT'; payload: { pageId: string; fileName: string; content: string; newVersionId?: string; description?: string } }
    | { type: 'ADD_MESSAGE'; payload: { pageId: string; message: Message } }
    | { type: 'SET_MODEL'; payload: string }
    | { type: 'UPDATE_GITHUB_CONFIG'; payload: Partial<GithubConfig> }
    | { type: 'UPDATE_EXTERNAL_MODEL_CONFIG'; payload: Partial<ExternalModelConfig> }
    | { type: 'ADD_LOG'; payload: LogEntry }
    | { type: 'CLEAR_LOGS'; payload: void }
    | { type: 'LOAD_PROJECTS_FROM_DB'; payload: Project[] }
    | { type: 'ADD_PROJECT_FROM_DB'; payload: Project }
    | { type: 'ADD_PAGE_FROM_DB'; payload: { projectId: string; page: Page } }
    | { type: 'ADD_MESSAGE_FROM_DB'; payload: { pageId: string; message: Message } }
    | { type: 'ADD_VERSION_FROM_DB'; payload: { pageId: string; version: Version } }
    | { type: 'SET_DB_READY'; payload: boolean };

interface AppState {
    projects: Project[];
    activeProjectId: string;
    selectedModel: string;
    githubConfig: GithubConfig;
    externalModelConfig: ExternalModelConfig;
    logs: LogEntry[];
    dbReady: boolean;
}

function appReducer(state: AppState, action: Action): AppState {
    const updateProject = (projectId: string, updater: (p: Project) => Project) => ({
        ...state,
        projects: state.projects.map(p => p.id === projectId ? updater(p) : p)
    });

    const updatePage = (projectId: string, pageId: string, updater: (pg: Page) => Page) => 
        updateProject(projectId, p => ({
            ...p,
            pages: p.pages.map(pg => pg.id === pageId ? updater(pg) : pg)
        }));

    switch (action.type) {
        case 'SET_ACTIVE_PROJECT':
            return { ...state, activeProjectId: action.payload };

        case 'CREATE_PROJECT': {
            const newProj = createInitialProject(action.payload.name, action.payload.type);
            return { ...state, projects: [...state.projects, newProj], activeProjectId: newProj.id };
        }

        case 'ADD_PAGE': {
            const newPage = createInitialPage(action.payload);
            return updateProject(state.activeProjectId, p => ({
                ...p,
                pages: [...p.pages, newPage],
                activePageId: newPage.id
            }));
        }

        case 'ADD_VERSION': {
            const { id, pageId, files, entryPoint, prompt, description, autoRepaired } = action.payload;
            const newVer: Version = { id: id || generateId(), timestamp: Date.now(), files, entryPoint, prompt, author: 'AI', description, autoRepaired };
            return updatePage(state.activeProjectId, pageId, pg => ({
                ...pg,
                versions: [newVer, ...pg.versions],
                currentVersionId: newVer.id
            }));
        }

        case 'UPDATE_FILE_CONTENT': {
            const { pageId, fileName, content, newVersionId, description } = action.payload;
            return updatePage(state.activeProjectId, pageId, pg => {
                const cur = pg.versions.find(v => v.id === pg.currentVersionId);
                if (!cur) return pg;
                const newFiles = cur.files.map(f => f.name === fileName ? { ...f, content } : f);
                const vid = newVersionId || generateId();
                const newVer: Version = {
                    id: vid,
                    timestamp: Date.now(),
                    files: newFiles,
                    entryPoint: cur.entryPoint,
                    prompt: description || `修改 ${fileName}`,
                    author: 'User',
                    description: '可视化编辑快照'
                };
                return { ...pg, versions: [newVer, ...pg.versions], currentVersionId: vid };
            });
        }

        case 'ADD_MESSAGE':
            return updatePage(state.activeProjectId, action.payload.pageId, pg => ({
                ...pg,
                messages: [...(pg.messages || []), action.payload.message]
            }));

        case 'SET_MODEL':
            return { ...state, selectedModel: action.payload };

        case 'ROLLBACK_VERSION': {
            const { pageId, versionId } = action.payload;
            return updatePage(state.activeProjectId, pageId, pg => ({
                ...pg,
                currentVersionId: versionId
            }));
        }

        case 'UPDATE_GITHUB_CONFIG':
            if (action.payload.token !== undefined) {
                localStorage.setItem('gh_token', action.payload.token);
            }
            return { ...state, githubConfig: { ...state.githubConfig, ...action.payload } };

        case 'UPDATE_EXTERNAL_MODEL_CONFIG':
            const newExternalConfig = { ...state.externalModelConfig, ...action.payload };
            localStorage.setItem('external_ai_config', JSON.stringify(newExternalConfig));
            return { ...state, externalModelConfig: newExternalConfig };

        case 'ADD_LOG':
            return { ...state, logs: [...state.logs.slice(-49), action.payload] };

        case 'LOAD_PROJECTS_FROM_DB':
            return {
                ...state,
                projects: action.payload,
                activeProjectId: action.payload.length > 0 ? action.payload[0].id : state.activeProjectId,
                dbReady: true,
            };

        case 'ADD_PROJECT_FROM_DB':
            return {
                ...state,
                projects: [...state.projects, action.payload],
                activeProjectId: action.payload.id,
            };

        case 'ADD_PAGE_FROM_DB': {
            const { projectId, page } = action.payload;
            return updateProject(projectId, p => ({
                ...p,
                pages: [...p.pages, page],
                activePageId: page.id,
            }));
        }

        case 'ADD_MESSAGE_FROM_DB': {
            const { pageId, message } = action.payload;
            let found = false;
            const newState = {
                ...state,
                projects: state.projects.map(p => ({
                    ...p,
                    pages: p.pages.map(pg => {
                        if (pg.id === pageId) {
                            found = true;
                            return { ...pg, messages: [...(pg.messages || []), message] };
                        }
                        return pg;
                    })
                }))
            };
            return found ? newState : state;
        }

        case 'ADD_VERSION_FROM_DB': {
            const { pageId, version } = action.payload;
            let vFound = false;
            const vState = {
                ...state,
                projects: state.projects.map(p => ({
                    ...p,
                    pages: p.pages.map(pg => {
                        if (pg.id === pageId) {
                            vFound = true;
                            return { ...pg, versions: [version, ...pg.versions], currentVersionId: version.id };
                        }
                        return pg;
                    })
                }))
            };
            return vFound ? vState : state;
        }

        case 'SET_DB_READY':
            return { ...state, dbReady: action.payload };

        default:
            return state;
    }
}

interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    getCurrentProject: () => Project;
    getCurrentPage: () => Page | undefined;
    getCurrentVersion: () => Version | undefined;
    dbActions: {
        createProject: (name: string, type: ProjectType) => Promise<void>;
        createPage: (projectId: string, name: string) => Promise<void>;
        addMessage: (sessionId: string, role: string, content: string, relatedVersionId?: string) => Promise<DbMessage | null>;
        addVersion: (sessionId: string, data: { files: FileEntry[]; entryPoint: string; prompt: string; description: string; messageId?: string; author?: string; autoRepaired?: boolean }) => Promise<DbVersion | null>;
        loadSessionData: (sessionId: string) => Promise<void>;
        deleteProject: (projectId: string) => Promise<void>;
        deleteSession: (sessionId: string) => Promise<void>;
        updateProjectName: (projectId: string, name: string) => Promise<void>;
        updateSessionName: (sessionId: string, name: string) => Promise<void>;
    };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren<{}>) {
    const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
    const initialLoadDone = useRef(false);

    const getCurrentProject = () => state.projects.find(p => p.id === state.activeProjectId) || state.projects[0];
    const getCurrentPage = () => {
        const proj = getCurrentProject();
        return proj.pages.find(p => p.id === proj.activePageId) || proj.pages[0];
    };
    const getCurrentVersion = () => {
        const page = getCurrentPage();
        return page?.versions.find(v => v.id === page.currentVersionId);
    };

    useEffect(() => {
        if (initialLoadDone.current) return;
        initialLoadDone.current = true;

        const init = async () => {
            const token = localStorage.getItem('gh_token');
            if (token) {
                try {
                    const res = await fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${token}` } });
                    if (res.ok) {
                        const user = await res.json();
                        dispatch({ type: 'UPDATE_GITHUB_CONFIG', payload: { user } });
                    }
                } catch (e) { console.error(e); }
            }

            try {
                const dbProjects = await api.getProjects();

                if (dbProjects.length === 0) {
                    const created = await api.createProject('我的原型项目', 'PC');
                    const sessionData = await api.getSession(created.pages![0].session_id);
                    const mapped = mapDbProjectToProject({
                        ...created,
                        pages: [sessionData],
                    });
                    dispatch({ type: 'LOAD_PROJECTS_FROM_DB', payload: [mapped] });
                } else {
                    const fullProjects: Project[] = [];
                    for (const proj of dbProjects) {
                        const pages: Page[] = [];
                        for (const s of (proj.pages || [])) {
                            if (!s.session_id) continue;
                            const sessionData = await api.getSession(s.session_id);
                            pages.push(mapDbSessionToPage(sessionData));
                        }
                        fullProjects.push({
                            id: proj.project_id,
                            name: proj.name,
                            type: proj.type as ProjectType,
                            createdAt: new Date(proj.created_at).getTime(),
                            activePageId: pages.length > 0 ? pages[0].id : '',
                            pages,
                        });
                    }
                    dispatch({ type: 'LOAD_PROJECTS_FROM_DB', payload: fullProjects });
                }
            } catch (err) {
                console.error('Failed to load from database, using local state:', err);
                dispatch({ type: 'SET_DB_READY', payload: true });
            }
        };
        init();
    }, []);

    const dbActions = {
        createProject: async (name: string, type: ProjectType) => {
            try {
                const created = await api.createProject(name, type);
                const sessionData = await api.getSession(created.pages![0].session_id);
                const mapped = mapDbProjectToProject({ ...created, pages: [sessionData] });
                dispatch({ type: 'ADD_PROJECT_FROM_DB', payload: mapped });
            } catch (err) {
                console.error('DB createProject failed, falling back to local:', err);
                dispatch({ type: 'CREATE_PROJECT', payload: { name, type } });
            }
        },

        createPage: async (projectId: string, name: string) => {
            try {
                const created = await api.createSession(projectId, name);
                const page = mapDbSessionToPage(created);
                dispatch({ type: 'ADD_PAGE_FROM_DB', payload: { projectId, page } });
            } catch (err) {
                console.error('DB createPage failed, falling back to local:', err);
                dispatch({ type: 'ADD_PAGE', payload: name });
            }
        },

        addMessage: async (sessionId: string, role: string, content: string, relatedVersionId?: string) => {
            try {
                const msg = await api.addMessage({
                    session_id: sessionId,
                    role,
                    content,
                    related_version_id: relatedVersionId,
                });
                const mapped = mapDbMessageToMessage(msg);
                dispatch({ type: 'ADD_MESSAGE_FROM_DB', payload: { pageId: sessionId, message: mapped } });
                return msg;
            } catch (err) {
                console.error('DB addMessage failed:', err);
                return null;
            }
        },

        addVersion: async (sessionId: string, data: { id?: string; files: FileEntry[]; entryPoint: string; prompt: string; description: string; messageId?: string; author?: string; autoRepaired?: boolean }) => {
            try {
                const ver = await api.addVersion({
                    session_id: sessionId,
                    version_id: data.id,
                    message_id: data.messageId,
                    files: data.files,
                    entry_point: data.entryPoint,
                    prompt: data.prompt,
                    author: data.author || 'AI',
                    description: data.description,
                    auto_repaired: data.autoRepaired,
                });
                const mapped = mapDbVersionToVersion(ver);
                dispatch({ type: 'ADD_VERSION_FROM_DB', payload: { pageId: sessionId, version: mapped } });
                return ver;
            } catch (err) {
                console.error('DB addVersion failed:', err);
                return null;
            }
        },

        loadSessionData: async (sessionId: string) => {
            try {
                const data = await api.getSession(sessionId);
                const page = mapDbSessionToPage(data);
                const proj = state.projects.find(p => p.pages.some(pg => pg.id === sessionId));
                if (proj) {
                    const exists = proj.pages.some(pg => pg.id === sessionId);
                    if (exists) {
                        dispatch({
                            type: 'LOAD_PROJECTS_FROM_DB',
                            payload: state.projects.map(p => p.id === proj.id
                                ? { ...p, pages: p.pages.map(pg => pg.id === sessionId ? page : pg) }
                                : p
                            )
                        });
                    } else {
                        dispatch({ type: 'ADD_PAGE_FROM_DB', payload: { projectId: proj.id, page } });
                    }
                }
            } catch (err) {
                console.error('DB loadSession failed:', err);
            }
        },

        deleteProject: async (projectId: string) => {
            try {
                await api.deleteProject(projectId);
                dispatch({ type: 'DELETE_PROJECT', payload: projectId });
            } catch (err) {
                console.error('DB deleteProject failed:', err);
                dispatch({ type: 'DELETE_PROJECT', payload: projectId });
            }
        },

        deleteSession: async (sessionId: string) => {
            try {
                await api.deleteSession(sessionId);
                dispatch({ type: 'DELETE_PAGE', payload: sessionId });
            } catch (err) {
                console.error('DB deleteSession failed:', err);
                dispatch({ type: 'DELETE_PAGE', payload: sessionId });
            }
        },

        updateProjectName: async (projectId: string, name: string) => {
            try {
                await api.updateProject(projectId, { name });
                dispatch({ type: 'RENAME_PROJECT', payload: { projectId, name } });
            } catch (err) {
                console.error('DB updateProject failed:', err);
                dispatch({ type: 'RENAME_PROJECT', payload: { projectId, name } });
            }
        },

        updateSessionName: async (sessionId: string, name: string) => {
            try {
                await api.updateSession(sessionId, { name });
                dispatch({ type: 'RENAME_PAGE', payload: { pageId: sessionId, name } });
            } catch (err) {
                console.error('DB updateSession failed:', err);
                dispatch({ type: 'RENAME_PAGE', payload: { pageId: sessionId, name } });
            }
        },
    };

    return (
        <AppContext.Provider value={{ state, dispatch, getCurrentProject, getCurrentPage, getCurrentVersion, dbActions }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useApp must be used within an AppProvider');
    return context;
}
