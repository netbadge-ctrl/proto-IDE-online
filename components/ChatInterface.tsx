
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Send, Bot, User, Settings2, FolderTree, X, Loader2, AlertCircle, ChevronRight, Info } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import PropertyEditor from './PropertyEditor';

interface ChatInterfaceProps {
  onMinimize?: () => void;
}

export default function ChatInterface({ onMinimize }: ChatInterfaceProps) {
    const { state, dispatch, getCurrentPage, getCurrentProject, getCurrentVersion, selectedElement } = useApp();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'chat'|'prop'>('chat');
    const [attached, setAttached] = useState<string[]>([]);
    
    const page = getCurrentPage();
    const version = getCurrentVersion();
    const endRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const SYSTEM_INSTRUCTION_GENERATOR = `你是一位世界顶级的 React 前端专家。
当前环境：React 18, Tailwind CSS, Remix Icon (ri-)。
代码准则：
1. 必须导出默认组件: export default function App() { ... }
2. UI 文本必须使用简体中文。
3. 确保包含完整的 Tailwind 布局，不要出现白屏或空标签。
4. 所有交互状态(useState)必须有合理的初始值。
5. 仅输出 JSON：{"files": [{"name": "App.tsx", "content": "...", "language": "typescript"}], "entryPoint": "App.tsx", "message": "简要描述"}`;

    useEffect(() => { if (selectedElement) { setTab('prop'); } }, [selectedElement]);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [page?.messages.length, loading]);

    const callAI = async (promptText: string, imageParts: any[] = []) => {
        const { externalModelConfig, selectedModel } = state;
        
        try {
            if (externalModelConfig.enabled && externalModelConfig.baseUrl) {
                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        baseUrl: externalModelConfig.baseUrl,
                        apiKey: externalModelConfig.apiKey,
                        model: externalModelConfig.modelId,
                        messages: [
                            { role: 'system', content: SYSTEM_INSTRUCTION_GENERATOR },
                            { role: 'user', content: promptText }
                        ],
                        response_format: { type: "json_object" }
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    console.error('[AI] Error response:', response.status, errData);
                    throw new Error(errData.error || `API 请求失败: ${response.status}`);
                }
                const data = await response.json();
                return data.choices[0].message.content;
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const res = await ai.models.generateContent({
                model: selectedModel,
                contents: [{ role: 'user', parts: [
                    { text: promptText },
                    ...imageParts.map(img => ({ inlineData: { mimeType: img.mime, data: img.data } }))
                ]}],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION_GENERATOR,
                    responseMimeType: "application/json"
                }
            });
            return res.text;
        } catch (e: any) {
            if (e.message?.includes('RESOURCE_EXHAUSTED')) {
                throw new Error('API 配额已耗尽。请在"用户设置"中切换至外部模型或稍后再试。');
            }
            throw e;
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && attached.length === 0) || !page) return;
        const promptText = input;
        const images = attached.map(img => ({ mime: img.split(';')[0].split(':')[1], data: img.split(',')[1] }));
        const attachedPreviews = [...attached];
        setInput(''); setAttached([]);
        
        dispatch({ type: 'ADD_MESSAGE', payload: { pageId: page.id, message: { id: Date.now().toString(), role: 'user', content: promptText, attachments: attachedPreviews, timestamp: Date.now() } } });
        setLoading(true);

        try {
            const mainFile = version?.files.find(f => f.name.endsWith('.tsx')) || version?.files[0];
            const contextCode = mainFile?.content ? `当前代码：\n${mainFile.content}\n\n` : '';
            const fullPrompt = `${contextCode}用户需求：${promptText}\n请根据以上信息更新或生成代码。`;
            
            let aiResult = await callAI(fullPrompt, images);
            aiResult = aiResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
            const currentData = JSON.parse(aiResult);
            
            const vid = Math.random().toString(36).substr(2, 9);
            const savedVersion = await dbActions.addVersion(page.id, {
                id: vid,
                files: currentData.files,
                entryPoint: currentData.entryPoint,
                prompt: promptText,
                description: 'AI Generated',
                author: 'AI',
                messageId: undefined
            });
            const actualVid = savedVersion ? savedVersion.version_id : vid;
            dispatch({ type: 'ADD_MESSAGE', payload: { pageId: page.id, message: { id: Date.now().toString(), role: 'ai', content: currentData.message, timestamp: Date.now(), relatedVersionId: actualVid } } });
        } catch (e: any) {
            dispatch({ type: 'ADD_MESSAGE', payload: { pageId: page.id, message: { id: Date.now().toString(), role: 'ai', content: `[错误] ${e.message}`, timestamp: Date.now() } } });
        } finally { setLoading(false); }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { if (ev.target?.result) setAttached(prev => [...prev, ev.target!.result as string]); };
                    reader.readAsDataURL(blob as Blob);
                }
            }
        }
    };

    if (!page) return null;

    return (
        <div className="flex flex-col h-full bg-ide-panel/30 overflow-hidden">
            <div className="flex bg-ide-sidebar/50 border-b border-ide-border p-2 shrink-0">
                <button onClick={() => setTab('chat')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${tab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>对话</button>
                <button onClick={() => setTab('prop')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${tab === 'prop' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>属性</button>
                <button onClick={onMinimize} className="p-1.5 text-gray-500 hover:text-white ml-1 transition-all"><ChevronRight size={18}/></button>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {tab === 'chat' ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar pb-32">
                            {page.messages.map(m => (
                                <div key={m.id} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`flex gap-3 max-w-[95%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-md ${m.role === 'ai' ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                            {m.role === 'ai' ? <Bot size={14} className="text-white"/> : <User size={14} className="text-white"/>}
                                        </div>
                                        <div className="flex flex-col gap-1.5 overflow-hidden">
                                            {m.attachments?.map((img, i) => <img key={i} src={img} className="max-w-[200px] h-auto rounded-lg border border-white/10" alt=""/>)}
                                            <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed break-words shadow-sm ${m.role === 'ai' ? (m.content.includes('[错误]') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-ide-hover text-gray-200 border border-ide-border') : 'bg-blue-600 text-white'}`}>
                                                {m.content}
                                            </div>
                                            {m.relatedVersionId && (
                                                <button onClick={() => dispatch({ type: 'ROLLBACK_VERSION', payload: { pageId: page.id, versionId: m.relatedVersionId! } })} className="flex items-center gap-2 text-[10px] text-blue-400/80 hover:text-blue-400 transition-colors mt-1 font-bold">
                                                    <FolderTree size={12}/> 预览此快照
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="ml-10 flex items-center gap-2 text-[10px] text-blue-400 font-bold animate-pulse">
                                    <Loader2 size={12} className="animate-spin"/> AI 正在构建高保真原型...
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>
                        
                        <div className="p-4 border-t border-ide-border bg-ide-panel/80 backdrop-blur-md">
                            <div className="relative bg-ide-bg rounded-xl border border-ide-border focus-within:border-blue-500 transition-all overflow-hidden shadow-inner group">
                                <textarea 
                                    ref={textareaRef}
                                    value={input} onChange={e=>setInput(e.target.value)} 
                                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),handleSend())} 
                                    onPaste={handlePaste}
                                    placeholder="描述您的需求（支持粘贴设计图）..." 
                                    className="w-full bg-transparent p-3 pr-10 text-xs text-white focus:outline-none resize-none h-20 placeholder:text-gray-600" 
                                />
                                <div className="absolute bottom-2 right-2">
                                    <button onClick={handleSend} disabled={loading||(!input.trim()&&attached.length===0)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 active:scale-95 transition-all shadow-lg flex items-center justify-center"><Send size={14}/></button>
                                </div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Info size={12} className="text-gray-600" title="Shift + Enter 换行"/>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full bg-ide-panel/50 overflow-y-auto custom-scrollbar">
                        {selectedElement ? <PropertyEditor /> : (
                            <div className="h-full flex flex-col items-center justify-center p-8 opacity-30 text-center">
                                <Settings2 size={32} className="mb-3 text-gray-400"/>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">进入选择模式以编辑组件属性</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
