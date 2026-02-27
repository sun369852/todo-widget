import { useEffect, useState } from "react";
import { useTodoStore } from "./store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import BubbleWindow from "./components/BubbleWindow";
import "./App.css";

function App() {
  const {
    todos,
    filter,
    searchQuery,
    isLoading,
    error,
    loadTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    setFilter,
    setSearchQuery,
  } = useTodoStore();

  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState("medium");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [windowLabel, setWindowLabel] = useState<string>("");

  useEffect(() => {
    const getLabel = async () => {
      const label = getCurrentWindow().label;
      setWindowLabel(label);
    };
    getLabel();
    loadTodos();
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
    return matchesFilter && matchesSearch;
  });

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    await addTodo(newTodoTitle, newTodoPriority);
    setNewTodoTitle("");
    setNewTodoPriority("medium");
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
  };

  // Close window - hide main and show bubble via Tauri command
  const handleClose = async () => {
    await invoke("close_to_bubble");
  };

  // Window dragging - only on header, EXCLUDE buttons
  const handleDragMouseDown = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 排除 header-actions 区域（关闭按钮等），否则 startDragging 会拦截点击
    if (target.closest('.app-header') && !target.closest('.header-actions')) {
      await getCurrentWindow().startDragging();
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

  return (
    <div className="app-container" onMouseDown={handleDragMouseDown}>
      {/* --- Resize Handles for frameless transparent window --- */}
      <div className="resize-edge top" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('North'); }} />
      <div className="resize-edge bottom" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('South'); }} />
      <div className="resize-edge left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('West'); }} />
      <div className="resize-edge right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('East'); }} />
      <div className="resize-corner top-left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('NorthWest'); }} />
      <div className="resize-corner top-right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('NorthEast'); }} />
      <div className="resize-corner bottom-left" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('SouthWest'); }} />
      <div className="resize-corner bottom-right" onMouseDown={(e) => { e.stopPropagation(); getCurrentWindow().startResizeDragging('SouthEast'); }} />

      {/* Header */}
      <header className="app-header">
        <span className="app-title">待办</span>
        <div className="header-actions">
          <button onClick={handleClose} className="close-btn" title="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

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

      {/* Filter */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          全部
        </button>
        <button
          className={`filter-tab ${filter === "active" ? "active" : ""}`}
          onClick={() => setFilter("active")}
        >
          进行中
        </button>
        <button
          className={`filter-tab ${filter === "completed" ? "active" : ""}`}
          onClick={() => setFilter("completed")}
        >
          已完成
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          错误: {error}
        </div>
      )}

      {/* Todo List */}
      <div className="todo-list">
        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : filteredTodos.length === 0 ? (
          <div className="empty-state">暂无待办</div>
        ) : (
          filteredTodos.map((todo) => (
            <div key={todo.id} className={`todo-item ${todo.completed ? "completed" : ""}`}>
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
                  <div className="todo-content">
                    <label className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id, todo.completed)}
                      />
                      <span className="checkmark"></span>
                    </label>
                    <span className={`todo-title ${todo.completed ? "completed" : ""}`}>
                      {todo.title}
                    </span>
                    <span className={`priority-badge ${priorityColors[todo.priority]}`}>
                      {priorityLabels[todo.priority]}
                    </span>
                  </div>
                  <div className="todo-actions">
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
          ))
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
