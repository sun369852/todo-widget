# Todo Widget Technical Documentation

This document serves as a guide for AI assistants and developers continuing the development of the Todo Widget. It details the unique topological problems solved regarding multi-window interactions, frameless UI layout, and the Tauri backend bindings.

## Architecture
- **Frontend**: React + TypeScript + Vite. Styled entirely with raw CSS.
- **Backend (Tauri v2)**: Rust handling the system tray, native window spawning/positioning, and IPC communication.
- **State Management**: Zustand handles reactive application state (tasks, active tabs, search query).
- **Icons**: Lucide-React.

## Critical Design Decisions & Gotchas

### Window Coordinate Math (The "Ghost Border" Problem)
A foundational technical challenge in this application is making two separate invisible OS windows visually touch pixel-perfectly without gaps.

**The Issue**: When setting `"resizable": true`, `"decorations": false`, and `"transparent": true` in `tauri.conf.json`, Windows automatically injects an invisible padding (usually ~8px) around the window for users to grab and resize.
If you position Windows using `outer_position()` and `outer_size()`, you are positioning their invisible boundaries. This inevitably leaves an 8px visual gap between the UI elements inside that window and other windows.

**The Solution**: We exclusively use the difference between outer physical bounds and inner logical bounds to manually offset position calculations for both `main` and `bubble` windows.

> **RULE:** In `src-tauri/src/lib.rs`, ALWAYS use `ghost_border = (outer_size - inner_size) / 2` to figure out the OS's exact invisible padding when manipulating `tauri::PhysicalPosition`.

#### 1. Bubble to Main Snapping
When `main` opens from clicking `bubble`, logic looks like this:
```rust
let ghost_x = (outer.width - inner.width) / 2.0;

// To snap Main's right visual edge to Bubble's left visual edge:
let bubble_left_visual = bubble_pos.x + BUBBLE_VISUAL_PADDING; // e.g. 9px padding inside the 60px frame
let main_x = bubble_left_visual - main_inner.width - ghost_x;
```

#### 2. Screen Clamping (Preventing the Bubble from leaving the screen)
To stop the Bubble from getting lost beyond the screen boundaries, we hook into `WindowEvent::Moved` on Tauri.
```rust
WindowEvent::Moved(pos) => {
    let monitor_size = monitor.size();
    let min_x = monitor_pos.x - bubble_visual_offset;
    let max_x = monitor_pos.x + monitor_size.width - bubble_visual_offset - 42.0; // 42 is the exact CSS layout size.
    // ... clamp math ...
}
```

### Resizing Constraints (CSS Flexbox Bounds)
The Main Interface uses React and CSS Flexbox heavily.
When the user grabs the edge of the transparent `main` window to resize:
- If inner contents like the `.todo-list` or header overflow beyond `100vw` or `100vh`, they essentially push the transparent OS resize-grab handles outside of the desktop view, "breaking" the ability to resize or triggering a rendering glitch.

> **RULE:** In `src/App.css`, the root container (`.app-container`) MUST have `.app-container { width: 100vw; height: 100vh; overflow: hidden; }`.
> Any deeply nested flex-growing element (like `.todo-list`) MUST have `min-height: 0;` and a custom hidden scrollbar or overflow bounds to prevent it from ignoring its flex-parent's boundaries when rendering long lists.

### Tauri Invokes
- `getCurrentWindow().startResizeDragging(direction)`: Called directly from `App.tsx` resize handle corner/edge divs. **Do not use a custom rust invoke for this**. This requires `"core:window:allow-start-resize-dragging"` in `capabilities/default.json`.
- `invoke("close_to_bubble")`: Replaces the default `x` button action in the `main` window. Prevents closing the app, hides `main`, and dynamically spawns `bubble`.
- `invoke("show_main_window")`: Replaces the `bubble` left-click. Hides `bubble`, spawns `main`.

## Build Environment
This uses Tauri v2 structure.
- **Frontend dependencies**: `npm install`
- **Backend**: `cargo build` inside `src-tauri` directory.
- `tauri.conf.json` maps multiple sub-windows via the `"windows": [...]` array. DO NOT set the `main` window visible initially here; let the tray or bubble control it.
