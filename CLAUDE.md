# CLAUDE.md

This file provides project-specific guidance for Claude Code when working with this codebase.

## Project Overview

**Project Name**: Todo Widget
**Type**: Windows Desktop Floating Todo Application
**Tech Stack**: Tauri 2.x + React 19 + TypeScript + Tailwind CSS 4 + SQLite + Zustand

## Key Files

| File | Description |
|------|-------------|
| `src/App.tsx` | Main todo application component (267 lines). Handles all UI rendering, todo CRUD, filtering, search, and custom frameless window |
| `src/App.css` | Dark theme styles with CSS custom properties |
| `src/store.ts` | Zustand store for state management with optimistic updates |
| `src/types.ts` | TypeScript interfaces (Todo, Category) |
| `src/services/database.ts` | SQLite database service via tauri-plugin-sql |
| `src-tauri/src/lib.rs` | Rust plugin registration and system tray setup |
| `src-tauri/src/main.rs` | Tauri entry point |
| `src-tauri/tauri.conf.json` | Window and app configuration |

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev

# Build for production
npm run tauri build
```

## Features

### Implemented
- Add/edit/delete todos with priority (low/medium/high)
- Toggle todo completion status
- Filter todos (All/Active/Completed)
- Search todos by title
- Custom frameless window with drag support
- System tray with context menu
- SQLite persistence
- Dark theme UI
- Loading states and error handling
- Optimistic UI updates

### Configured but Not Fully Integrated
- Categories (database schema exists, store has actions, but UI incomplete)
- Due dates (schema supports it, not in UI)
- Global shortcuts plugin (installed, not used)
- Autostart plugin (installed, no UI toggle)
- Window position persistence

## Architecture

### State Management (Zustand)
- `useTodoStore` in `src/store.ts`
- State: todos, categories, filter, searchQuery, selectedCategory, isLoading, error
- Actions: loadTodos, addTodo, updateTodo, toggleTodo, deleteTodo, category actions

### Database Schema
```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY,
  title TEXT,
  completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'Default',
  due_date TEXT,
  created_at TEXT
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  color TEXT DEFAULT '#6366f1'
);
```

### Window Configuration
- Size: 360x520 (min: 320x400)
- Frameless, transparent, always-on-top
- Skip taskbar, fixed size

## Known Issues

1. Category feature incomplete - UI doesn't fully connect to category system
2. Due date not implemented in UI
3. Window position not persisted (always opens at center)
4. Global shortcut not implemented
5. No minimize button (only close hides to tray)
6. Path must be English-only for Rust compilation

## UI Language

The UI is in Chinese:
- 待办 (Todo)
- 全部 (All)
- 进行中 (Active)
- 已完成 (Completed)
- 优先级 (Priority)
- 低/中/高 (Low/Medium/High)
- 退出 (Quit)
