import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

function BubbleWindow() {
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const isContextMenuRef = useRef(false);

  // 左键按下：记录起始位置（不立即拖拽）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = false;
    isContextMenuRef.current = false;
    startPosRef.current = { x: e.screenX, y: e.screenY };
  };

  // 鼠标移动：超过 5px 阈值后启动拖拽（无延迟，立即响应）
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPosRef.current || isDraggingRef.current) return;
    const dx = e.screenX - startPosRef.current.x;
    const dy = e.screenY - startPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      isDraggingRef.current = true;
      getCurrentWindow().startDragging();
    }
  };

  // 左键松开：未拖拽 → 点击打开主窗口
  const handleMouseUp = () => {
    if (isContextMenuRef.current) {
      isContextMenuRef.current = false;
      startPosRef.current = null;
      return;
    }
    if (!isDraggingRef.current && startPosRef.current) {
      invoke("show_main_window");
    }
    startPosRef.current = null;
    isDraggingRef.current = false;
  };

  // 右键：弹出原生系统菜单（不触发点击逻辑）
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    isContextMenuRef.current = true;
    startPosRef.current = null;
    isDraggingRef.current = false;
    invoke("show_bubble_menu");
  };

  return (
    <div
      className="bubble-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <span className="bubble-icon">T</span>
    </div>
  );
}

export default BubbleWindow;
