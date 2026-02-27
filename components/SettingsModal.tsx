
import React, { useState, useEffect } from 'react';
import { X, User, Moon, Globe, LogOut, Github, Sparkles, Zap, ShieldCheck, KeyRound, Loader2, CheckCircle2, Server, Key, BrainCircuit } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'model' | 'github'>('profile');
  const [ghToken, setGhToken] = useState(state.githubConfig.token);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // 外部模型局部状态
  const [extEnabled, setExtEnabled] = useState(state.externalModelConfig.enabled);
  const [extBaseUrl, setExtBaseUrl] = useState(state.externalModelConfig.baseUrl);
  const [extApiKey, setExtApiKey] = useState(state.externalModelConfig.apiKey);
  const [extModelId, setExtModelId] = useState(state.externalModelConfig.modelId);

  useEffect(() => {
    setGhToken(state.githubConfig.token);
    setExtEnabled(state.externalModelConfig.enabled);
    setExtBaseUrl(state.externalModelConfig.baseUrl);
    setExtApiKey(state.externalModelConfig.apiKey);
    setExtModelId(state.externalModelConfig.modelId);
  }, [state.githubConfig.token, state.externalModelConfig, isOpen]);

  if (!isOpen) return null;

  const handleVerifyGh = async () => {
    if (!ghToken.trim()) return;
    setIsVerifying(true);
    try {
        const res = await fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${ghToken}` } });
        if (res.ok) {
            const user = await res.json();
            dispatch({ type: 'UPDATE_GITHUB_CONFIG', payload: { token: ghToken, user } });
        } else { alert('Token 验证失败'); }
    } catch (e) { alert('验证出错'); } finally { setIsVerifying(false); }
  };

  const handleSaveExternalConfig = () => {
    dispatch({
        type: 'UPDATE_EXTERNAL_MODEL_CONFIG',
        payload: {
            enabled: extEnabled,
            baseUrl: extBaseUrl,
            apiKey: extApiKey,
            modelId: extModelId
        }
    });
    alert('自定义模型配置已保存');
  };

  const internalModels = [
    { id: 'glm-4.7', name: 'GLM-4.7', desc: '金山云高性能模型' },
    { id: 'glm-5', name: 'GLM-5', desc: '金山云最新旗舰模型' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: '内置核心模型' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: '内置极速模型' },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-ide-panel border border-ide-border rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row h-[550px] animate-in zoom-in duration-200">
        
        {/* Sidebar Nav */}
        <div className="w-full sm:w-56 bg-ide-sidebar border-b sm:border-b-0 sm:border-r border-ide-border flex flex-row sm:flex-col p-3 gap-1 shrink-0">
          <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-ide-hover'}`}>
            <User size={18}/> 个人账户
          </button>
          <button onClick={() => setActiveTab('model')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'model' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-ide-hover'}`}>
            <BrainCircuit size={18}/> 模型配置
          </button>
          <button onClick={() => setActiveTab('github')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'github' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-ide-hover'}`}>
            <Github size={18}/> GitHub 同步
          </button>
          <div className="flex-1"></div>
          <button className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium">
            <LogOut size={18}/> 退出登录
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-ide-bg/30 relative">
          <div className="flex items-center justify-between px-6 py-4 border-b border-ide-border">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {activeTab === 'profile' && '用户信息'}
                {activeTab === 'model' && '模型与端点设置'}
                {activeTab === 'github' && '代码同步配置'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-ide-hover transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-xl">U</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">架构师 Demo</h3>
                    <p className="text-gray-500 text-sm">Professional Developer</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="p-4 bg-ide-hover/30 rounded-xl border border-ide-border flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-gray-300"><Moon size={18}/> 深色模式</div>
                    <div className="w-10 h-5 bg-blue-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'model' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">内置模型选择</label>
                  <div className="grid gap-2">
                    {internalModels.map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => { setExtEnabled(false); dispatch({ type: 'SET_MODEL', payload: m.id }); }}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${!extEnabled && state.selectedModel === m.id ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/5' : 'bg-ide-hover/30 border-ide-border'}`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${!extEnabled && state.selectedModel === m.id ? 'text-blue-400' : 'text-white'}`}>{m.name}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{m.desc}</p>
                        </div>
                        {!extEnabled && state.selectedModel === m.id && <CheckCircle2 size={18} className="text-blue-500"/>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-ide-hover/30 border border-ide-border rounded-2xl space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                            <Server size={18} className="text-purple-400"/>
                            <h4 className="font-bold text-sm">自定义/外部模型 (OpenAI 兼容)</h4>
                        </div>
                        <button 
                            onClick={() => setExtEnabled(!extEnabled)}
                            className={`w-12 h-6 rounded-full relative transition-colors ${extEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${extEnabled ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    {extEnabled && (
                        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">API 端点 (Base URL)</label>
                                <input 
                                    value={extBaseUrl} onChange={(e) => setExtBaseUrl(e.target.value)}
                                    placeholder="https://api.openai.com/v1" 
                                    className="w-full bg-ide-bg border border-ide-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">API Key</label>
                                <div className="relative">
                                    <Key size={14} className="absolute left-4 top-3 text-gray-500"/>
                                    <input 
                                        type="password" value={extApiKey} onChange={(e) => setExtApiKey(e.target.value)}
                                        placeholder="sk-..." 
                                        className="w-full bg-ide-bg border border-ide-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">模型名称 (Model ID)</label>
                                <input 
                                    value={extModelId} onChange={(e) => setExtModelId(e.target.value)}
                                    placeholder="gpt-4o / claude-3-opus" 
                                    className="w-full bg-ide-bg border border-ide-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                            <button 
                                onClick={handleSaveExternalConfig}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                            >保存并应用外部模型</button>
                        </div>
                    )}
                </div>
              </div>
            )}

            {activeTab === 'github' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2">
                {state.githubConfig.user ? (
                   <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
                      <div className="relative">
                        <img src={state.githubConfig.user.avatar_url} className="w-20 h-20 rounded-full border-4 border-ide-bg shadow-xl" alt=""/>
                        <div className="absolute -bottom-1 -right-1 bg-ide-bg p-1 rounded-full"><Github size={20} className="text-white"/></div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{state.githubConfig.user.name || state.githubConfig.user.login}</h3>
                        <p className="text-gray-500 text-xs font-mono">@{state.githubConfig.user.login}</p>
                      </div>
                      <button onClick={() => dispatch({ type: 'UPDATE_GITHUB_CONFIG', payload: { token: '', user: null } })} className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold border border-red-500/20 hover:bg-red-500/20 transition-all">断开 GitHub 链接</button>
                   </div>
                ) : (
                  <div className="bg-ide-hover/50 p-6 rounded-2xl border border-ide-border space-y-4">
                       <div className="flex items-center gap-3 text-white">
                          <KeyRound size={20} className="text-blue-400"/>
                          <h4 className="font-bold text-sm">连接 GitHub</h4>
                       </div>
                       <p className="text-xs text-gray-500 leading-relaxed">配置 GitHub Personal Access Token (PAT) 以便一键同步原型代码。需要 repo 权限。</p>
                       <input 
                        type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)}
                        placeholder="GitHub Access Token" 
                        className="w-full bg-ide-bg border border-ide-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                       />
                       <button 
                        onClick={handleVerifyGh} disabled={isVerifying || !ghToken.trim()}
                        className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 disabled:opacity-50 transition-all"
                       >
                         {isVerifying ? <Loader2 size={16} className="animate-spin"/> : <Github size={16}/>}
                         验证 GitHub Token
                       </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
