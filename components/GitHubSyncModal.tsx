
import React, { useState, useEffect } from 'react';
import { X, Lock, Globe, Github, Check, Loader2, KeyRound, AlertCircle, LogOut, GitCommit, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

// --- Sub-Components ---

const StepLoadingAuth = () => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 size={32} className="text-blue-600 animate-spin" />
    <p className="text-gray-500 text-sm">正在初始化...</p>
  </div>
);

const StepAuthNotice = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
  <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
        <KeyRound size={32}/>
    </div>
    <div className="space-y-2">
        <h4 className="font-bold text-lg text-gray-900">未检测到 GitHub 配置</h4>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">同步功能需要先连接您的 GitHub 账号。请前往“用户设置”中完成配置。</p>
    </div>
    <button onClick={onOpenSettings} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
        <Settings size={18}/> 前往配置 GitHub
    </button>
  </div>
);

const StepConfig = ({ user, repoName, setRepoName, repoDesc, commitMessage, setCommitMessage, visibility, setVisibility, errorMsg, onLogout, onClose, onPush }: any) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
      <div className="flex items-center gap-3">
        <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full border border-gray-200" />
        <div>
          <p className="font-bold text-sm text-gray-900">{user.name || user.login}</p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1 font-mono uppercase"><Github size={10} /> {user.login}</p>
        </div>
      </div>
      <button onClick={onLogout} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-all font-bold">切换账号</button>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2 col-span-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">目标仓库名称</label>
        <input value={repoName} onChange={(e) => setRepoName(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm" placeholder="my-new-project" />
      </div>
      <div className="space-y-2 col-span-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Git Commit Message</label>
        <div className="relative">
          <GitCommit size={16} className="absolute left-3 top-3 text-gray-400" />
          <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm" />
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">仓库可见性</label>
      <div className="flex gap-4">
        {['private', 'public'].map((v: any) => (
          <label key={v} className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${visibility === v ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => setVisibility(v)}>
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${visibility === v ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>{visibility === v && <Check size={10} className="text-white" />}</div>
            <div className="flex flex-col"><span className="font-bold text-sm text-gray-900 flex items-center gap-1">{v === 'private' ? <Lock size={12}/> : <Globe size={12}/>} {v === 'private' ? '私有' : '公开'}</span></div>
          </label>
        ))}
      </div>
    </div>
    {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={16} />{errorMsg}</div>}
    <div className="pt-2 flex justify-end gap-3">
      <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">取消</button>
      <button disabled={!repoName.trim()} onClick={onPush} className="flex-[2] flex items-center gap-2 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all disabled:opacity-50 justify-center shadow-xl shadow-gray-200"><Github size={16} /> 开始同步</button>
    </div>
  </div>
);

const StepSyncing = () => (
  <div className="flex flex-col items-center justify-center py-12 space-y-6">
    <div className="relative">
        <Loader2 size={64} className="text-blue-600 animate-spin" />
        <Github size={24} className="absolute inset-0 m-auto text-gray-900"/>
    </div>
    <div className="text-center space-y-1">
      <h4 className="font-bold text-lg text-gray-900">正在同步到 GitHub...</h4>
      <p className="text-gray-500 text-sm">正在构建文件结构并推送到您的远程仓库</p>
    </div>
  </div>
);

const StepSuccess = ({ successLink, onClose }: { successLink: string, onClose: () => void }) => (
  <div className="flex flex-col items-center justify-center py-6 space-y-6 animate-in fade-in zoom-in duration-300">
    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner"><Check size={32} /></div>
    <div className="text-center space-y-2"><h4 className="font-bold text-xl text-gray-900">同步成功！</h4><p className="text-gray-500 max-w-xs mx-auto text-sm">您的项目已在 GitHub 准备就绪。</p></div>
    <a href={successLink} target="_blank" rel="noreferrer" className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between group hover:border-blue-300 transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        <Github size={20} className="text-gray-400 group-hover:text-black transition-colors"/>
        <div className="flex flex-col text-left overflow-hidden"><span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">GitHub Repository</span><span className="text-sm font-mono font-medium text-blue-600 truncate">{successLink.replace('https://github.com/', '')}</span></div>
      </div>
      <div className="px-3 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 group-hover:text-blue-600 group-hover:border-blue-200 uppercase">查看仓库</div>
    </a>
    <div className="pt-2 w-full"><button onClick={onClose} className="w-full px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-xl shadow-gray-200">回到项目</button></div>
  </div>
);

// --- Main Component ---

function utf8_to_b64(str: string) { return window.btoa(unescape(encodeURIComponent(str))); }

export default function GitHubSyncModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { state, dispatch, getCurrentProject, getCurrentVersion } = useApp();
  const currentProject = getCurrentProject();
  const currentVersion = getCurrentVersion();

  const [step, setStep] = useState<'loading' | 'auth_notice' | 'config' | 'syncing' | 'success'>('loading');
  const [repoName, setRepoName] = useState('');
  const [repoDesc, setRepoDesc] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [commitMessage, setCommitMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successLink, setSuccessLink] = useState('');

  useEffect(() => {
    if (isOpen) {
        if (!state.githubConfig.token || !state.githubConfig.user) {
            setStep('auth_notice');
        } else {
            setRepoName(`proto-${currentProject.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 4)}`);
            setCommitMessage(`feat: update ${currentProject?.name} - ${new Date().toLocaleString()}`);
            setRepoDesc('Created with AI Prototyper IDE');
            setErrorMsg('');
            setSuccessLink('');
            setStep('config');
        }
    }
  }, [isOpen, state.githubConfig.token, state.githubConfig.user]);

  const handleCreateAndPush = async () => {
    if (!currentVersion || currentVersion.files.length === 0) return setErrorMsg('当前版本没有可提交的文件。');
    setStep('syncing'); setErrorMsg('');

    try {
        const token = state.githubConfig.token;
        const createRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: repoName, description: repoDesc, private: visibility === 'private', auto_init: true })
        });

        let targetRepoName = repoName;
        let owner = state.githubConfig.user?.login;

        if (!createRes.ok && createRes.status !== 422) throw new Error((await createRes.json()).message || '创建仓库失败');
        if (createRes.ok) { const repoData = await createRes.json(); owner = repoData.owner.login; targetRepoName = repoData.name; }

        const fullName = `${owner}/${targetRepoName}`;
        for (const file of currentVersion.files) {
            let path = file.name;
            if (file.name !== 'index.html' && !file.name.includes('/')) path = `src/${file.name}`;
            let sha = undefined;
            try {
                const checkRes = await fetch(`https://api.github.com/repos/${fullName}/contents/${path}`, { headers: { 'Authorization': `token ${token}` } });
                if (checkRes.ok) sha = (await checkRes.json()).sha;
            } catch (e) {}
            await fetch(`https://api.github.com/repos/${fullName}/contents/${path}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: commitMessage || `Update ${file.name}`, content: utf8_to_b64(file.content), sha: sha, branch: 'main' })
            });
        }
        setSuccessLink(`https://github.com/${fullName}`); setStep('success');
    } catch (err: any) { setErrorMsg(err.message); setStep('config'); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
      <div className="w-full max-w-[500px] bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/30 shrink-0">
          <div className="flex items-center gap-2"><Github size={20} className="text-gray-900"/><h3 className="font-bold text-lg tracking-tight">推送至 GitHub</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-all text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {step === 'loading' && <StepLoadingAuth />}
          {step === 'auth_notice' && <StepAuthNotice onOpenSettings={() => { onClose(); /* Logic to open settings could be here but normally handled by Layout/TopBar */ }} />}
          {step === 'config' && state.githubConfig.user && <StepConfig user={state.githubConfig.user} repoName={repoName} setRepoName={setRepoName} repoDesc={repoDesc} commitMessage={commitMessage} setCommitMessage={setCommitMessage} visibility={visibility} setVisibility={setVisibility} errorMsg={errorMsg} onLogout={() => { dispatch({ type: 'UPDATE_GITHUB_CONFIG', payload: { token: '', user: null } }); }} onClose={onClose} onPush={handleCreateAndPush} />}
          {step === 'syncing' && <StepSyncing />}
          {step === 'success' && <StepSuccess successLink={successLink} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
