export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.json({
    ok: true,
    hasKey: !!process.env.OPENROUTER_API_KEY,
    hasDb: !!(process.env.TURSO_URL && process.env.TURSO_AUTH_TOKEN),
  });
}
