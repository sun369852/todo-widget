import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:todo.db");
    await initTables();
  }
  return db;
}

async function initTables() {
  const database = db!;

  // Create todos table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      category TEXT DEFAULT 'Default',
      due_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create categories table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1'
    )
  `);

  // Create subtasks table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    )
  `);

  // Migrate: add sort_order column to todos (ignore if already exists)
  try {
    await database.execute(`ALTER TABLE todos ADD COLUMN sort_order INTEGER DEFAULT 0`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migrate: add category_id column to todos (ignore if already exists)
  try {
    await database.execute(`ALTER TABLE todos ADD COLUMN category_id INTEGER`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Initialize sort_order for existing todos that have sort_order = 0
  await database.execute(`
    UPDATE todos SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL
  `);


}

// ===== Todo CRUD =====

export async function getTodos(): Promise<any[]> {
  const db = await getDb();
  return await db.select("SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC");
}

export async function addTodo(title: string, priority: string = 'medium', categoryId?: number): Promise<void> {
  const db = await getDb();
  // Get max sort_order
  const result: any[] = await db.select("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM todos");
  const newOrder = (result[0]?.max_order ?? 0) + 1;

  if (categoryId) {
    await db.execute(
      "INSERT INTO todos (title, priority, category_id, sort_order) VALUES (?, ?, ?, ?)",
      [title, priority, categoryId, newOrder]
    );
  } else {
    await db.execute(
      "INSERT INTO todos (title, priority, sort_order) VALUES (?, ?, ?)",
      [title, priority, newOrder]
    );
  }
}

export async function updateTodo(id: number, title: string, priority: string, category: string, dueDate?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET title = ?, priority = ?, category = ?, due_date = ? WHERE id = ?",
    [title, priority, category, dueDate || null, id]
  );
}

export async function toggleTodo(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE todos SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);
}

export async function deleteTodo(id: number): Promise<void> {
  const db = await getDb();
  // Delete subtasks first
  await db.execute("DELETE FROM subtasks WHERE todo_id = ?", [id]);
  await db.execute("DELETE FROM todos WHERE id = ?", [id]);
}

export async function reorderTodos(updates: { id: number; sort_order: number }[]): Promise<void> {
  const db = await getDb();
  for (const u of updates) {
    await db.execute("UPDATE todos SET sort_order = ? WHERE id = ?", [u.sort_order, u.id]);
  }
}

export async function updateTodoCategoryId(id: number, categoryId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE todos SET category_id = ? WHERE id = ?", [categoryId, id]);
}

// ===== Category CRUD =====

export async function getCategories(): Promise<any[]> {
  const db = await getDb();
  return await db.select("SELECT * FROM categories ORDER BY name");
}

export async function addCategory(name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO categories (name, color) VALUES (?, ?)", [name, color]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  // Move todos to null category before deleting
  await db.execute("UPDATE todos SET category_id = NULL WHERE category_id = ?", [id]);
  await db.execute("DELETE FROM categories WHERE id = ?", [id]);
}

// ===== Subtask CRUD =====

export async function getSubtasks(todoId: number): Promise<any[]> {
  const db = await getDb();
  return await db.select("SELECT * FROM subtasks WHERE todo_id = ? ORDER BY sort_order ASC, created_at ASC", [todoId]);
}

export async function addSubtask(todoId: number, title: string): Promise<void> {
  const db = await getDb();
  const result: any[] = await db.select(
    "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM subtasks WHERE todo_id = ?",
    [todoId]
  );
  const newOrder = (result[0]?.max_order ?? 0) + 1;
  await db.execute(
    "INSERT INTO subtasks (todo_id, title, sort_order) VALUES (?, ?, ?)",
    [todoId, title, newOrder]
  );
}

export async function toggleSubtask(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subtasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);
}

export async function deleteSubtask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM subtasks WHERE id = ?", [id]);
}
