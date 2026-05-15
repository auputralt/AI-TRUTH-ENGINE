import { createClient } from "@libsql/client";

let _db = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("TURSO_URL and TURSO_AUTH_TOKEN env vars required");
  }

  _db = createClient({ url, authToken });
  return _db;
}

export async function ensureSchema() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      enhanced_question TEXT,
      agent_count INTEGER DEFAULT 8,
      results_json TEXT,
      report_json TEXT,
      group_summaries_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
