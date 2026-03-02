
import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import Workspace from './Workspace';
import ChatInterface from './ChatInterface';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(true); // 控制右侧聊天面板
  const [isMobile, setIsMobile] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

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

  // 拖拽调整大小逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // 限制拖拽边界：最小 300px，最大 800px 或屏幕宽度的 60%
      const maxWidth = Math.min(800, window.innerWidth * 0.6);
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= maxWidth) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // 防止拖拽时选中文本
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

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

          {/* 分割拖拽把手：仅在非移动端且面板打开时显示 */}
          {!isMobile && chatOpen && (
            <div
              className={`w-1 z-[95] flex shrink-0 cursor-col-resize hover:bg-blue-500/50 transition-colors ${isResizing ? 'bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
            />
          )}

          {/* 2. 右侧 AI 对话面板 */}
          <aside
            style={{ width: chatOpen && !isMobile ? `${chatWidth}px` : undefined }}
            className={`
              ${isMobile ? 'fixed inset-y-0 right-0 z-[90] w-full sm:w-[400px]' : 'relative shrink-0'}
              ${!isResizing && 'transition-all duration-300 ease-in-out'}
              border-l border-ide-border bg-ide-panel/50 backdrop-blur-xl
              ${chatOpen ? 'translate-x-0' : 'w-0 translate-x-full overflow-hidden border-l-0'}
           `}>
            <div className="w-full h-full flex flex-col">
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
