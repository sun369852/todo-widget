// Todo item type definition
export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  categoryId?: number;
  dueDate?: string;
  sortOrder: number;
  subtasks: Subtask[];
  createdAt: string;
}

export interface Subtask {
  id: number;
  todoId: number;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}
