
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Share2, Plus, FileCode, ChevronDown, X, Monitor, Smartphone, Trash2, Edit3, LayoutGrid, Github, AlertTriangle, Sparkles, Zap, Menu, PanelRight, PanelRightClose } from 'lucide-react';
import SettingsModal from './SettingsModal';
import GitHubSyncModal from './GitHubSyncModal';

// --- Reusable Generic Modal ---
const ActionDialog = ({ isOpen, onClose, onConfirm, title, message, initialValue, isDelete, existingNames = [], confirmText = "确认" }: any) => {
    const [value, setValue] = useState(initialValue || '');
    const [submitting, setSubmitting] = useState(false);
    
    React.useEffect(() => { 
        if(isOpen) {
            setValue(initialValue || '');
            setSubmitting(false);
        }
    }, [initialValue, isOpen]);

    const error = useMemo(() => {
        if (isDelete) return null;
        const val = value.trim().toLowerCase();
        if (!val) return null;
        if (existingNames.some((n: string) => n.toLowerCase() === val)) {
            return "该名称已存在，请换一个";
        }
        return null;
    }, [value, existingNames, isDelete]);
    
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (error) return;
        setSubmitting(true);
        onConfirm(value);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-ide-panel border ${isDelete ? 'border-red-500/30' : (error ? 'border-red-500/50' : 'border-ide-border')} w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200`}>
                <div className="p-6 text-center">
                    {isDelete && <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24}/></div>}
                    <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                    {message && <p className="text-gray-400 text-sm mb-4 leading-relaxed">{message}</p>}
                    {!isDelete && (
                        <div className="mb-4 relative">
                            <input 
                                value={value} 
                                onChange={(e) => setValue(e.target.value)} 
                                className={`w-full bg-ide-bg border rounded-xl px-4 py-3 text-white focus:outline-none transition-all ${error ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' : 'border-ide-border focus:border-blue-500'}`}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                            />
                            {error && (
                                <p className="absolute left-0 -bottom-5 text-[10px] text-red-500 font-medium animate-in slide-in-from-top-1">
                                    {error}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-2 pt-2">
                        <button 
                            onClick={handleConfirm} 
                            disabled={submitting || (!isDelete && (!value.trim() || !!error))}
                            className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${isDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed'}`}
                        >
                            {submitting && <Zap size={14} className="animate-pulse" />}
                            {confirmText}
                        </button>
                        <button onClick={onClose} className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm font-medium">取消</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Selectors ---
const ModelSelector = ({ currentModel, onSelect }: { currentModel: string, onSelect: (m: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const models = [
        { id: 'glm-4.7', name: 'GLM-4.7', desc: '金山云高性能模型', icon: <Sparkles size={14} className="text-purple-400" /> },
        { id: 'glm-5', name: 'GLM-5', desc: '金山云最新旗舰模型', icon: <Zap size={14} className="text-blue-400" /> },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: '能力最强', icon: <Sparkles size={14} className="text-purple-400" /> },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: '响应极快', icon: <Zap size={14} className="text-yellow-400" /> },
    ];
    const selected = models.find(m => m.id === currentModel) || models[0];

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 bg-ide-hover hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold border border-ide-border transition-all">
                {selected.icon} <span className="max-w-[100px] truncate text-[11px] hidden sm:inline">{selected.name}</span> <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 w-56 bg-ide-panel border border-ide-border rounded-xl shadow-2xl z-[110] overflow-hidden py-1">
                        {models.map(m => (
                            <div key={m.id} onClick={() => { onSelect(m.id); setIsOpen(false); }} className={`flex items-center gap-3 px-4 py-3 hover:bg-ide-hover cursor-pointer ${m.id === currentModel ? 'bg-blue-600/10' : ''}`}>
                                <div className="p-1.5 rounded-lg bg-ide-bg border border-ide-border">{m.icon}</div>
                                <div className="flex flex-col"><span className={`text-sm font-bold ${m.id === currentModel ? 'text-blue-400' : 'text-gray-300'}`}>{m.name}</span><span className="text-[10px] text-gray-500">{m.desc}</span></div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

interface TopBarProps {
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

export default function TopBar({ chatOpen, onToggleChat }: TopBarProps) {
    const { state, dispatch, getCurrentProject } = useApp();
    const currentProject = getCurrentProject();
    
    const [modals, setModals] = useState({ settings: false, github: false, createProj: false, createPage: false });
    const [crud, setCrud] = useState<{ type: string | null, id: string, name: string }>({ type: null, id: '', name: '' });

    const toggle = (key: keyof typeof modals) => setModals(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <>
            <div className="h-14 bg-ide-sidebar border-b border-ide-border flex items-center justify-between px-4 sm:px-6 shrink-0 z-[60] select-none relative shadow-sm">
                <div className="flex items-center gap-4 sm:gap-8">
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 group">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-lg shadow-blue-500/20 group-hover:rotate-12 transition-all">AI</div>
                        <div className="flex flex-col"><span className="font-bold text-sm text-white leading-none tracking-tight">ProtoIDE</span><span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1 opacity-80">Studio</span></div>
                    </div>

                    <div className="h-6 w-px bg-ide-border/60"></div>
                    
                    {/* Selectors */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative group/sel">
                            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ide-hover transition-all">
                                <LayoutGrid size={16} className="text-gray-500 shrink-0" />
                                <div className="flex flex-col text-left"><span className="text-[8px] text-gray-500 font-bold uppercase hidden sm:block">项目</span><span className="text-xs sm:text-sm font-semibold text-gray-200 max-w-[100px] sm:max-w-[150px] truncate">{currentProject.name}</span></div>
                                <ChevronDown size={12} className="text-gray-600 shrink-0" />
                            </button>
                        </div>
                        <div className="relative group/sel">
                            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ide-hover transition-all">
                                <FileCode size={16} className="text-blue-500 shrink-0" />
                                <div className="flex flex-col text-left"><span className="text-[8px] text-gray-500 font-bold uppercase hidden sm:block">页面</span><span className="text-xs sm:text-sm font-semibold text-gray-200 max-w-[100px] sm:max-w-[150px] truncate">{currentProject.pages.find(pg => pg.id === currentProject.activePageId)?.name}</span></div>
                                <ChevronDown size={12} className="text-gray-600 shrink-0" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <ModelSelector currentModel={state.selectedModel} onSelect={(m) => dispatch({ type: 'SET_MODEL', payload: m })} />
                    
                    <button 
                      onClick={onToggleChat} 
                      className={`p-2 sm:px-3 sm:py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 ${chatOpen ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10' : 'bg-ide-hover border-ide-border text-gray-400 hover:text-white'}`}
                      title={chatOpen ? "隐藏对话栏" : "显示对话栏"}
                    >
                        {chatOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
                        <span className="hidden sm:inline">{chatOpen ? "收起" : "对话"}</span>
                    </button>

                    <button 
                        onClick={() => toggle('github')} 
                        className="p-2 sm:px-3 sm:py-2 bg-ide-hover hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold border border-ide-border transition-all flex items-center gap-2"
                        title="同步到 GitHub"
                    >
                        <Github size={16} />
                        <span className="hidden sm:inline">同步</span>
                    </button>
                    
                    <button onClick={() => toggle('settings')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg active:scale-90 transition-transform">U</button>
                </div>
            </div>

            <SettingsModal isOpen={modals.settings} onClose={() => toggle('settings')} />
            <GitHubSyncModal isOpen={modals.github} onClose={() => toggle('github')} />
            
            <ActionDialog 
                isOpen={modals.createProj} 
                onClose={() => toggle('createProj')} 
                onConfirm={(v: string) => { 
                    if(v) dispatch({ type: 'CREATE_PROJECT', payload: { name: v, type: 'PC' } }); 
                    setModals(m => ({...m, createProj: false})); 
                }} 
                title="新建项目" 
                initialValue="我的新项目" 
                existingNames={state.projects.map(p => p.name)}
            />
            
            <ActionDialog 
                isOpen={modals.createPage} 
                onClose={() => toggle('createPage')} 
                onConfirm={(v: string) => { 
                    if(v) dispatch({ type: 'ADD_PAGE', payload: v }); 
                    setModals(m => ({...m, createPage: false})); 
                }} 
                title="新建页面" 
                initialValue="新页面" 
                existingNames={currentProject.pages.map(pg => pg.name)}
            />
        </>
    );
}
