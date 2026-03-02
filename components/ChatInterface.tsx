import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Send, Bot, User, Settings2, FolderTree, X, Loader2, AlertCircle, ChevronRight, Info } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import PropertyEditor from './PropertyEditor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
    onMinimize?: () => void;
}

export default function ChatInterface({ onMinimize }: ChatInterfaceProps) {
    const { state, dispatch, getCurrentPage, getCurrentProject, getCurrentVersion, selectedElement, dbActions } = useApp();
    const [input, setInput] = useState('');
    const [generationStatus, setGenerationStatus] = useState<'idle' | 'planning' | 'coding' | 'fixing'>('idle');
    const [tab, setTab] = useState<'chat' | 'prop'>('chat');
    const [attached, setAttached] = useState<string[]>([]);

    const page = getCurrentPage();
    const version = getCurrentVersion();
    const endRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sendingRef = useRef(false); // 防重入锁，避免重复提交
    const autoFixAttemptedRef = useRef<Set<number>>(new Set());

    const SYSTEM_INSTRUCTION_PLANNER = `你是一位顶尖的前端架构师和 B 端(SaaS)交互设计师。
你的任务是根据用户的需求和提供的 UI/UX Design System，为企业级 / B 端前端应用提供详细的架构拆解和实现规划。
请用 Markdown 格式输出：
1. 核心需求理解 (必须侧重于 B 端管理后台：高信息密度、严谨的表单/表格、权限及业务流程)
2. 状态与数据流规划
3. 组件树结构拆分 (侧重侧边栏、顶部导航、数据看板、表格卡片等 B 端常用组件)
4. 视觉指南 (如何严格体现 Design System，确保专业、中性、高效的企业级视觉调性，不要 C 端消费级的花哨效果)
请专业、清晰、只做架构规划，不要输出完整的 React 代码。`;

    const SYSTEM_INSTRUCTION_EXECUTOR = `你是一位世界顶级的 React 前端专家，专精于 B 端企业管理后台与 SaaS 系统开发。
当前环境：React 18, Tailwind CSS, Remix Icon (ri-)。
代码准则：
1. 必须导出默认组件: export default function App() { ... }
2. UI 文本必须使用简体中文。
3. 确保包含完整的 Tailwind 布局，不要出现白屏或空标签。整个系统应呈现典型的 B 端控制台(Dashboard) / 管理后台(Admin) 的布局范式。
4. 所有交互状态(useState)必须有合理的初始值。
5. 你必须严格参照上一轮规划阶段产生的《架构规划 (Implementation Plan)》进行开发。
6. 视觉呈现上，请大量使用 B 端专业设计语言：紧凑的留白、清晰的数据对齐、克制的颜色、专业的表格和表单排版。
7. 仅输出 JSON：{"files": [{"name": "App.tsx", "content": "...", "language": "typescript"}], "entryPoint": "App.tsx", "message": "简要描述"}`;

    useEffect(() => { if (selectedElement) { setTab('prop'); } }, [selectedElement]);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [page?.messages.length, generationStatus]);

    // Phase 7: Auto-Fixing Preview Errors
    useEffect(() => {
        if (!page || generationStatus !== 'idle') return;

        // 查找最新的 error 日志
        const lastErrorLog = state.logs.slice().reverse().find(l => l.level === 'error');
        if (!lastErrorLog) return;

        // 检查这个报错是否已经被尝试修复过（通过时间戳记录，防无限死循环重试）
        if (autoFixAttemptedRef.current.has(lastErrorLog.timestamp)) return;

        // 标记此报错进入处理
        autoFixAttemptedRef.current.add(lastErrorLog.timestamp);

        const triggerAutoFix = async () => {
            if (sendingRef.current) return;
            sendingRef.current = true;
            setGenerationStatus('fixing');

            try {
                const errMsg = `🚨 **系统拦截到运行时异常**：\n\`\`\`text\n${lastErrorLog.message}\n\`\`\`\n⚠️ *自我校验触发，AI 正在作为后台工程师火速修复中...*`;
                await dbActions.addMessage(page.id, 'ai', errMsg);

                const mainFile = version?.files.find(f => f.name.endsWith('.tsx')) || version?.files[0];
                const contextCode = mainFile?.content ? `目前出错界面的完整源码：\n${mainFile.content}\n\n` : '';

                const fixPrompt = `${contextCode}我们在预览画布中捕获到了上述页面的运行时抛错：\n${lastErrorLog.message}\n\n请作为高级前端专家，分析错误根源并输出修复完成后的最新完整版代码。你在输出 JSON 响应前不需要重做业务规划，仅聚焦于修复此 BUG。`;

                let aiResult = await callAI(fixPrompt, [], SYSTEM_INSTRUCTION_EXECUTOR, true);
                aiResult = aiResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
                const currentData = JSON.parse(aiResult);

                const vid = Math.random().toString(36).substr(2, 9);
                const savedVersion = await dbActions.addVersion(page.id, {
                    id: vid,
                    files: currentData.files,
                    entryPoint: currentData.entryPoint,
                    prompt: 'Auto Fix Error',
                    description: 'Auto Fix Generated',
                    author: 'AI',
                    messageId: undefined
                });
                const actualVid = savedVersion ? savedVersion.version_id : vid;

                await dbActions.addMessage(page.id, 'ai', `✅ **极速热修推送完毕**：${currentData.message}`, actualVid);
            } catch (e: any) {
                await dbActions.addMessage(page.id, 'ai', `[自动修复终端失败] ${e.message}`);
            } finally {
                setGenerationStatus('idle');
                sendingRef.current = false;
            }
        };

        triggerAutoFix();
    }, [state.logs, page, generationStatus, version, dbActions]);

    // Local Component for Collapsible Plan
    const CollapsiblePlan = ({ content }: { content: string }) => {
        const [isOpen, setIsOpen] = useState(false);
        // 去除开头我们自己加的前缀文本标记
        const cleanContent = content.replace('** [AI 前端架构师已定稿蓝图，正在转交研发执行代码...] **\n\n', '');
        return (
            <div className="flex flex-col gap-2 w-full">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex justify-between items-center w-full px-3 py-2 bg-ide-bg/80 hover:bg-ide-bg border border-ide-border rounded-lg text-sm text-gray-300 font-medium transition-colors cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <FolderTree size={14} className="text-blue-400" />
                        AI 前端架构师已定稿蓝图 (Implementation Plan)
                    </span>
                    <span className="text-xs text-gray-500">{isOpen ? '收起' : '点击展开查看'}</span>
                </button>
                {isOpen && (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-ide-bg prose-pre:border prose-pre:border-ide-border overflow-hidden break-words p-3 bg-ide-bg/30 border border-ide-border/50 rounded-lg mt-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {cleanContent}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        );
    };

    const callAI = async (promptText: string, imageParts: any[] = [], systemInstruction: string, requireJson: boolean) => {
        const { externalModelConfig, selectedModel } = state;

        try {
            if (externalModelConfig.enabled && externalModelConfig.baseUrl) {
                // 构建用户消息: 有图片时使用多模态数组格式，否则使用纯文本格式
                const userContent = imageParts.length > 0
                    ? [
                        { type: 'text', text: promptText },
                        ...imageParts.map(img => ({
                            type: 'image_url',
                            image_url: { url: `data:${img.mime};base64,${img.data}` }
                        }))
                    ]
                    : promptText;

                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        baseUrl: externalModelConfig.baseUrl,
                        apiKey: externalModelConfig.apiKey, // 若为空则服务端会降级到环境变量
                        model: externalModelConfig.modelId,
                        messages: [
                            { role: 'system', content: systemInstruction },
                            { role: 'user', content: userContent }
                        ],
                        ...(requireJson ? { response_format: { type: "json_object" } } : {})
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
                contents: [{
                    role: 'user', parts: [
                        { text: promptText },
                        ...imageParts.map(img => ({ inlineData: { mimeType: img.mime, data: img.data } }))
                    ]
                }],
                config: {
                    systemInstruction: systemInstruction,
                    ...(requireJson ? { responseMimeType: "application/json" } : {})
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
        if (generationStatus !== 'idle' || sendingRef.current) return; // 防止重复提交
        sendingRef.current = true;
        const promptText = input;
        const images = attached.map(img => ({ mime: img.split(';')[0].split(':')[1], data: img.split(',')[1] }));
        const attachedPreviews = [...attached];
        setInput(''); setAttached([]);

        // 1. 发起请求并展示本地“加载中”状态
        setGenerationStatus('planning');

        try {
            // 2. 将用户消息落库，触发其响应状态树刷新
            await dbActions.addMessage(page.id, 'user', promptText || '[图片附件]');

            let designSystemText = '';
            try {
                // 请求设计系统
                const dsRes = await fetch('/api/design-system', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptText })
                });
                if (dsRes.ok) {
                    const dsData = await dsRes.json();
                    designSystemText = dsData.designSystem || '';
                }
            } catch (e) {
                console.warn('[Design System] Fetch error:', e);
            }

            const mainFile = version?.files.find(f => f.name.endsWith('.tsx')) || version?.files[0];
            const contextCode = mainFile?.content ? `当前代码：\n${mainFile.content}\n\n` : '';

            // 将分析出的 Design System 追加到上下文中，强烈要求 AI 必须遵守
            const designSystemContext = designSystemText ? `\n\n=== 必须严格遵守的 UI/UX 设计系统规则 ===\n${designSystemText}\n========================\n\n` : '';

            // --- 第一阶段：架构规划 (Planning) ---
            const planPrompt = `${contextCode}${designSystemContext}用户需求：${promptText}\n请根据以上信息输出明确的 Implementation Plan 架构规划。`;
            let planResult = '';
            try {
                planResult = await callAI(planPrompt, images, SYSTEM_INSTRUCTION_PLANNER, false);
            } catch (err: any) {
                const planErr = `[构建失败] AI 架构师在规划阶段遇到错误: ${err.message}`;
                await dbActions.addMessage(page.id, 'ai', planErr);
                setGenerationStatus('idle');
                sendingRef.current = false;
                return; // 直接打断后续流程
            }

            // 将第一阶段的结果先渲染给用户（增加思考透明度）
            await dbActions.addMessage(page.id, 'ai', `** [AI 前端架构师已定稿蓝图，正在转交研发执行代码...] **\n\n${planResult} `);

            // --- 第二阶段：代码执行 (Execution) ---
            setGenerationStatus('coding');
            const fullPrompt = `${contextCode}${designSystemContext} \n\n === 架构规划(Implementation Plan) ===\n${planResult} \n ========================\n\n原始用户需求：${promptText} \n请严格遵守以上架构规划和设计系统，生成最终的高保真 JSON 代码产物。`;

            let aiResult = await callAI(fullPrompt, images, SYSTEM_INSTRUCTION_EXECUTOR, true);
            aiResult = aiResult.replace(/^```(?: json) ?\s * /i, '').replace(/\s * ```\s*$/i, '').trim();
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

            // 3. AI 回复存入库中，UI 通过上下文刷新
            await dbActions.addMessage(page.id, 'ai', currentData.message, actualVid);
        } catch (e: any) {
            const errMsg = `[错误] ${e.message} `;
            // 错误消息也入库保留记录并自动触发页面重新渲染
            await dbActions.addMessage(page.id, 'ai', errMsg);
        } finally {
            setGenerationStatus('idle');
            sendingRef.current = false;
        }
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
                <button onClick={() => setTab('chat')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${tab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'} `}>对话</button>
                <button onClick={() => setTab('prop')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${tab === 'prop' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'} `}>属性</button>
                <button onClick={onMinimize} className="p-1.5 text-gray-500 hover:text-white ml-1 transition-all"><ChevronRight size={18} /></button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {tab === 'chat' ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar pb-32">
                            {page.messages.map(m => (
                                <div key={m.id} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`flex gap-3 max-w-[95%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-md ${m.role === 'ai' ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                            {m.role === 'ai' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
                                        </div>
                                        <div className="flex flex-col gap-1.5 overflow-hidden">
                                            {m.attachments?.map((img, i) => <img key={i} src={img} className="max-w-[200px] h-auto rounded-lg border border-white/10" alt="" />)}
                                            <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'ai' ? (m.content.includes('[错误]') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : (m.content.startsWith('** [AI 前端架构师已定稿蓝图') ? 'bg-transparent px-0 py-0 shadow-none' : 'bg-ide-hover border border-ide-border')) : 'bg-blue-600 text-white'}`}>
                                                {m.role === 'ai' && !m.content.includes('[错误]') ? (
                                                    m.content.startsWith('** [AI 前端架构师已定稿蓝图') ? (
                                                        <CollapsiblePlan content={m.content} />
                                                    ) : (
                                                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-ide-bg prose-pre:border prose-pre:border-ide-border overflow-hidden break-words">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {m.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="whitespace-pre-wrap break-words">{m.content}</span>
                                                )}
                                            </div>
                                            {m.relatedVersionId && (
                                                <button onClick={() => dispatch({ type: 'ROLLBACK_VERSION', payload: { pageId: page.id, versionId: m.relatedVersionId! } })} className="flex items-center gap-2 text-[10px] text-blue-400/80 hover:text-blue-400 transition-colors mt-1 font-bold">
                                                    <FolderTree size={12} /> 预览此快照
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {generationStatus !== 'idle' && (
                                <div className="ml-10 flex items-center gap-2 text-[10px] text-blue-400 font-bold animate-pulse">
                                    <Loader2 size={12} className="animate-spin" /> {generationStatus === 'planning' ? 'AI 正在构思架构蓝图...' : generationStatus === 'fixing' ? '⚠️ 系统检测到代码异常，AI 前端开发兵正在紧急抢修...' : 'AI 正在构建高保真原型...'}
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>

                        <div className="p-4 border-t border-ide-border bg-ide-panel/80 backdrop-blur-md">
                            <div className="relative bg-ide-bg rounded-xl border border-ide-border focus-within:border-blue-500 transition-all overflow-hidden shadow-inner group">
                                <textarea
                                    ref={textareaRef}
                                    value={input} onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    onPaste={handlePaste}
                                    placeholder="描述您的需求（支持粘贴设计图）..."
                                    className="w-full bg-transparent p-3 pr-10 text-xs text-white focus:outline-none resize-none h-20 placeholder:text-gray-600"
                                />
                                <div className="absolute bottom-2 right-2">
                                    <button onClick={handleSend} disabled={generationStatus !== 'idle' || (!input.trim() && attached.length === 0)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 active:scale-95 transition-all shadow-lg flex items-center justify-center"><Send size={14} /></button>
                                </div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600" title="Shift + Enter 换行">
                                    <Info size={12} />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full bg-ide-panel/50 overflow-y-auto custom-scrollbar">
                        {selectedElement ? <PropertyEditor /> : (
                            <div className="h-full flex flex-col items-center justify-center p-8 opacity-30 text-center">
                                <Settings2 size={32} className="mb-3 text-gray-400" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">进入选择模式以编辑组件属性</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
