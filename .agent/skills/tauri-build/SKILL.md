---
name: tauri-build
description: Handle the full Tauri v2 application packaging and build workflow for this project. Use this skill whenever the user says "打包", "build", "package", "构建", "生成exe", "发布", or anything that implies they want to compile the application into a distributable installer or standalone executable. This skill knows how to handle common Windows build failures like Rust compiler stack overflows and NSIS installer generation.
---

# Tauri Build Skill

This skill handles the complete workflow of packaging the Todo Widget Tauri v2 application into a distributable Windows installer (.exe) or standalone binary.

## Prerequisites

Before building, make sure:
- Node.js and npm are installed
- Rust toolchain is installed (`rustup` + `stable-x86_64-pc-windows-msvc`)
- Visual Studio Build Tools (C++ workload) are available
- The project dependencies are installed (`npm install` has been run)

## Build Workflow

### Step 1: Clean previous build artifacts (optional but recommended)

If the previous build failed or you want a fresh build:

```powershell
cd d:\todoList\todo-widget\src-tauri; cargo clean; cd ..
```

This removes the entire `target/` directory. It makes the build take longer but avoids stale cache issues.

### Step 2: Set environment variables for Windows stability

On Windows, the Rust compiler sometimes crashes with `STATUS_STACK_BUFFER_OVERRUN` (exit code `0xc0000409`) when compiling large dependency trees in release mode. This is a known issue with deeply nested type resolution in crates like `hashlink`, `webview2-com`, etc.

The fix is to increase the compiler's stack size before building:

```powershell
$env:RUST_MIN_STACK = 83886080
```

This sets the minimum stack to ~80MB (default is ~8MB). This environment variable only needs to be set for the current PowerShell session.

### Step 3: Run the build

```powershell
npm run tauri build
```

This command:
1. Runs the Vite frontend build (`dist/` output)
2. Compiles the Rust backend in **release** mode (optimized, stripped debug info)
3. Links everything into a single `.exe`
4. Runs NSIS to generate a Windows installer

The full build takes approximately 3-8 minutes depending on the machine.

### Step 4: Locate the output

After a successful build, you'll find:

| File | Path | Description |
|------|------|-------------|
| **Installer** | `src-tauri/target/release/bundle/nsis/todo-widget_<version>_x64-setup.exe` | NSIS installer with shortcuts and uninstaller |
| **Portable** | `src-tauri/target/release/todo-widget.exe` | Standalone executable (needs WebView2 runtime) |

Report both paths to the user after the build completes.

## Handling Common Build Failures

### `STATUS_STACK_BUFFER_OVERRUN` (0xc0000409)
**Cause**: Rust compiler runs out of stack space during release compilation.
**Fix**: Set `$env:RUST_MIN_STACK = 83886080` before running the build. If it still fails, try `167772160` (160MB).

### `error: linker 'link.exe' not found`
**Cause**: Visual Studio Build Tools not installed or not in PATH.
**Fix**: Install "Desktop development with C++" workload from Visual Studio Installer.

### NSIS errors
**Cause**: NSIS (Nullsoft Scriptable Install System) might not be installed.
**Fix**: Tauri should auto-download NSIS, but if it fails, install it manually from https://nsis.sourceforge.io/

### `Blocking waiting for file lock on build directory`
**Cause**: Another cargo process is running (e.g., `cargo check` from dev mode).
**Fix**: Stop the dev server first (`npm run tauri dev` or any running terminal), then retry.

### WebView2 runtime missing on target machine
The built app requires Microsoft Edge WebView2 Runtime. Windows 11 includes it by default. For Windows 10, the NSIS installer should bundle it, but if the portable `.exe` doesn't launch, the user needs to install WebView2 from https://developer.microsoft.com/en-us/microsoft-edge/webview2/.

## Quick Reference (Full One-Liner)

```powershell
cd d:\todoList\todo-widget\src-tauri; cargo clean; cd ..; $env:RUST_MIN_STACK=83886080; npm run tauri build
```

## What to Report After Success

Tell the user:
- ✅ Build succeeded
- 📦 Installer path (the NSIS `.exe`)
- 🚀 Portable executable path
- 📐 File sizes if notable
- ⚠️ Any warnings encountered (usually just `unused import` warnings, which are harmless)
