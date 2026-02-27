
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Layout, FileText, Plus, FolderOpen, 
  Settings, ChevronDown, ChevronRight, FileCode
} from 'lucide-react';

export default function Sidebar() {
  const { state, dispatch, getCurrentProject } = useApp();
  const currentProject = getCurrentProject();
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);
  const [isPagesExpanded, setIsPagesExpanded] = useState(true);

  const handleAddPage = () => {
    const name = prompt("输入页面名称:", "新页面");
    if (name) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const isDuplicate = currentProject.pages.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicate) {
          alert("该页面名称已存在，请输入唯一的名称。");
          return;
      }
      dispatch({ type: 'ADD_PAGE', payload: trimmedName });
    }
  };

  return (
    <div className="w-64 bg-ide-sidebar border-r border-ide-border flex flex-col h-full text-ide-text select-none">
      {/* Project Header */}
      <div className="p-4 border-b border-ide-border flex items-center justify-between">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs">AI</div>
          ProtoIDE
        </h1>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        
        {/* Project Section */}
        <div className="mb-2">
          <div 
            className="px-3 py-1 flex items-center gap-2 text-sm text-ide-muted hover:text-white cursor-pointer"
            onClick={() => setIsProjectExpanded(!isProjectExpanded)}
          >
            {isProjectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <FolderOpen size={14} />
            <span className="font-medium">PROJECTS</span>
          </div>
          
          {isProjectExpanded && (
            <div className="mt-1 px-3">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-ide-active/10 text-ide-active rounded text-sm font-medium cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {currentProject.name}
              </div>
            </div>
          )}
        </div>

        {/* Pages Section */}
        <div className="mt-4">
          <div 
            className="px-3 py-1 flex items-center gap-2 text-sm text-ide-muted hover:text-white cursor-pointer group justify-between"
            onClick={() => setIsPagesExpanded(!isPagesExpanded)}
          >
            <div className="flex items-center gap-2">
              {isPagesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FileText size={14} />
              <span className="font-medium">PAGES</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAddPage(); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-ide-hover rounded text-ide-text"
            >
              <Plus size={14} />
            </button>
          </div>

          {isPagesExpanded && (
            <div className="mt-1 space-y-0.5">
              {currentProject.pages.map(page => (
                <div 
                  key={page.id}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', payload: page.id })}
                  className={`
                    px-6 py-1.5 flex items-center gap-2 text-sm cursor-pointer border-l-2 transition-colors
                    ${page.id === currentProject.activePageId 
                      ? 'border-blue-500 bg-ide-hover text-white' 
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-ide-hover/50'}
                  `}
                >
                  <FileCode size={14} className={page.id === currentProject.activePageId ? 'text-blue-400' : 'text-gray-500'} />
                  {page.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User / Bottom Section */}
      <div className="p-4 border-t border-ide-border">
        <div className="flex items-center gap-3">
          <img src="https://picsum.photos/32/32" alt="User" className="w-8 h-8 rounded-full border border-ide-border" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Demo User</p>
            <p className="text-xs text-gray-500 truncate">Pro Plan</p>
          </div>
          <Settings size={16} className="text-gray-500 hover:text-white cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
