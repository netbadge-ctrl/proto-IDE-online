
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Code, Eye, RefreshCw, Loader2, MousePointer2, X, AlertCircle } from 'lucide-react';
import { FileEntry, Version } from '../types';

// --- 更加健壮的运行时 Shell ---
const RUNTIME_SHELL = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <style>
        body { margin: 0; background: #ffffff; font-family: -apple-system, sans-serif; height: 100vh; width: 100vw; overflow: auto; }
        #root { min-height: 100%; }
        #error-display { padding: 20px; color: #ef4444; font-family: monospace; font-size: 12px; background: #fef2f2; border: 1px solid #fee2e2; margin: 10px; border-radius: 8px; display: none; }
    </style>
    <!-- 使用更稳定的 CDN 链接 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.staticfile.net/remixicon/4.2.0/remixicon.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
</head>
<body>
    <div id="error-display"></div>
    <div id="root"></div>
    <script>
        (function() {
            const rootEl = document.getElementById('root');
            const errEl = document.getElementById('error-display');
            let reactRoot = null;

            const log = (level, message) => window.parent.postMessage({ type: 'LOG', level, message }, '*');

            // 核心：等待所有全局库就绪
            function checkDeps() {
                if (window.React && window.ReactDOM && window.Babel) {
                    setupListeners();
                    setupErrorHandling();
                    log('system', '🚀 容器就绪');
                } else {
                    setTimeout(checkDeps, 50);
                }
            }

            function setupErrorHandling() {
                window.onerror = function(message, source, lineno, colno, error) {
                    errEl.textContent = '运行时错误: ' + message;
                    errEl.style.display = 'block';
                    log('error', message);
                    return true;
                };
            }

            function setupListeners() {
                // 注册 Babel 插件处理导入
                Babel.registerPlugin('import-to-global', ({ types: t }) => ({
                    visitor: {
                        ImportDeclaration(p) {
                            const s = p.node.source.value;
                            const specs = p.node.specifiers;
                            
                            // 将已知库映射到 window 全局变量
                            let globalObj = null;
                            if (s === 'react') globalObj = 'React';
                            else if (s === 'react-dom' || s === 'react-dom/client') globalObj = 'ReactDOM';
                            
                            if (globalObj) {
                                // 转为: const { useState } = window.React;
                                const init = t.memberExpression(t.identifier('window'), t.identifier(globalObj));
                                const vars = specs.map(spec => {
                                    if (t.isImportDefaultSpecifier(spec)) return t.variableDeclarator(spec.local, init);
                                    if (t.isImportNamespaceSpecifier(spec)) return t.variableDeclarator(spec.local, init);
                                    return t.variableDeclarator(spec.local, t.memberExpression(init, spec.imported));
                                });
                                p.replaceWith(t.variableDeclaration('const', vars));
                            } else {
                                // 未知库(如 lucide-react)：替换为空 Proxy 而非直接删除，避免 ReferenceError
                                if (specs.length > 0) {
                                    const emptyObj = t.objectExpression([]);
                                    const vars = specs.map(spec => t.variableDeclarator(spec.local, emptyObj));
                                    p.replaceWith(t.variableDeclaration('const', vars));
                                } else {
                                    p.remove();
                                }
                            }
                        },
                        ExportDefaultDeclaration(p) {
                            const d = p.node.declaration;
                            const assign = t.expressionStatement(
                                t.assignmentExpression('=',
                                    t.memberExpression(t.identifier('window'), t.identifier('App')),
                                    t.isFunctionDeclaration(d) && d.id
                                        ? t.identifier(d.id.name)
                                        : d
                                )
                            );
                            if (t.isFunctionDeclaration(d) && d.id) {
                                // function App() {} 先保留函数声明，再赋値给 window.App
                                p.replaceWithMultiple([d, assign]);
                            } else {
                                p.replaceWith(assign);
                            }
                        }
                    }
                }));

                window.addEventListener('message', async (e) => {
                    if (e.data.type === 'UPDATE_CODE') {
                        errEl.style.display = 'none';
                        try {
                            const { code, css } = e.data;
                            
                            // 1. CSS 注入
                            let styleEl = document.getElementById('injected-style');
                            if (!styleEl) {
                                styleEl = document.createElement('style');
                                styleEl.id = 'injected-style';
                                document.head.appendChild(styleEl);
                            }
                            styleEl.innerHTML = css || '';

                            // 2. 编译
                            const out = Babel.transform(code, {
                                presets: ['react', 'typescript'],
                                plugins: ['import-to-global'],
                                filename: 'App.tsx'
                            });

                            const oldScript = document.getElementById('injected-script');
                            if (oldScript) oldScript.remove();

                            // 关键修复：重置 reactRoot 以避免 React 18 的重复挂载冲突白屏
                            if (reactRoot) {
                                try { reactRoot.unmount(); } catch(e) {}
                                reactRoot = null;
                            }
                            rootEl.innerHTML = ''; // 清空遗留 DOM

                            // 使用 new Function 构建隔离闭包以同步捕获顶层报错，代替动态 script 注入的异步流失
                            try {
                                const executeCode = new Function(out.code);
                                executeCode();

                                // 3. 使用 ReactDOM 挂载
                                if (window.App) {
                                    reactRoot = window.ReactDOM.createRoot(rootEl);
                                    reactRoot.render(window.React.createElement(window.App));
                                    log('system', '✅ UI 渲染完成');
                                } else {
                                    throw new Error('代码未找到 export default 组件');
                                }
                            } catch (execErr) {
                                throw new Error('执行异常: ' + execErr.message);
                            }
                            
                        } catch (err) {
                            errEl.textContent = '编译/执行错误: ' + err.message;
                            errEl.style.display = 'block';
                            log('error', err.message);
                        }
                    }
                });
            }

            checkDeps();
        })();
    </script>
</body>
</html>`;

export default function Workspace() {
    const { state, dispatch, getCurrentProject, getCurrentVersion, setSelectedElement } = useApp();
    const [view, setView] = useState<'preview' | 'code'>('preview');
    const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [conOpen, setConOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const [renderTrigger, setRenderTrigger] = useState(0);

    const version = getCurrentVersion();
    const project = getCurrentProject();

    useEffect(() => {
        if (iframeRef.current && !iframeRef.current.srcdoc) {
            iframeRef.current.srcdoc = RUNTIME_SHELL;
        }
    }, []);

    // 每当容器彻底初建成功或版本更新，增加触发计数器
    useEffect(() => {
        if (iframeReady && view === 'preview') {
            setRenderTrigger(prev => prev + 1);
        }
    }, [iframeReady, view, version?.id]);

    useEffect(() => {
        if (renderTrigger > 0 && view === 'preview' && version && iframeReady && iframeRef.current?.contentWindow) {
            setLoading(true);
            const scripts = version.files.filter(f => ['typescript', 'javascript'].includes(f.language) || f.name.endsWith('.tsx'));
            const codeString = scripts.map(f => f.content).join('\n');
            const cssString = version.files.filter(f => f.language === 'css').map(f => f.content).join('\n');

            iframeRef.current.contentWindow.postMessage({
                type: 'UPDATE_CODE',
                code: codeString,
                css: cssString
            }, '*');

            const timer = setTimeout(() => setLoading(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [renderTrigger]);

    // 监听 activePageId 改变，强制重新挂载/刷新 iframe
    useEffect(() => {
        if (iframeRef.current) {
            setIframeReady(false);
            iframeRef.current.srcdoc = RUNTIME_SHELL;
        }
    }, [project.activePageId]);

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data.type === 'LOG') {
                dispatch({ type: 'ADD_LOG', payload: { ...e.data, timestamp: Date.now() } });

                if (e.data.message === '🚀 容器就绪') {
                    setIframeReady(true);
                }

                if (e.data.message === '✅ UI 渲染完成') {
                    setLoading(false);
                }

                if (e.data.level === 'error') {
                    setLoading(false);
                    setConOpen(true);
                }

                if (e.data.message === '✅ UI 渲染完成' && iframeRef.current) {
                    const doc = iframeRef.current.contentDocument;
                    if (doc) {
                        doc.body.onclick = (ev) => {
                            if (!isSelectMode) return;
                            ev.stopPropagation(); ev.preventDefault();
                            const target = ev.target as HTMLElement;
                            if (target === doc.body || target.id === 'root') return;
                            doc.querySelectorAll('.element-selected').forEach(el => el.classList.remove('element-selected'));
                            target.classList.add('element-selected');
                            target.setAttribute('data-tag-name', target.tagName.toLowerCase());
                            setSelectedElement(target);
                        };
                    }
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isSelectMode, setSelectedElement, dispatch]);

    useEffect(() => {
        if (version?.files.length) {
            const matchingFile = activeFile ? version.files.find(f => f.name === activeFile.name) : null;
            setActiveFile(matchingFile || version.files.find(f => f.name.endsWith('.tsx')) || version.files[0]);
        }
    }, [version]);

    return (
        <div className="flex-1 flex flex-col bg-ide-bg overflow-hidden relative">
            <div className={`absolute top-10 left-0 h-[2px] bg-blue-500 z-50 transition-all duration-300 ${loading ? 'opacity-100 w-full' : 'opacity-0 w-0'}`}></div>

            <div className="h-10 bg-ide-sidebar border-b border-ide-border flex items-center justify-between px-4 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="flex bg-ide-bg rounded-lg p-0.5 border border-ide-border">
                        <button onClick={() => setView('preview')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${view === 'preview' ? 'bg-ide-hover text-blue-400 border border-blue-500/20' : 'text-gray-500'}`}>预览</button>
                        <button onClick={() => setView('code')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${view === 'code' ? 'bg-ide-hover text-blue-400 border border-blue-500/20' : 'text-gray-500'}`}>代码</button>
                    </div>
                    <button
                        onClick={() => { if (iframeRef.current) iframeRef.current.srcdoc = RUNTIME_SHELL; setIframeReady(false); }}
                        className="p-1.5 hover:bg-ide-hover rounded text-gray-500 hover:text-blue-400"
                        title="重置容器"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsSelectMode(!isSelectMode)} className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase border transition-all ${isSelectMode ? 'bg-blue-600 text-white border-blue-500' : 'text-gray-500 border-ide-border hover:bg-ide-hover'}`}><MousePointer2 size={12} /> {isSelectMode ? '选择中' : '选择模式'}</button>
                    <button onClick={() => setConOpen(!conOpen)} className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${state.logs.some(l => l.level === 'error') ? 'text-red-400 bg-red-500/10' : 'text-gray-500'}`}>控制台({state.logs.length})</button>
                </div>
            </div>

            <div className="flex-1 relative flex overflow-hidden">
                <div className="flex-1 bg-[#090b0f] p-4 flex items-center justify-center overflow-auto">
                    <div className={`bg-white shadow-2xl transition-all duration-500 relative ${project.type === 'PC' ? 'w-full h-full rounded-xl' : 'w-[375px] h-[812px] rounded-[3rem] border-[12px] border-gray-900'} overflow-hidden`}>
                        {view === 'preview' ? (
                            <>
                                {loading && (
                                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center animate-in fade-in">
                                        <div className="bg-white/90 p-5 rounded-2xl shadow-2xl flex flex-col items-center border border-gray-100">
                                            <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Hot Reloading...</span>
                                        </div>
                                    </div>
                                )}
                                <iframe ref={iframeRef} className="w-full h-full border-none bg-white" sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin" />
                            </>
                        ) : (
                            <pre className="p-8 text-sm font-mono text-blue-200/80 bg-[#0d0e12] h-full overflow-auto whitespace-pre-wrap">{activeFile?.content}</pre>
                        )}
                    </div>
                </div>

                {conOpen && (
                    <div className="absolute bottom-0 left-0 right-0 h-48 bg-[#0d0e12] border-t border-ide-border flex flex-col z-[100] animate-in slide-in-from-bottom">
                        <div className="h-8 bg-ide-panel border-b border-ide-border flex items-center justify-between px-4 text-[10px] font-bold text-gray-500 uppercase">
                            <span>Output Console</span>
                            <button onClick={() => setConOpen(false)}><X size={14} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
                            {state.logs.map((l, i) => (
                                <div key={i} className={`flex gap-2 ${l.level === 'error' ? 'text-red-400 bg-red-500/5 px-2 py-0.5 rounded' : l.level === 'system' ? 'text-blue-400' : 'text-gray-500'}`}>
                                    <span className="opacity-20 shrink-0">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                                    <span className="break-all">{l.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
