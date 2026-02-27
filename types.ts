
export interface FileEntry {
    name: string;
    path: string;
    content: string;
    language: 'typescript' | 'javascript' | 'css' | 'html' | 'json';
}

export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'system';
    message: string;
    timestamp: number;
}

export interface Version {
    id: string;
    timestamp: number;
    files: FileEntry[]; 
    entryPoint: string; 
    prompt: string;
    author: 'AI' | 'User';
    description: string;
    autoRepaired?: boolean; 
}

export interface Message {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: number;
    isLoading?: boolean;
    relatedVersionId?: string;
    attachments?: string[]; 
}

export interface Page {
    id: string;
    name: string;
    versions: Version[];
    currentVersionId: string;
    messages: Message[]; 
}

export type ProjectType = 'PC' | 'Mobile';

export interface Project {
    id: string;
    name: string;
    type: ProjectType;
    createdAt: number;
    pages: Page[];
    activePageId: string;
}

export interface GithubConfig {
    token: string;
    user: {
        login: string;
        avatar_url: string;
        name: string;
    } | null;
}

export interface ExternalModelConfig {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    modelId: string;
}

export const MOCK_TEMPLATES = {
    EMPTY: {
        files: [
            {
                name: 'App.tsx',
                path: 'App.tsx',
                language: 'typescript' as const,
                content: `import React from 'react';

export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 max-w-sm w-full animate-in fade-in zoom-in duration-700">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black mb-8 mx-auto shadow-xl shadow-blue-200 rotate-3 hover:rotate-0 transition-transform cursor-pointer">AI</div>
        <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">你好！</h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">我是您的 AI 架构师。请在右侧输入您的想法，我将立即为您构建高保真原型。</p>
        <div className="space-y-3">
            <div className="h-2.5 bg-slate-100 rounded-full w-full animate-pulse"></div>
            <div className="h-2.5 bg-slate-100 rounded-full w-5/6 mx-auto animate-pulse delay-75"></div>
            <div className="h-2.5 bg-slate-100 rounded-full w-4/6 mx-auto animate-pulse delay-150"></div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            ProtoIDE Studio
        </div>
      </div>
    </div>
  );
}`
            }
        ],
        entryPoint: 'App.tsx'
    }
};
