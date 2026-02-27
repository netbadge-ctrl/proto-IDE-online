import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Type, Palette, Layout, Save, ChevronRight, Hash, AlertTriangle } from 'lucide-react';

// --- Robust DOM to JSX Converter ---

const domToJsx = (node: Node, indentLevel: number = 2): string => {
    const indent = '  '.repeat(indentLevel);
    
    // 1. Handle Text Nodes
    if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent || '';
        if (!text.trim()) return '';
        // Escape braces for JSX text to prevent syntax errors
        text = text.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}"); 
        return text; 
    }
    
    // 2. Handle Element Nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        // Skip internal IDE tools
        if (el.id === 'error-overlay' || el.id === 'root') {
             // For root, we just process children
             return Array.from(node.childNodes).map(c => domToJsx(c, indentLevel)).join('');
        }
        if (tagName === 'script' || tagName === 'style') return '';

        let propsString = '';
        
        // Handle Attributes
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            let name = attr.name;
            let value = attr.value;
            
            // Filter internal attributes
            if (name === 'contenteditable') continue;
            if (name === 'data-tag-name') continue;
            if (value.includes('element-selected')) {
                value = value.replace('element-selected', '').trim();
            }
            if (!value && name === 'class') continue;

            // Rename standard props
            if (name === 'class') name = 'className';
            if (name === 'for') name = 'htmlFor';
            if (name === 'colspan') name = 'colSpan';
            if (name === 'rowspan') name = 'rowSpan';
            
            // Style handling: Convert string "color: red;" to object {{ color: "red" }}
            if (name === 'style') {
                const styleProps = value.split(';').reduce((acc, rule) => {
                   const [k, v] = rule.split(':');
                   if (k && v) {
                       const camelK = k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
                       acc.push(`${camelK}: "${v.trim()}"`);
                   }
                   return acc;
                }, [] as string[]);
                
                if (styleProps.length > 0) {
                    propsString += ` style={{ ${styleProps.join(', ')} }}`;
                }
                continue;
            }

            // Normal attributes
            propsString += ` ${name}="${value}"`;
        }
        
        // Handle Void Tags (Self-closing)
        const voidTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
        const isVoid = voidTags.includes(tagName);
        
        if (isVoid) {
            return `\n${indent}<${tagName}${propsString} />`;
        }
        
        // Handle Children
        const children = Array.from(node.childNodes)
            .map(c => domToJsx(c, indentLevel + 1))
            .join('');
            
        // Formatting: Inline if short text, block if nested
        const hasElementChildren = Array.from(node.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
        
        if (!children.trim()) {
             return `\n${indent}<${tagName}${propsString}></${tagName}>`;
        }
        
        if (hasElementChildren) {
             return `\n${indent}<${tagName}${propsString}>${children}\n${indent}</${tagName}>`;
        } else {
             return `\n${indent}<${tagName}${propsString}>${children}</${tagName}>`;
        }
    }
    
    return '';
};

// --- Utility: Class Name Helpers ---

const isBgColorClass = (c: string) => {
    if (!c.startsWith('bg-')) return false;
    if (c.startsWith('bg-opacity-')) return false;
    const excluded = ['clip', 'origin', 'bottom', 'center', 'left', 'right', 'top', 'repeat', 'cover', 'contain', 'fixed', 'local', 'scroll', 'gradient', 'blend'];
    if (excluded.some(ex => c.startsWith(`bg-${ex}`))) return false;
    return true; 
};

const isTextColorClass = (c: string) => {
    if (!c.startsWith('text-')) return false;
    if (c.startsWith('text-opacity-')) return false;
    const excluded = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl', 'left', 'center', 'right', 'justify', 'start', 'end', 'wrap', 'nowrap', 'balance', 'pretty', 'clip', 'ellipsis', 'break', 'indent'];
    if (excluded.some(ex => c === `text-${ex}` || c.startsWith(`text-${ex}-`))) return false;
    return true;
};

// --- Sub-Components ---

const HeaderSection = ({ tagName, onClose }: { tagName: string, onClose: () => void }) => (
  <div className="h-12 border-b border-ide-border flex items-center justify-between px-4 bg-ide-sidebar shrink-0">
    <div className="flex items-center gap-2">
      <Hash size={16} className="text-blue-400" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">属性编辑器: {tagName.toLowerCase()}</span>
    </div>
    <button onClick={onClose} className="p-1 hover:bg-ide-hover rounded text-gray-400 transition-colors"><X size={18} /></button>
  </div>
);

