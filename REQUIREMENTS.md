# Todo Widget Requirements Document

## Overview
A lightweight, modern, floating To-Do List widget designed for desktop operating systems. The application prioritizes unobtrusive user experience, native OS integration, and high aesthetic quality. It utilizes a dual-window architecture: a mini "bubble" suspended on the screen, and the primary "main" to-do interface that toggles based on interactions with the bubble.

## Core Features

### 1. Dual Interface Modes
- **Bubble Widget Mode (Default)**: A small, non-intrusive floating circular icon that acts as an anchor on the screen.
- **Main Interface Mode**: A full-featured To-Do list UI containing tasks, priorities, search, filters, and editing capabilities.

### 2. Interaction Flow
- **Left-Click Bubble**: Toggles the visibility of the Main Interface. When the main interface appears, it MUST snap precisely adjacent to the bubble without visual gaps.
- **Drag Bubble**: The user can drag the bubble around the screen. Dropping the bubble updates its fixed position.
- **Screen Boundary Constraints**: The bubble must NEVER be draggable outside the visible bounds of the OS monitor. Dragging it off-screen will mechanically clamp it to the exact pixel edge of the monitor based on its internal visual circle, not just its invisible drag box.
- **Close Main Interface**: Clicking the native OS close button on the Main Interface does NOT close the application. Instead, it hides the Main Interface and spawns the Bubble Widget directly beside the last known position of the Main Interface.
- **Right-Click Bubble**: Opens a native OS context menu containing options like "Quit" to fully terminate the application.
- **System Tray**: Contains an application icon with an option to fully terminate the application or toggle the Main Interface.

### 3. Main Interface Capabilities
- **Task Management**: Add, Edit, Delete, and mark tasks as Complete/In-Complete.
- **Priorities**: Tasks can be tagged with priority levels (e.g., High, Medium, Low).
- **Filtering & Search**: Support for finding specific tasks via title search and tabs to filter by completion status or priority.
- **Free-Form Resizing**: The Main Interface must be resizable from all 8 directions and corners.
- **Responsive Layout**: Resizing the Main Interface must not break the inner layout (CSS Flexbox). Content must seamlessly wrap or shrink without causing horizontal or vertical overflow that hides the resize grab handles.

## Visual & Aesthetic Requirements
- **Theme**: Premium modern aesthetic featuring dynamic gradient backgrounds, smooth micro-animations, glassmorphism, and a cohesive vibrant color palette.
- **Frameless/Border-less**: Both windows must be entirely stripped of native OS title bars, borders, and drop shadows to simulate an organic desktop overlay experience.
- **Visual Sticking (Pixel-Perfect Alignment)**: When the Main Interface opens, its right internal visual edge must physically touch the left internal visual edge of the circular Bubble Widget. There must be zero pixel gaps despite DPI scaling changes or native OS "ghost borders" injected onto resizable windows.
