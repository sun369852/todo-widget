# Todo Widget 技术文档

本文档供 AI 助手或持续参与本项目的开发者参考，详细说明了已解决的多窗口交互、无边框布局和 Tauri 后端绑定等核心技术问题。

---

## 架构总览

| 层级 | 技术 | 职责 |
|------|------|------|
| 前端 | React + TypeScript + Vite + 纯 CSS | UI 渲染、状态展示 |
| 状态管理 | Zustand | 任务列表、分类、过滤、搜索等全局状态 |
| 后端 | Tauri v2（Rust） | 系统托盘、双窗口生命周期、IPC 通信 |
| 本地存储 | SQLite（via `@tauri-apps/plugin-sql`） | 任务、分类、子任务数据持久化 |

---

## 关键技术问题与解法

### 1. 幽灵边框（Ghost Border）坐标补偿

**问题**：在 `tauri.conf.json` 中配置 `"resizable": true`、`"decorations": false`、`"transparent": true` 后，Windows 系统会向窗口四边注入约 8px 的不可见透明缩放抓取层，导致 `outer_size` ≠ 用户肉眼所见的物理 UI 尺寸。

**解法**：
```rust
let ghost_border_width = (outer_size.width - inner_size.width) / 2.0;
```
所有窗口位置计算（尤其是主界面紧贴气泡的对齐逻辑）必须基于 `inner_size` 加上 `ghost_border` 偏移量进行演算，而非直接使用 `outer_size`。

**气泡→主界面对齐示例**：
```rust
let ghost_x = (outer.width - inner.width) / 2.0;
let bubble_left_visual = bubble_pos.x + BUBBLE_VISUAL_PADDING; // 气泡内圆球左边缘
let main_x = bubble_left_visual - main_inner.width - ghost_x;  // 主界面右边缘紧贴气泡左边缘
```

---

### 2. 屏幕边缘锁定（Screen Clamp）

**问题**：气泡可被用户随意拖动，必须防止拖到显示器可视范围之外。

**解法**：监听 `WindowEvent::Moved`，实时获取当前显示器大小，以气泡内部圆球的视觉尺寸（而非窗口外框）为基准进行四边夹持：
```rust
WindowEvent::Moved(pos) => {
    let min_x = monitor_pos.x - bubble_visual_offset;
    let max_x = monitor_pos.x + monitor_size.width - bubble_visual_offset - 42.0;
    // 四个方向同理，容差设为 0.5 防止微抖动
}
```

---

### 3. CSS Flexbox 溢出防御

**问题**：主界面内的任务列表若内容过多并 overflow，会将四角的透明缩放抓手"推"到窗口外，导致缩放功能失效。

**解法**：
```css
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden; /* 三大安全锁，顺序不可替换 */
}
.todo-list {
  min-height: 0; /* 破除 flex 子元素无限撑开的默认行为 */
  overflow-y: auto;
}
```

---

### 4. 拖拽排序实现（自定义鼠标事件方案）

**为何不用 HTML5 原生 Drag & Drop**：在 Tauri + WebView2 环境下，原生拖拽与 Tauri 的窗口拖拽（`startDragging`）会产生冲突，且原生 API 不支持精确的动画控制。

**自定义方案架构**：
- `mousedown` 在拖把手上触发，调用 `e.stopPropagation()` 阻断 Tauri 窗口拖拽
- `mousemove` 绑定在 `document` 上，通过 `requestAnimationFrame` 节流（每帧最多一次 `setState`），拖拽元素的 `translateY` 直接写入 DOM（`el.style.transform`），完全绕过 React 渲染管道，实现 60fps 跟手

**快照机制（Snapshot Rects）**：
- 拖拽开始（`mousedown`）时，一次性冻结所有 `.todo-item-wrapper` 的 `getBoundingClientRect()` 存入 `snapshotRectsRef`
- 碰撞检测（`getOverIndexFromVisual`）全程基于冻结数据 + 当前已位移量计算视觉中心，避免动态布局影响检测稳定性
- 配合 ±4px 死区防止在 item 边界处反复横跳

**放下时（mouseup）防闪设计**：
- 先同步调用 `useTodoStore.getState().reorderTodos()`（Zustand `set()` 是同步的）
- 再 React `setState` 清除拖拽状态
- 两者在同一 React commit 批次提交，用户不会看到中间状态
- 其他 item 的挤压 `transition` 仅在 `.app-container.is-dragging` 下生效，松手后立即关闭，避免归零动画与重排叠加造成闪烁

---

### 5. 数据库结构（SQLite）

```sql
-- 任务表
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'Default',
  due_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  category_id INTEGER
);

-- 分类表
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1'
);

-- 子任务表
CREATE TABLE subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);
```

**乐观更新策略**：所有写操作（添加、切换、删除、排序）先同步更新 Zustand 状态，UI 立即响应；再异步写入数据库，失败时回滚 Zustand 状态。添加任务后用 `db.getTodos()` 静默刷新（不设 `isLoading: true`）以获取真实数据库 ID，避免加载状态闪烁。

---

### 6. Tauri IPC 调用

| 调用 | 触发位置 | 作用 |
|------|----------|------|
| `getCurrentWindow().startResizeDragging(direction)` | `App.tsx` 八个缩放边框 | 原生窗口缩放，需 `capabilities/default.json` 授权 |
| `invoke("close_to_bubble")` | 主界面关闭按钮 | 隐藏主界面，在原位显示气泡 |
| `invoke("show_main_window")` | 气泡单击 | 隐藏气泡，在气泡左侧显示主界面 |
| `getCurrentWindow().startDragging()` | 主界面 header 区域 mousedown | 拖动主界面窗口 |

---

## 构建环境

- **前端**：`npm install` + `npm run tauri dev`（热重载，修改 `.tsx/.css` 无需重启）
- **后端**：修改 `.rs` 或 `.json` 会触发 Rust 重新编译（较慢）
- **打包**：`npm run tauri build`，产物在 `src-tauri/target/release/bundle/`
- **注意**：`tauri.conf.json` 中 `main` 窗口初始不可见，由托盘或气泡控制其显示时机
