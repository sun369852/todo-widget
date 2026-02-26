# Todo Widget — 项目文档

> Windows 桌面悬浮待办事项小组件
> 版本：0.1.0 | 最后更新：2026-02-26

---

## 一、项目简介

Todo Widget 是一款 Windows 桌面悬浮待办事项应用，采用 **Tauri 2.x** 框架构建。应用以小型悬浮球的形式常驻桌面，点击展开为完整的待办管理面板，支持增删改查、搜索过滤、优先级分类等功能。

---

## 二、技术栈

| 层级       | 技术                                      |
| ---------- | ----------------------------------------- |
| 桌面框架   | Tauri 2.x（Rust 后端）                    |
| 前端框架   | React 19 + TypeScript                     |
| 状态管理   | Zustand 5                                 |
| 样式       | Tailwind CSS 4 + 自定义 CSS（暗色主题）   |
| 数据库     | SQLite（通过 `tauri-plugin-sql`）          |
| 构建工具   | Vite 7                                    |
| 打包       | NSIS 安装包（Windows）                    |

---

## 三、项目结构

```
todo-widget/
├── src/                          # React 前端源码
│   ├── App.tsx                   # 主应用组件（待办列表 UI、搜索、过滤）
│   ├── App.css                   # 全局样式（暗色主题，含气泡样式）
│   ├── main.tsx                  # React 入口
│   ├── store.ts                  # Zustand 状态管理（CRUD + 乐观更新）
│   ├── types.ts                  # TypeScript 类型定义（Todo / Category）
│   ├── components/
│   │   └── BubbleWindow.tsx      # 悬浮球组件（拖拽、点击切换、右键菜单）
│   └── services/
│       └── database.ts           # SQLite 数据库操作封装（建表 + CRUD）
├── src-tauri/                    # Rust / Tauri 后端
│   ├── src/lib.rs                # IPC 命令 + 窗口管理 + 托盘图标
│   ├── src/main.rs               # 程序入口
│   ├── Cargo.toml                # Rust 依赖声明
│   ├── tauri.conf.json           # 窗口属性、插件、打包配置
│   └── capabilities/default.json # Tauri 权限配置
├── docs/
│   └── project-overview.md       # 本文档
├── package.json                  # 前端依赖与脚本
├── vite.config.ts                # Vite 构建配置
└── README.md                     # 项目说明
```

---

## 四、核心功能

### 4.1 双窗口模式

| 窗口     | 系统尺寸 | 可见UI   | 说明                                    |
| -------- | -------- | -------- | --------------------------------------- |
| 气泡窗口 | 100×100  | 70px 圆形 | 透明窗口内居中显示，阴影不被裁切          |
| 主窗口   | 360×520  | 全尺寸    | 无边框、透明背景、始终置顶、不显示任务栏  |

### 4.2 交互架构（Invoke 命令）

所有前端→后端通信使用 Tauri IPC 命令，无 emit 事件：

| 命令                | 触发方式       | 功能                                    |
| ------------------- | -------------- | --------------------------------------- |
| `show_main_window`  | 单击气泡       | 获取气泡位置 → 隐藏气泡 → 定位并显示主窗口 |
| `close_to_bubble`   | 主窗口关闭按钮 | 隐藏主窗口 → 显示气泡                    |
| `show_bubble_menu`  | 右键气泡       | 弹出 OS 原生退出菜单                     |
| `quit_app`          | 退出菜单/托盘  | 退出程序                                 |

### 4.3 气泡交互逻辑

- **拖拽**：mouseMove 5px 距离阈值检测 → 超过即调用 `startDragging()`，即时响应
- **点击**：mouseUp 时未超过拖拽阈值 → 视为点击，调用 `show_main_window`
- **右键**：contextMenu 事件设置标记 → 阻止 mouseUp 触发点击逻辑 → 弹出原生菜单

### 4.4 待办事项管理

- **添加**：输入标题 + 选择优先级（低/中/高）
- **编辑**：修改标题和优先级
- **完成**：复选框切换完成状态
- **删除**：移除待办
- **搜索**：关键词实时过滤
- **状态过滤**：全部 / 进行中 / 已完成

### 4.5 数据持久化

SQLite 数据库 `todo.db`，含 `todos` 和 `categories` 两张表。
状态管理采用**乐观更新**策略：UI 先行更新，数据库异步写入，失败后自动回滚。

---

## 五、Tauri 插件

| 插件                             | 用途           | 状态     |
| -------------------------------- | -------------- | -------- |
| `tauri-plugin-sql`               | SQLite 数据库  | ✅ 已使用 |
| `tauri-plugin-global-shortcut`   | 全局快捷键     | ⚠️ 已注册 |
| `tauri-plugin-autostart`         | 开机自启       | ⚠️ 已注册 |
| `tauri-plugin-store`             | 键值持久化存储 | ⚠️ 已注册 |

---

## 六、窗口配置

**主窗口**：360×520，无边框，透明，置顶，跳过任务栏，不可调整大小

**气泡窗口**：100×100（内部 70px 圆形居中），透明，置顶，跳过任务栏

---

## 七、开发命令

```bash
npm install          # 安装依赖
npm run tauri dev    # 开发模式（含桌面窗口）
npm run dev          # 仅前端（端口 1421）
npm run tauri build  # 生产构建
```

---

## 八、已知问题

- 项目路径不能包含中文字符，否则 Rust 编译可能失败

## 九、待完善功能

- [ ] 分类管理 UI（数据层已就绪）
- [ ] 全局快捷键绑定
- [ ] 开机自启设置界面
- [ ] 键值存储集成（如窗口位置记忆）
- [ ] 截止日期 UI
