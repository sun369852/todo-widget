import { create } from "zustand";
import { Todo, Category } from "./types";
import * as db from "./services/database";

interface TodoStore {
  todos: Todo[];
  categories: Category[];
  filter: "all" | "active" | "completed";
  searchQuery: string;
  selectedCategory: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTodos: () => Promise<void>;
  loadCategories: () => Promise<void>;
  addTodo: (title: string, priority: string) => Promise<void>;
  updateTodo: (id: number, title: string, priority: string, category: string, dueDate?: string) => Promise<void>;
  toggleTodo: (id: number, completed: boolean) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  addCategory: (name: string, color: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  setFilter: (filter: "all" | "active" | "completed") => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  categories: [],
  filter: "all",
  searchQuery: "",
  selectedCategory: "All",
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
          dueDate: t.due_date,
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

  addTodo: async (title: string, priority: string) => {
    // 乐观更新：先添加本地状态
    const newTodo: Todo = {
      id: Date.now(),
      title,
      completed: false,
      priority: priority as 'low' | 'medium' | 'high',
      category: 'Default',
      createdAt: new Date().toISOString(),
    };
    const previousTodos = get().todos;
    set({ todos: [newTodo, ...get().todos] });
    try {
      await db.addTodo(title, priority);
    } catch (error) {
      // 回滚状态
      set({ todos: previousTodos, error: String(error) });
    }
  },

  updateTodo: async (id, title, priority, category, dueDate) => {
    // 乐观更新：先更新本地状态
    const previousTodos = get().todos;
    set({
      todos: get().todos.map((todo) =>
        todo.id === id ? { ...todo, title, priority: priority as 'low' | 'medium' | 'high', category, dueDate } : todo
      ),
    });
    try {
      await db.updateTodo(id, title, priority, category, dueDate);
    } catch (error) {
      // 回滚状态
      set({ todos: previousTodos, error: String(error) });
    }
  },

  toggleTodo: async (id, completed) => {
    // 乐观更新：先更新本地状态
    const previousTodos = get().todos;
    set({
      todos: get().todos.map((todo) =>
        todo.id === id ? { ...todo, completed } : todo
      ),
    });
    try {
      await db.toggleTodo(id, completed);
    } catch (error) {
      // 回滚状态
      set({ todos: previousTodos, error: String(error) });
    }
  },

  deleteTodo: async (id) => {
    // 乐观更新：先更新本地状态
    const previousTodos = get().todos;
    set({
      todos: get().todos.filter((todo) => todo.id !== id),
    });
    try {
      await db.deleteTodo(id);
    } catch (error) {
      // 回滚状态
      set({ todos: previousTodos, error: String(error) });
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
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
}));
