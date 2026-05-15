import { getDb, ensureSchema } from "../lib/db.js";

let schemaReady = false;

async function init() {
  if (!schemaReady) {
    await ensureSchema();
    schemaReady = true;
  }
}

export default async function handler(req, res) {
  try {
    await init();
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });

    const db = getDb();

    if (req.method === "GET") {
      const result = await db.execute({
        sql: "SELECT * FROM analyses WHERE id = ?",
        args: [Number(id)],
      });
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json(result.rows[0]);
    }

    if (req.method === "DELETE") {
      await db.execute({
        sql: "DELETE FROM analyses WHERE id = ?",
        args: [Number(id)],
      });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/history/:id]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
