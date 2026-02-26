import { useState, useRef } from "react";
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

function BubbleWindow() {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 记录开始位置
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
    // 开始拖拽
    getCurrentWindow().startDragging();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 如果移动距离很小，认为是点击
    if (distance < 5) {
      handleClick();
    }

    dragStartRef.current = null;
  };

  const handleClick = async () => {
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.hide();

      const allWindows = await getAllWindows();
      const mainWindow = allWindows.find(w => w.label === "main");
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.setFocus();
      }
    } catch (err) {
      console.error("Click error:", err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleQuit = () => {
    setShowMenu(false);
    invoke("quit_app");
  };

  const handleCloseMenu = () => {
    setShowMenu(false);
  };

  return (
    <div
      className="bubble-container"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <span className="bubble-icon">T</span>

      {/* Right-click menu */}
      {showMenu && (
        <div className="bubble-menu" onClick={(e) => e.stopPropagation()}>
          <button
            className="bubble-menu-item"
            onClick={handleQuit}
            onMouseDown={(e) => e.stopPropagation()}
          >
            退出
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="bubble-menu-overlay"
          onClick={handleCloseMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowMenu(false);
          }}
        />
      )}
    </div>
  );
}

export default BubbleWindow;