const ContentSection = ({ text, setText }: { text: string, setText: (s: string) => void }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Type size={14} /> 文本内容</label>
    <textarea 
      value={text} 
      onChange={(e) => setText(e.target.value)} 
      className="w-full bg-ide-bg border border-ide-border rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-none shadow-inner font-mono" 
      placeholder="输入元素文本..." 
    />
  </div>
);

const StyleSection = ({ bgColor, setBgColor, textColor, setTextColor, padding, setPadding }: any) => {
  const commonColors = ['bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-blue-500', 'bg-indigo-600', 'bg-red-500', 'bg-green-500', 'bg-yellow-400'];
  const commonTextColors = ['text-gray-900', 'text-gray-600', 'text-gray-400', 'text-white', 'text-blue-600', 'text-indigo-600'];
  
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Palette size={14} /> 背景颜色</label>
        <div className="grid grid-cols-4 gap-2">
          {commonColors.map(c => (
            <button key={c} onClick={() => setBgColor(c)} className={`w-full h-8 rounded-lg border transition-all ${bgColor === c ? 'border-blue-500 ring-2 ring-blue-500/20 scale-95' : 'border-ide-border hover:border-gray-600'} ${c}`} title={c} />
          ))}
        </div>
        <div className="relative">
             <input placeholder="自定义 Tailwind 类 (如 bg-slate-800)..." value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full bg-ide-bg border border-ide-border rounded-lg p-2 pl-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" />
             {bgColor && !bgColor.startsWith('bg-') && (
                <span className="absolute right-3 top-2.5 text-yellow-500" title="建议使用 bg- 前缀">
                    <AlertTriangle size={12} />
                </span>
             )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><ChevronRight size={14} /> 字体颜色</label>
        <select value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full bg-ide-bg border border-ide-border rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer">
          <option value="">默认颜色</option>
          {commonTextColors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="自定义 (如 text-blue-400)..." value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full bg-ide-bg border border-ide-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Layout size={14} /> 内边距 (Padding)</label>
        <div className="flex flex-wrap gap-2">
          {['p-2', 'p-4', 'p-6', 'p-8'].map(p => (
            <button key={p} onClick={() => setPadding(p)} className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${padding === p ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-ide-bg border-ide-border text-gray-400 hover:text-gray-200'}`}>{p}</button>
          ))}
          <input placeholder="自定义..." value={padding} onChange={(e) => setPadding(e.target.value)} className="flex-1 min-w-[60px] bg-ide-bg border border-ide-border rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" />
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

export default function PropertyEditor() {
  const { selectedElement, setSelectedElement, dispatch, getCurrentPage, getCurrentVersion } = useApp();
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [padding, setPadding] = useState('');

  useEffect(() => {
    if (selectedElement) {
      const getClasses = () => selectedElement.className.split(' ');
      
      const updateState = () => {
          if (selectedElement.childNodes.length === 1 && selectedElement.childNodes[0].nodeType === 3) {
             setText(selectedElement.textContent?.trim() || '');
          } else if (selectedElement.childNodes.length === 0) {
             setText(selectedElement.textContent?.trim() || '');
          } else {
             setText('(包含子元素 - 仅编辑样式)');
          }

          const classes = getClasses();
          setBgColor(classes.find(c => isBgColorClass(c)) || '');
          setTextColor(classes.find(c => isTextColorClass(c)) || '');
          setPadding(classes.find(c => c.startsWith('p-')) || '');
      };
      
      updateState();

      const inputHandler = () => {
          if (selectedElement.childNodes.length <= 1) {
              setText(selectedElement.textContent?.trim() || '');
          }
      };
      selectedElement.addEventListener('input', inputHandler);
      return () => selectedElement.removeEventListener('input', inputHandler);
    }
  }, [selectedElement]);

  if (!selectedElement) return null;

  const handleUpdate = () => {
    if (!selectedElement) return;
    
    // 1. Update DOM (Immediate Preview)
    if (text && text !== '(包含子元素 - 仅编辑样式)') {
        selectedElement.textContent = text;
    }

    let currentClasses = selectedElement.className.split(' ').filter(c => 
        c !== 'element-selected' && 
        (!bgColor || !isBgColorClass(c)) &&
        (!textColor || !isTextColorClass(c)) &&
        (!padding || !c.startsWith('p-'))
    );
    
    if (bgColor) currentClasses.push(bgColor);
    if (textColor) currentClasses.push(textColor);
    if (padding) currentClasses.push(padding);
    
    selectedElement.className = currentClasses.join(' ').trim();

    // 2. Persist to File (HTML Snapshot -> Full React Component)
    const doc = selectedElement.ownerDocument;
    const root = doc.getElementById('root');
    const page = getCurrentPage();
    const currentVersion = getCurrentVersion();
    
    if (root && page && currentVersion) {
      // Temporarily remove selection artifacts for clean save
      const wasSelected = selectedElement.classList.contains('element-selected');
      const wasEditable = selectedElement.getAttribute('contenteditable');
      const tagNameAttr = selectedElement.getAttribute('data-tag-name');
      
      selectedElement.classList.remove('element-selected');
      selectedElement.removeAttribute('contenteditable');
      selectedElement.removeAttribute('data-tag-name');
      
      // Convert DOM to clean JSX
      // We pass 'root' but we actually want its children, domToJsx handles root specially
      const jsxContent = domToJsx(root);

      // Reconstruct Valid React Component
      const fullFileContent = `import React from 'react';
import { useState, useEffect } from 'react';

// 注意：此代码由可视化编辑器快照生成，逻辑已简化为静态视图。
// Note: Generated by Visual Editor Snapshot.
export default function App() {
  return (
    <>
${jsxContent}
    </>
  );
}
`;
      
      // Generate a new Version ID for this edit
      const newVersionId = Math.random().toString(36).substr(2, 9);
      const elementName = selectedElement.tagName.toLowerCase();
      const desc = `可视化属性编辑: <${elementName}>`;

      // 1. Create New Version
      dispatch({ 
          type: 'UPDATE_FILE_CONTENT', 
          payload: { 
              pageId: page.id, 
              fileName: currentVersion.entryPoint, 
              content: fullFileContent,
              newVersionId: newVersionId, // Force new ID
              description: desc
          } 
      });
      
      // 2. Add System Message to Chat History (To make it visible and independent)
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
            pageId: page.id,
            message: { 
                id: Date.now().toString(), 
                role: 'ai', 
                content: `已保存属性快照: 修改了 <${elementName}> 的样式/内容。`, 
                timestamp: Date.now(),
                relatedVersionId: newVersionId
            }
        }
      });
      
      // Restore state
      if (wasSelected) selectedElement.classList.add('element-selected');
      if (wasEditable) selectedElement.setAttribute('contenteditable', wasEditable);
      if (tagNameAttr) selectedElement.setAttribute('data-tag-name', tagNameAttr);
      
      setSelectedElement(null);
      selectedElement.classList.remove('element-selected');
    }
  };

  const handleClose = () => {
    selectedElement.classList.remove('element-selected');
    selectedElement.removeAttribute('contenteditable');
    selectedElement.removeAttribute('data-tag-name');
    setSelectedElement(null);
  };

  return (
    <div className="flex flex-col h-full bg-ide-panel border-l border-ide-border animate-in slide-in-from-right duration-200 shadow-2xl z-50">
      <HeaderSection tagName={selectedElement.tagName} onClose={handleClose} />
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        <ContentSection text={text} setText={setText} />
        <StyleSection bgColor={bgColor} setBgColor={setBgColor} textColor={textColor} setTextColor={setTextColor} padding={padding} setPadding={setPadding} />
      </div>
      <div className="p-4 border-t border-ide-border bg-ide-sidebar shrink-0">
        <div className="mb-3 text-[10px] text-yellow-600/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
          注意：保存将重写 App.tsx 为静态组件，这会移除原有的状态逻辑 (useState/useEffect)。
        </div>
        <button onClick={handleUpdate} className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-xl shadow-blue-900/30 active:scale-95">
          <Save size={16} /> 保存为新版本
        </button>
      </div>
    </div>
  );
}