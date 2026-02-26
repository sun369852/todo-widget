# Todo Widget

Windows 桌面悬浮待办事项小组件，以圆形气泡形式常驻桌面顶层，点击展开完整待办管理面板。

## 技术栈

- **Tauri 2.x** (Rust) — 桌面框架
- **React 19** + TypeScript — 前端
- **Zustand 5** — 状态管理
- **SQLite** — 数据持久化
- **Vite 7** — 构建工具

## 功能

- 🔵 圆形悬浮球，始终顶置、不占任务栏
- 📝 待办事项增删改查
- 🔍 搜索与状态过滤（全部 / 进行中 / 已完成）
- 🎯 优先级标记（低 / 中 / 高）
- 💾 SQLite 本地持久化 + 乐观更新
- 🖱️ 悬浮球 & 主窗口均可拖拽
- 📌 系统托盘图标
- 🔄 气泡 ↔ 主窗口无缝切换

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 生产构建
npm run tauri build
```

## 项目结构

```
src/                          # React 前端
├── App.tsx                   # 主界面
├── store.ts                  # Zustand 状态管理
├── types.ts                  # 类型定义
├── components/
│   └── BubbleWindow.tsx      # 悬浮球组件
└── services/
    └── database.ts           # SQLite 数据库操作

src-tauri/                    # Rust 后端
├── src/lib.rs                # 应用逻辑 & IPC 命令
├── tauri.conf.json           # 窗口 & 插件配置
└── Cargo.toml                # Rust 依赖
```

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
