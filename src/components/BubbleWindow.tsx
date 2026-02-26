import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

function BubbleWindow() {
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  // 左键按下：150ms 延时后才进入拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = false;

    dragTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true;
      getCurrentWindow().startDragging();
    }, 150);
  };

  // 左键松开：如果未进入拖拽模式 → 视为点击
  const handleMouseUp = () => {
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
    if (!isDraggingRef.current) {
      invoke("show_main_window");
    }
    isDraggingRef.current = false;
  };

  // 右键：调用 Rust 原生系统菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    invoke("show_bubble_menu");
  };

  return (
    <div
      className="bubble-container"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <span className="bubble-icon">T</span>
    </div>
  );
}

export default BubbleWindow;
