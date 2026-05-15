import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getDb, ensureSchema } from "./api/lib/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

// -- DB init -----------------------------------------------------------------

let schemaReady = false;
async function initDb() {
  if (schemaReady) return;
  try {
    await ensureSchema();
    schemaReady = true;
    console.log("DB schema ready");
  } catch (err) {
    console.warn("DB not available (history disabled):", err.message);
  }
}

function hasDb() {
  return !!(process.env.TURSO_URL && process.env.TURSO_AUTH_TOKEN);
}

// -- OpenRouter proxy --------------------------------------------------------

async function proxyToOpenRouter(body, referer) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set on server");

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer || "http://localhost:5173",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`${res.status} ${err.slice(0, 300)}`);
  }

  return res.json();
}

app.post("/api/chat", async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages required" });
    }

    const data = await proxyToOpenRouter(
      { model: model || "openrouter/free", messages, temperature, max_tokens },
      req.headers.origin,
    );
    res.json(data);
  } catch (err) {
    console.error("[/api/chat]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// -- Python exec (local dev only) -------------------------------------------

app.post("/api/run-python", async (req, res) => {
  try {
    const { code } = req.body;
    if (typeof code !== "string") {
      return res.status(400).json({ error: "code string required" });
    }

    const { execFile } = await import("node:child_process");
    const tmpFile = `/tmp/truth-engine-user-${Date.now()}.py`;

    await import("node:fs/promises").then((fs) => fs.writeFile(tmpFile, code, "utf8"));

    execFile("python3", ["-u", tmpFile], { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      import("node:fs/promises").then((fs) => fs.unlink(tmpFile).catch(() => {}));
      if (err) {
        return res.json({ ok: false, stdout: stdout || "", stderr: stderr || err.message, exitCode: err.code || 1 });
      }
      res.json({ ok: true, stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
    });
  } catch (err) {
    console.error("[/api/run-python]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -- History API -------------------------------------------------------------

app.get("/api/history", async (_req, res) => {
  if (!hasDb()) return res.json([]);
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT id, question, enhanced_question, agent_count, created_at FROM analyses ORDER BY created_at DESC LIMIT 50",
    });
    res.json(result.rows);
  } catch (err) {
    console.error("[GET /api/history]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/history", async (req, res) => {
  if (!hasDb()) return res.json({ ok: false, error: "DB not configured" });
  try {
    const { question, enhanced_question, agent_count, results_json, report_json, group_summaries_json } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

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
    res.json({ id: Number(result.lastInsertRowid), ok: true });
  } catch (err) {
    console.error("[POST /api/history]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history/:id", async (req, res) => {
  if (!hasDb()) return res.status(404).json({ error: "DB not configured" });
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM analyses WHERE id = ?",
      args: [Number(req.params.id)],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[GET /api/history/:id]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  if (!hasDb()) return res.json({ ok: false });
  try {
    const db = getDb();
    await db.execute({ sql: "DELETE FROM analyses WHERE id = ?", args: [Number(req.params.id)] });
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/history/:id]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -- Health ------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENROUTER_API_KEY, hasDb: hasDb() });
});

// -- Static files (production) ----------------------------------------------

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// -- Start -------------------------------------------------------------------

app.listen(PORT, async () => {
  console.log(`Truth Engine backend on http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("WARNING: OPENROUTER_API_KEY not set in .env");
  }
  await initDb();
});
