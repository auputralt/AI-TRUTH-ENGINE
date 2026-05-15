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

    if (req.method === "GET") {
      const db = getDb();
      const result = await db.execute({
        sql: "SELECT id, question, enhanced_question, agent_count, created_at FROM analyses ORDER BY created_at DESC LIMIT 50",
      });
      return res.json(result.rows);
    }

    if (req.method === "POST") {
      const { question, enhanced_question, agent_count, results_json, report_json, group_summaries_json } = req.body;
      if (!question) {
        return res.status(400).json({ error: "question required" });
      }

      const db = getDb();
      const result = await db.execute({
        sql: "INSERT INTO analyses (question, enhanced_question, agent_count, results_json, report_json, group_summaries_json) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          question,
          enhanced_question || null,
          agent_count || 8,
          results_json || null,
          report_json || null,
          group_summaries_json || null,
        ],
      });

      return res.json({ id: Number(result.lastInsertRowid), ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/history]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
