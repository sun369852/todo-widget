// Todo item type definition
export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  dueDate?: string;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}
