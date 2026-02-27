
import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import Workspace from './Workspace';
import ChatInterface from './ChatInterface';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(true); // 控制右侧聊天面板
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setChatOpen(false); // 移动端默认关闭聊天以优化初始预览
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ide-bg text-ide-text font-sans relative">
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* 顶部工具栏：仅保留页面切换和右侧面板控制 */}
        <TopBar 
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />
        
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
           {/* 1. 核心工作区：从最左侧开始占据剩余空间 */}
           <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
              <Workspace />
           </div>

           {/* 2. 右侧 AI 对话面板 */}
           <aside className={`
              ${isMobile ? 'fixed inset-y-0 right-0 z-[90]' : 'relative'}
              transition-all duration-300 ease-in-out border-l border-ide-border bg-ide-panel/50 backdrop-blur-xl
              ${chatOpen ? 'w-full sm:w-[400px] translate-x-0' : 'w-0 translate-x-full overflow-hidden border-l-0'}
           `}>
              <div className="w-full sm:w-[400px] h-full flex flex-col">
                 <ChatInterface onMinimize={() => setChatOpen(false)} />
              </div>
           </aside>
           
           {/* 移动端右侧遮罩 */}
           {isMobile && chatOpen && (
              <div 
                className="fixed inset-0 bg-black/40 z-[85] lg:hidden"
                onClick={() => setChatOpen(false)}
              />
           )}
        </div>
      </div>
    </div>
  );
}
