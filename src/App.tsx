import { useEffect, useState, useRef } from "react";
import { useTodoStore } from "./store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import BubbleWindow from "./components/BubbleWindow";
import "./App.css";

function App() {
  const {
    todos,
    categories,
    filter,
    searchQuery,
    selectedCategoryId,
    expandedTodoId,
    isLoading,
    error,
    loadTodos,
    loadCategories,
    addTodo,
    toggleTodo,
    deleteTodo,
    addCategory,
    deleteCategory,
    setFilter,
    setSearchQuery,
    setSelectedCategoryId,
    setExpandedTodoId,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTodoStore();

  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState("medium");
  const [newTodoCategoryId, setNewTodoCategoryId] = useState<number | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [windowLabel, setWindowLabel] = useState<string>("");
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366f1");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // ===== Mouse-event drag state =====
  const [isDragging, setIsDragging] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // NO dragDeltaY state — the source element's transform is written directly to DOM
  const todoListRef = useRef<HTMLDivElement>(null);
  // The actual DOM node of the dragged wrapper — updated directly, no React render
  const dragSourceElRef = useRef<HTMLElement | null>(null);
  // Refs for document listeners (avoid stale closures)
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef<number>(0);
  const dragItemHeightRef = useRef<number>(52);
  // Frozen snapshot of every wrapper's rect at drag start
  const snapshotRectsRef = useRef<DOMRect[]>([]);
  // RAF handle + latest mouse Y for throttled overIndex updates
  const rafRef = useRef<number | null>(null);
  const latestMouseYRef = useRef<number>(0);

  useEffect(() => {
    const getLabel = async () => {
      const label = getCurrentWindow().label;
      setWindowLabel(label);
    };
    getLabel();
    loadTodos();
    loadCategories();
  }, []);

  // Render bubble window
  if (windowLabel === "bubble") {
    return <BubbleWindow />;
  }

  // Loading state - don't render main UI until we know the window label
  if (!windowLabel) {
    return null;
  }

  // Filter todos
  const filteredTodos = todos.filter((todo) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && !todo.completed) ||
      (filter === "completed" && todo.completed);
    const matchesSearch = todo.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryId === null || todo.categoryId === selectedCategoryId;
    return matchesFilter && matchesSearch && matchesCategory;
  });

  // ===== Snapshot-based drag handlers =====

  /**
   * Compute the visual center of item i given current from/over state.
   * Items that have already shifted get their center adjusted so that
   * overIndex transitions happen exactly when the cursor crosses the
   * VISUAL (rendered) midpoint — not the original snapshot position.
   */
  const getVisualShift = (i: number, from: number, over: number): number => {
    const h = dragItemHeightRef.current;
    if (i === from) return 0;
    if (from < over) {
      if (i > from && i <= over) return -h;
    } else if (from > over) {
      if (i >= over && i < from) return h;
    }
    return 0;
  };

  /**
   * Determine overIndex using VISUAL centers (snapshot + current shift).
   * Includes a ±DEAD_ZONE px hysteresis so the cursor must cross the
   * visual midpoint by a small margin before the transition fires.
   * This prevents flipflop when hovering near an item boundary.
   */
  const DEAD_ZONE = 4; // px
  const getOverIndexFromVisual = (clientY: number): number => {
    const rects = snapshotRectsRef.current;
    const from = dragFromRef.current;
    const currentOver = dragOverRef.current ?? 0;
    if (!rects.length || from === null) return currentOver;

    let result = from;
    for (let i = 0; i < rects.length; i++) {
      if (i === from) continue;
      const shift = getVisualShift(i, from, currentOver);
      const visualCenter = rects[i].top + rects[i].height / 2 + shift;
      // Apply hysteresis: require a margin past the midpoint
      const threshold = i < from
        ? visualCenter - DEAD_ZONE   // item is above: must cross downward
        : visualCenter + DEAD_ZONE;  // item is below: must cross upward
      if (i < from && clientY < threshold) {
        result = i;
        break; // searching upward: take first match
      } else if (i > from && clientY > threshold) {
        result = i; // searching downward: keep updating to last match
      }
    }
    return result;
  };

  const handleHandleMouseDown = (e: React.MouseEvent, fromIndex: number) => {
    e.stopPropagation(); // prevent Tauri window startDragging
    e.preventDefault();

    // Snapshot all rects BEFORE any transforms are applied
    const wrappers = todoListRef.current?.querySelectorAll(".todo-item-wrapper");
    if (wrappers) {
      snapshotRectsRef.current = Array.from(wrappers).map(
        (el) => (el as HTMLElement).getBoundingClientRect()
      );
      dragItemHeightRef.current = snapshotRectsRef.current[fromIndex]?.height ?? 52;
    }

    isDraggingRef.current = true;
    dragFromRef.current = fromIndex;
    dragOverRef.current = fromIndex;
    dragStartYRef.current = e.clientY;
    latestMouseYRef.current = e.clientY;

    // Store direct reference to source wrapper for zero-overhead transform
    if (wrappers) {
      dragSourceElRef.current = wrappers[fromIndex] as HTMLElement;
    }

    setIsDragging(true);
    setDragFromIndex(fromIndex);
    setDragOverIndex(fromIndex);
    // Reset source el transform (in case of lingering state)
    if (dragSourceElRef.current) {
      dragSourceElRef.current.style.transform = "translateY(0px)";
    }

    // rawMouseMove only writes to refs — zero setState, zero re-renders
    const rawMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      latestMouseYRef.current = ev.clientY;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (!isDraggingRef.current) return;
          const y = latestMouseYRef.current;
          // Direct DOM write — bypasses React entirely, smooth 60fps
          if (dragSourceElRef.current) {
            dragSourceElRef.current.style.transform =
              `translateY(${y - dragStartYRef.current}px)`;
          }
          // overIndex changes are rare — only setState when it actually changes
          const over = getOverIndexFromVisual(y);
          if (over !== dragOverRef.current) {
            dragOverRef.current = over;
            setDragOverIndex(over);
          }
        });
      }
    };

    const handleMouseUp = async () => {
      if (!isDraggingRef.current) return;
      const from = dragFromRef.current;
      const to = dragOverRef.current;

      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      isDraggingRef.current = false;
      dragFromRef.current = null;
      dragOverRef.current = null;
      snapshotRectsRef.current = [];

      // Reorder Zustand FIRST (synchronous set()), then clear drag React state.
      // All of these land in the same React commit — no intermediate visible frame.
      if (from !== null && to !== null && from !== to) {
        const fromTodo = filteredTodos[from];
        const toTodo = filteredTodos[to];
        const realFrom = todos.findIndex((t) => t.id === fromTodo.id);
        const realTo = todos.findIndex((t) => t.id === toTodo.id);
        if (realFrom !== -1 && realTo !== -1) {
          useTodoStore.getState().reorderTodos(realFrom, realTo);
        }
      }

      // Clear drag UI state. React will also atomically clear the source el's
      // inline transform (set via dragSourceElRef) in the same commit phase —
      // no need to manually reset el.style.transform here.
      setIsDragging(false);
      setDragFromIndex(null);
      setDragOverIndex(null);
      dragSourceElRef.current = null;

      document.removeEventListener("mousemove", rawMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", rawMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // ===== Todo handlers =====
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    await addTodo(newTodoTitle, newTodoPriority, newTodoCategoryId);
    setNewTodoTitle("");
    setNewTodoPriority("medium");
    setNewTodoCategoryId(undefined);
    setShowAddForm(false);
  };

  const handleToggleTodo = async (id: number, completed: boolean) => {
    await toggleTodo(id, !completed);
  };

  const handleDeleteTodo = async (id: number) => {
    await deleteTodo(id);
  };

  const startEdit = (id: number, title: string, priority: string) => {
    setEditingTodo(id);
    setEditTitle(title);
    setEditPriority(priority);
  };

  const saveEdit = async () => {
    if (editingTodo === null) return;
    const todo = todos.find((t) => t.id === editingTodo);
    if (todo) {
      await useTodoStore.getState().updateTodo(editingTodo, editTitle, editPriority, todo.category, todo.dueDate);
    }
    setEditingTodo(null);
    setEditTitle("");
    setEditPriority("medium");
  };

  const cancelAddTodo = () => {
    setShowAddForm(false);
    setNewTodoTitle("");
    setNewTodoPriority("medium");
    setNewTodoCategoryId(undefined);
  };

  const handleClose = async () => {
    await invoke("close_to_bubble");
  };

  const handleDragMouseDown = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".app-header") && !target.closest(".header-actions")) {
      await getCurrentWindow().startDragging();
    }
  };

  // ===== Category handlers =====
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName.trim(), newCategoryColor);
    setNewCategoryName("");
    setNewCategoryColor("#6366f1");
  };

  const handleDeleteCategory = async (id: number) => {
    await deleteCategory(id);
  };

  // ===== Subtask handlers =====
  const handleAddSubtask = async (todoId: number) => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(todoId, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent, todoId: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubtask(todoId);
    }
  };

  const priorityColors: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-red-500",
  };

  const priorityLabels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };

  const getCategoryColor = (catId?: number | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.color ?? null;
  };

  const getCategoryName = (catId?: number | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.name ?? null;
  };

  // Compute per-item translateY for the squeeze animation.
  // Non-dragged items shift up/down based on fromIndex and overIndex.
  const getShiftY = (index: number): number => {
    if (!isDragging || dragFromIndex === null || dragOverIndex === null) return 0;
    if (index === dragFromIndex) return 0; // dragged item stays (just dims)
    const h = dragItemHeightRef.current;
    if (dragFromIndex < dragOverIndex) {
      // Dragging DOWN: items between fromIndex+1 and overIndex shift UP
      if (index > dragFromIndex && index <= dragOverIndex) return -h;
    } else {
      // Dragging UP: items between overIndex and fromIndex-1 shift DOWN
      if (index >= dragOverIndex && index < dragFromIndex) return h;
    }
    return 0;
  };

  return (
    <div
      className={`app-container${isDragging ? " is-dragging" : ""}`}
      onMouseDown={handleDragMouseDown}
    >
      {/* Resize Handles */}
      <div className="resize-edge top" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("North"); }} />
      <div className="resize-edge bottom" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("South"); }} />
      <div className="resize-edge left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("West"); }} />
      <div className="resize-edge right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("East"); }} />
      <div className="resize-corner top-left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("NorthWest"); }} />
      <div className="resize-corner top-right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("NorthEast"); }} />
      <div className="resize-corner bottom-left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("SouthWest"); }} />
      <div className="resize-corner bottom-right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging("SouthEast"); }} />

      {/* Header */}
      <header className="app-header">
        <span className="app-title">待办</span>
        <div className="header-actions">
          <button
            onClick={() => setShowCategoryPanel(!showCategoryPanel)}
            className={`header-icon-btn ${showCategoryPanel ? "active" : ""}`}
            title="分类管理"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </button>
          <button onClick={handleClose} className="close-btn" title="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Category Management Panel */}
      <div className={`category-panel ${showCategoryPanel ? "open" : ""}`}>
        <div className="category-panel-content">
          <div className="category-panel-list">
            {categories.map((cat) => (
              <div key={cat.id} className="category-panel-item">
                <span className="category-dot" style={{ background: cat.color }} />
                <span className="category-panel-name">{cat.name}</span>
                <button className="category-delete-btn" onClick={() => handleDeleteCategory(cat.id)} title="删除分类">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <form className="category-add-form" onSubmit={handleAddCategory}>
            <input
              type="text"
              placeholder="新分类名称..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="input category-input"
            />
            <input
              type="color"
              value={newCategoryColor}
              onChange={(e) => setNewCategoryColor(e.target.value)}
              className="category-color-picker"
              title="选择颜色"
            />
            <button type="submit" className="btn btn-primary category-add-btn">添加</button>
          </form>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input search-input"
        />
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button className={`filter-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>全部</button>
        <button className={`filter-tab ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>进行中</button>
        <button className={`filter-tab ${filter === "completed" ? "active" : ""}`} onClick={() => setFilter("completed")}>已完成</button>
      </div>

      {/* Category Filter Bar */}
      {categories.length > 1 && (
        <div className="category-bar">
          <button
            className={`category-chip ${selectedCategoryId === null ? "active" : ""}`}
            onClick={() => setSelectedCategoryId(null)}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-chip ${selectedCategoryId === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              <span className="category-dot" style={{ background: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && <div className="error-banner">错误: {error}</div>}

      {/* Todo List */}
      <div className="todo-list" ref={todoListRef}>
        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : filteredTodos.length === 0 ? (
          <div className="empty-state">暂无待办</div>
        ) : (
          filteredTodos.map((todo, index) => {
            const isBeingDragged = isDragging && dragFromIndex === index;

            return (
              <div
                key={todo.id}
                className={`todo-item-wrapper${isBeingDragged ? " is-dragging-source" : ""}`}
                style={{
                  // Source item: transform is handled directly on the DOM node (dragSourceElRef)
                  // Other items: squeeze animation via CSS transition
                  transform: isBeingDragged ? undefined : `translateY(${getShiftY(index)}px)`,
                  zIndex: isBeingDragged ? 100 : undefined,
                }}
              >
                <div className={`todo-item${todo.completed ? " completed" : ""}${isBeingDragged ? " is-source" : ""}`}>
                  {editingTodo === todo.id ? (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="input"
                        autoFocus
                      />
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="input select"
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                      <button onClick={saveEdit} className="btn btn-primary">保存</button>
                      <button onClick={() => setEditingTodo(null)} className="btn btn-secondary">取消</button>
                    </div>
                  ) : (
                    <>
                      {/* Drag Handle — always visible at low opacity */}
                      <div
                        className="drag-handle"
                        title="拖拽排序"
                        onMouseDown={(e) => handleHandleMouseDown(e, index)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.5" />
                          <circle cx="15" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" />
                          <circle cx="15" cy="19" r="1.5" />
                        </svg>
                      </div>
                      <div className="todo-content">
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleTodo(todo.id, todo.completed)}
                          />
                          <span className="checkmark"></span>
                        </label>
                        <div className="todo-title-area">
                          <span className={`todo-title ${todo.completed ? "completed" : ""}`}>
                            {todo.title}
                          </span>
                          <div className="todo-meta">
                            {getCategoryName(todo.categoryId) && (
                              <span
                                className="todo-category-tag"
                                style={{
                                  borderColor: getCategoryColor(todo.categoryId) || undefined,
                                  color: getCategoryColor(todo.categoryId) || undefined,
                                }}
                              >
                                {getCategoryName(todo.categoryId)}
                              </span>
                            )}
                            {todo.subtasks.length > 0 && (
                              <span className="subtask-progress">
                                {todo.subtasks.filter((s) => s.completed).length}/{todo.subtasks.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`priority-badge ${priorityColors[todo.priority]}`}>
                          {priorityLabels[todo.priority]}
                        </span>
                      </div>
                      <div className="todo-actions">
                        <button
                          onClick={() => setExpandedTodoId(todo.id)}
                          className={`icon-btn expand-btn ${expandedTodoId === todo.id ? "expanded" : ""}`}
                          title="子任务"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                        <button onClick={() => startEdit(todo.id, todo.title, todo.priority)} className="icon-btn">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteTodo(todo.id)} className="icon-btn delete">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Subtask Section */}
                {expandedTodoId === todo.id && (
                  <div className="subtask-section">
                    {todo.subtasks.length > 0 && (
                      <div className="subtask-list">
                        {todo.subtasks.map((subtask) => (
                          <div key={subtask.id} className={`subtask-item ${subtask.completed ? "completed" : ""}`}>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => toggleSubtask(todo.id, subtask.id, !subtask.completed)}
                              />
                              <span className="checkmark small"></span>
                            </label>
                            <span className={`subtask-title ${subtask.completed ? "completed" : ""}`}>
                              {subtask.title}
                            </span>
                            <button className="subtask-delete-btn" onClick={() => deleteSubtask(todo.id, subtask.id)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="subtask-add-row">
                      <input
                        type="text"
                        placeholder="添加子任务..."
                        value={expandedTodoId === todo.id ? newSubtaskTitle : ""}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => handleSubtaskKeyDown(e, todo.id)}
                        className="input subtask-input"
                      />
                      <button className="subtask-add-btn" onClick={() => handleAddSubtask(todo.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Todo Button / Form */}
      {showAddForm ? (
        <form onSubmit={handleAddTodo} className="add-form">
          <input
            type="text"
            placeholder="输入待办事项..."
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            className="input"
            autoFocus
          />
          <select
            value={newTodoPriority}
            onChange={(e) => setNewTodoPriority(e.target.value)}
            className="input select"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          {categories.length > 1 && (
            <select
              value={newTodoCategoryId ?? ""}
              onChange={(e) => setNewTodoCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="input select"
            >
              <option value="">无分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-primary">添加</button>
          <button type="button" onClick={cancelAddTodo} className="btn btn-secondary">取消</button>
        </form>
      ) : (
        <button onClick={() => setShowAddForm(true)} className="add-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加待办
        </button>
      )}
    </div>
  );
}

export default App;
