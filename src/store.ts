import { create } from "zustand";
import { Todo, Subtask, Category } from "./types";
import * as db from "./services/database";

interface TodoStore {
  todos: Todo[];
  categories: Category[];
  filter: "all" | "active" | "completed";
  searchQuery: string;
  selectedCategoryId: number | null;
  expandedTodoId: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTodos: () => Promise<void>;
  loadCategories: () => Promise<void>;
  addTodo: (title: string, priority: string, categoryId?: number) => Promise<void>;
  updateTodo: (id: number, title: string, priority: string, category: string, dueDate?: string) => Promise<void>;
  toggleTodo: (id: number, completed: boolean) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  reorderTodos: (fromIndex: number, toIndex: number) => Promise<void>;
  addCategory: (name: string, color: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  setFilter: (filter: "all" | "active" | "completed") => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: number | null) => void;

  // Subtask actions
  setExpandedTodoId: (id: number | null) => void;
  loadSubtasks: (todoId: number) => Promise<void>;
  addSubtask: (todoId: number, title: string) => Promise<void>;
  toggleSubtask: (todoId: number, subtaskId: number, completed: boolean) => Promise<void>;
  deleteSubtask: (todoId: number, subtaskId: number) => Promise<void>;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  categories: [],
  filter: "all",
  searchQuery: "",
  selectedCategoryId: null,
  expandedTodoId: null,
  isLoading: false,
  error: null,

  loadTodos: async () => {
    set({ isLoading: true, error: null });
    try {
      const todos = await db.getTodos();
      set({
        todos: todos.map((t: any) => ({
          id: t.id,
          title: t.title,
          completed: Boolean(t.completed),
          priority: t.priority,
          category: t.category,
          categoryId: t.category_id ?? null,
          dueDate: t.due_date,
          sortOrder: t.sort_order ?? 0,
          subtasks: [],
          createdAt: t.created_at,
        })),
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await db.getCategories();
      set({
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        })),
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addTodo: async (title: string, priority: string, categoryId?: number) => {
    const previousTodos = get().todos;
    const maxOrder = previousTodos.reduce((max, t) => Math.max(max, t.sortOrder), 0);
    const newTodo: Todo = {
      id: Date.now(),
      title,
      completed: false,
      priority: priority as 'low' | 'medium' | 'high',
      category: 'Default',
      categoryId: categoryId ?? undefined,
      sortOrder: maxOrder + 1,
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    set({ todos: [...get().todos, newTodo] });
    try {
      await db.addTodo(title, priority, categoryId);
      // Silent reload: get real ID from DB without setting isLoading:true (avoids flicker)
      const freshTodos = await db.getTodos();
      const currentTodos = get().todos;
      set({
        todos: freshTodos.map((t: any) => ({
          id: t.id,
          title: t.title,
          completed: Boolean(t.completed),
          priority: t.priority,
          category: t.category,
          categoryId: t.category_id ?? null,
          dueDate: t.due_date,
          sortOrder: t.sort_order ?? 0,
          // Preserve any already-loaded subtasks
          subtasks: currentTodos.find((todo) => todo.id === t.id)?.subtasks ?? [],
          createdAt: t.created_at,
        })),
      });
    } catch (error) {
      set({ todos: previousTodos, error: String(error) });
    }
  },

  updateTodo: async (id, title, priority, category, dueDate) => {
    const previousTodos = get().todos;
    set({
      todos: get().todos.map((todo) =>
        todo.id === id ? { ...todo, title, priority: priority as 'low' | 'medium' | 'high', category, dueDate } : todo
      ),
    });
    try {
      await db.updateTodo(id, title, priority, category, dueDate);
    } catch (error) {
      set({ todos: previousTodos, error: String(error) });
    }
  },

  toggleTodo: async (id, completed) => {
    const previousTodos = get().todos;
    set({
      todos: get().todos.map((todo) =>
        todo.id === id ? { ...todo, completed } : todo
      ),
    });
    try {
      await db.toggleTodo(id, completed);
    } catch (error) {
      set({ todos: previousTodos, error: String(error) });
    }
  },

  deleteTodo: async (id) => {
    const previousTodos = get().todos;
    set({
      todos: get().todos.filter((todo) => todo.id !== id),
    });
    try {
      await db.deleteTodo(id);
    } catch (error) {
      set({ todos: previousTodos, error: String(error) });
    }
  },

  reorderTodos: async (fromIndex: number, toIndex: number) => {
    const todos = [...get().todos];
    const [moved] = todos.splice(fromIndex, 1);
    todos.splice(toIndex, 0, moved);

    // Re-assign sort_order
    const updated = todos.map((t, i) => ({ ...t, sortOrder: i + 1 }));
    set({ todos: updated });

    try {
      await db.reorderTodos(updated.map((t) => ({ id: t.id, sort_order: t.sortOrder })));
    } catch (error) {
      set({ error: String(error) });
      // Reload from DB on error
      await get().loadTodos();
    }
  },

  addCategory: async (name, color) => {
    try {
      await db.addCategory(name, color);
      await get().loadCategories();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteCategory: async (id) => {
    try {
      await db.deleteCategory(id);
      await get().loadCategories();
      await get().loadTodos();
      // If current filter was this category, reset
      if (get().selectedCategoryId === id) {
        set({ selectedCategoryId: null });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (categoryId) => set({ selectedCategoryId: categoryId }),

  setExpandedTodoId: (id) => {
    const currentExpanded = get().expandedTodoId;
    // Toggle: if same id, collapse; otherwise expand new
    set({ expandedTodoId: currentExpanded === id ? null : id });
    if (id !== null && currentExpanded !== id) {
      get().loadSubtasks(id);
    }
  },

  loadSubtasks: async (todoId: number) => {
    try {
      const subtasks = await db.getSubtasks(todoId);
      const mapped: Subtask[] = subtasks.map((s: any) => ({
        id: s.id,
        todoId: s.todo_id,
        title: s.title,
        completed: Boolean(s.completed),
        sortOrder: s.sort_order ?? 0,
        createdAt: s.created_at,
      }));
      set({
        todos: get().todos.map((todo) =>
          todo.id === todoId ? { ...todo, subtasks: mapped } : todo
        ),
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addSubtask: async (todoId: number, title: string) => {
    try {
      await db.addSubtask(todoId, title);
      await get().loadSubtasks(todoId);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  toggleSubtask: async (todoId: number, subtaskId: number, completed: boolean) => {
    // Optimistic update
    set({
      todos: get().todos.map((todo) =>
        todo.id === todoId
          ? {
            ...todo,
            subtasks: todo.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed } : s
            ),
          }
          : todo
      ),
    });
    try {
      await db.toggleSubtask(subtaskId, completed);
    } catch (error) {
      set({ error: String(error) });
      await get().loadSubtasks(todoId);
    }
  },

  deleteSubtask: async (todoId: number, subtaskId: number) => {
    // Optimistic update
    set({
      todos: get().todos.map((todo) =>
        todo.id === todoId
          ? { ...todo, subtasks: todo.subtasks.filter((s) => s.id !== subtaskId) }
          : todo
      ),
    });
    try {
      await db.deleteSubtask(subtaskId);
    } catch (error) {
      set({ error: String(error) });
      await get().loadSubtasks(todoId);
    }
  },
}));
