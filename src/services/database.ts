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

  // Insert default category if not exists
  await database.execute(`
    INSERT OR IGNORE INTO categories (name, color) VALUES ('Default', '#6366f1')
  `);
}

// Todo CRUD operations
export async function getTodos(): Promise<any[]> {
  const db = await getDb();
  return await db.select("SELECT * FROM todos ORDER BY created_at DESC");
}

export async function addTodo(title: string, priority: string = 'medium', category: string = 'Default', dueDate?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO todos (title, priority, category, due_date) VALUES (?, ?, ?, ?)",
    [title, priority, category, dueDate || null]
  );
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
  await db.execute("DELETE FROM todos WHERE id = ?", [id]);
}

// Category operations
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
  // Move todos to Default category before deleting
  await db.execute("UPDATE todos SET category = 'Default' WHERE category = (SELECT name FROM categories WHERE id = ?)", [id]);
  await db.execute("DELETE FROM categories WHERE id = ?", [id]);
}
