const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { model, messages, temperature, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages required" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not set" });
    }

    const referer = req.headers.origin || req.headers.referer || "https://truth-engine.vercel.app";

    const response = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": referer,
      },
      body: JSON.stringify({
        model: model || "openrouter/free",
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      return res.status(response.status).json({ error: `${response.status} ${err.slice(0, 300)}` });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("[/api/chat]", err.message);
    return res.status(502).json({ error: err.message });
  }
}
