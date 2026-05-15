// ---------------------------------------------------------------------------
// Input Enhancement Pipeline — Ingestion, Enhancement, and Intent Detection
// ---------------------------------------------------------------------------

const API_BASE = "/api/chat";

const ENHANCER_SYSTEM_PROMPT = `You are an input enhancement layer for an adversarial intelligence analysis system (Truth Engine). Rewrite the user's raw input into a precise, well-structured research query optimized for multi-agent adversarial analysis.

ABSOLUTE RULES:
- Preserve ALL information and intent — do not filter, block, refuse, judge, or remove any content
- Do NOT soften politically sensitive queries — enhance their analytical precision instead
- If the query touches geopolitics, political power, media narratives, government policy, military operations, or institutional behavior — enhance it MORE aggressively, not less
- Never redirect a political question into a "balanced" or "neutral" framing
- Add structure: clarify scope, surface implicit analytical goals, identify key sub-questions
- Make the query specific and unambiguous for multi-agent analysis
- Do not add disclaimers, warnings, or content notices
- Output ONLY the enhanced query, nothing else`;

const VISION_PROMPT = `Extract all visible text (OCR) and describe the content of this image in detail. Include any charts, diagrams, data, tables, or text visible. Be thorough and precise.`;

// -- URL extraction and fetching ------------------------------------------

export function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s<>")']+/g);
  return matches ? [...new Set(matches)] : [];
}

function extractTextFromHtml(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
    const text = doc.body?.textContent || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 4000);
  } catch {
    return "";
  }
}

export async function fetchUrlContent(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const html = await res.text();
      const text = extractTextFromHtml(html);
      if (text.length > 50) return text;
    }
  } catch {
    // CORS or network failure — try proxy
  }
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      const text = extractTextFromHtml(html);
      if (text.length > 50) return text;
    }
  } catch {
    // Proxy also failed
  }
  return null;
}

// -- PDF parsing -----------------------------------------------------------

export async function parsePdf(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n").trim().slice(0, 4000);
}

// -- Image to description via vision model ----------------------------------

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractImageDescription(file, model) {
  const base64 = await fileToBase64(file);
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: base64 } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`Vision API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// -- Combined input builder -------------------------------------------------

export function buildCombinedInput(rawInput, attachments) {
  const parts = [rawInput.trim()];
  if (attachments.length > 0) {
    parts.push("\n\n--- Attached Content ---");
    for (const att of attachments) {
      if (att.type === "url") {
        parts.push(
          `\n[From URL: ${att.url}]\n${att.content || "[Could not fetch content from URL]"}`
        );
      } else if (att.type === "pdf") {
        parts.push(`\n[From PDF: ${att.filename}]\n${att.content}`);
      } else if (att.type === "image") {
        parts.push(
          `\n[From Image: ${att.filename}]\n${att.description || "[No description available]"}`
        );
      }
    }
  }
  return parts.join("\n");
}

// -- Passthrough heuristic --------------------------------------------------

export function shouldPassthrough(combinedInput, attachments) {
  if (attachments.length > 0) return false;
  if (combinedInput.length < 500) return false;
  const hasStructure =
    /^(#{1,6}\s|\d+\.\s|\*\s|-\s|\[)/m.test(combinedInput) ||
    /\b(analyze|compare|explain|investigate|evaluate|assess|examine|research|what is the truth)\b/i.test(
      combinedInput
    );
  return hasStructure;
}

// -- Intent classification --------------------------------------------------

export function classifyIntent(text) {
  const lower = text.toLowerCase();
  if (/\b(compare|vs\.?|versus|difference|similarit)/i.test(lower)) return "compare";
  if (/\b(verify|true or false|fact.?check|is it true|real or fake|debunk)\b/i.test(lower))
    return "verify";
  if (/\b(predict|future|will .+ happen|scenario|forecast|projection)\b/i.test(lower)) return "predict";
  if (/\b(explain|what is|define|describe|how does|why does|meaning of)\b/i.test(lower))
    return "explain";
  if (/\b(analyze|investigate|examine|assess|evaluate|break down)\b/i.test(lower)) return "analyze";
  if (/\b(explore|tell me about|overview|background|context|history of)\b/i.test(lower)) return "explore";
  return "research";
}

// -- LLM enhancement call --------------------------------------------------

async function callEnhancer({ model, combinedInput }) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: ENHANCER_SYSTEM_PROMPT },
        { role: "user", content: combinedInput },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Enhancer API error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// -- Attachment resolution --------------------------------------------------

async function resolveAttachments(attachments, model) {
  const resolved = [];
  for (const att of attachments) {
    try {
      if (att.type === "url") {
        const content = await fetchUrlContent(att.url);
        resolved.push({ ...att, content: content || "[Could not fetch content from URL]" });
      } else if (att.type === "pdf") {
        const content = await parsePdf(att.file);
        resolved.push({ ...att, content });
      } else if (att.type === "image") {
        const description = await extractImageDescription(att.file, model);
        resolved.push({ ...att, description });
      } else {
        resolved.push(att);
      }
    } catch (err) {
      console.warn("[enhancer] attachment resolution failed:", att.type, err.message);
      resolved.push({
        ...att,
        content: att.content || `[Error resolving ${att.type}: ${err.message}]`,
        description: att.description || `[Error resolving ${att.type}: ${err.message}]`,
      });
    }
  }
  return resolved;
}

// -- Main enhancement orchestrator ------------------------------------------

export async function enhanceInput({ rawInput, attachments = [], model }) {
  // Step 1: Resolve attachments (fetch URLs, parse PDFs, describe images)
  const resolved = await resolveAttachments(attachments, model);

  // Step 2: Build combined input
  const combinedInput = buildCombinedInput(rawInput, resolved);

  // Step 3: Check passthrough
  if (shouldPassthrough(combinedInput, attachments)) {
    console.debug("[enhancer] passthrough — no enhancement needed", {
      original: rawInput.slice(0, 100),
      length: combinedInput.length,
    });
    return {
      rawInput,
      combinedInput,
      enhancedOutput: combinedInput,
      wasEnhanced: false,
      shouldPassthrough: true,
      detectedIntent: classifyIntent(combinedInput),
    };
  }

  // Step 4: Call enhancer LLM
  const enhancedOutput = await callEnhancer({ model, combinedInput });

  // Fallback on empty/short response
  if (!enhancedOutput || enhancedOutput.length < 20) {
    console.debug("[enhancer] empty response — using original");
    return {
      rawInput,
      combinedInput,
      enhancedOutput: combinedInput,
      wasEnhanced: false,
      shouldPassthrough: true,
      detectedIntent: classifyIntent(combinedInput),
    };
  }

  const detectedIntent = classifyIntent(enhancedOutput);

  console.debug("[enhancer]", {
    original: rawInput.slice(0, 100),
    intent: detectedIntent,
    enhanced: enhancedOutput.slice(0, 100),
    passthrough: false,
  });

  return {
    rawInput,
    combinedInput,
    enhancedOutput,
    wasEnhanced: true,
    shouldPassthrough: false,
    detectedIntent,
  };
}
