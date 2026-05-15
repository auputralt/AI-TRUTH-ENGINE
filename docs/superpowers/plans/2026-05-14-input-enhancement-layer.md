# Input Enhancement Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preprocessing pipeline between user input and swarm launch that accepts text, URLs, PDFs, and images, enriches them via LLM, and presents an editable preview before the swarm runs.

**Architecture:** New `src/lib/enhancer.js` handles all extraction/enhancement logic. New `EnhancePreview.jsx` shows editable preview. `InputForm.jsx` gains drag-and-drop + URL chips. `App.jsx` adds `"enhancing"` phase between input and analysis.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, pdfjs-dist (PDF parsing), OpenRouter API (enhancement + vision)

---

### Task 1: Install pdfjs-dist

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd "/Users/mrputra/Documents/Project/Finish Project/The Truth"
npm install pdfjs-dist
```

- [ ] **Step 2: Verify installation**

Run: `node -e "const p = require('pdfjs-dist'); console.log('pdfjs-dist', p.version)"`
Expected: `pdfjs-dist 4.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdfjs-dist for client-side PDF text extraction"
```

---

### Task 2: Create `src/lib/enhancer.js`

**Files:**
- Create: `src/lib/enhancer.js`

- [ ] **Step 1: Write the complete enhancer module**

```js
// ---------------------------------------------------------------------------
// Input Enhancement Pipeline — Ingestion, Enhancement, and Intent Detection
// ---------------------------------------------------------------------------

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

const ENHANCER_SYSTEM_PROMPT = `You are an input enhancement layer. Rewrite the user's raw input into a precise, well-structured research query optimized for multi-agent adversarial analysis. Preserve ALL information and intent — do not filter, block, refuse, judge, or remove any content. Add structure, clarify scope, surface implicit goals, and make the query specific and unambiguous. Output ONLY the enhanced query, nothing else.`;

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

async function extractImageDescription(file, apiKey, model) {
  const base64 = await fileToBase64(file);
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
    },
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

async function callEnhancer({ apiKey, model, combinedInput }) {
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
    },
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

async function resolveAttachments(attachments, apiKey, model) {
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
        const description = await extractImageDescription(att.file, apiKey, model);
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

export async function enhanceInput({ rawInput, attachments = [], apiKey, model }) {
  // Step 1: Resolve attachments (fetch URLs, parse PDFs, describe images)
  const resolved = await resolveAttachments(attachments, apiKey, model);

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
  const enhancedOutput = await callEnhancer({ apiKey, model, combinedInput });

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
```

- [ ] **Step 2: Verify module loads**

Run: `npm run dev` — open browser console, check for import errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/enhancer.js
git commit -m "feat: add input enhancement pipeline module"
```

---

### Task 3: Create `src/components/EnhancePreview.jsx`

**Files:**
- Create: `src/components/EnhancePreview.jsx`

- [ ] **Step 1: Write the EnhancePreview component**

```jsx
import { useState } from "react";

const INTENT_LABELS = {
  research: "Research",
  compare: "Comparison",
  explain: "Explanation",
  analyze: "Analysis",
  verify: "Verification",
  predict: "Prediction",
  explore: "Exploration",
};

export default function EnhancePreview({ result, onAccept, onEditOriginal }) {
  const [expanded, setExpanded] = useState(true);
  const [editedText, setEditedText] = useState(result.enhancedOutput);

  const intent = INTENT_LABELS[result.detectedIntent] || result.detectedIntent;

  // Collapsed state
  if (!expanded) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div
          className="bg-surface/60 backdrop-blur-xl border border-accent/40 rounded-2xl p-5 cursor-pointer hover:border-accent/60 transition-colors"
          onClick={() => setExpanded(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-accent shrink-0">✨</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {result.wasEnhanced ? "Enhanced query ready" : "Query ready"}
                </p>
                <p className="text-xs text-text-dim mt-0.5 font-mono truncate">
                  &ldquo;{editedText.slice(0, 100)}{editedText.length > 100 ? "..." : ""}&rdquo;
                </p>
              </div>
            </div>
            <button className="text-xs text-accent hover:text-accent/80 font-medium shrink-0 ml-4">
              Expand ▼
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <div className="bg-surface/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>✨</span>
            {result.wasEnhanced ? "Enhanced Query" : "Query Review"}
          </h3>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-text-dim hover:text-text transition-colors"
          >
            Collapse ▲
          </button>
        </div>

        {/* Editable enhanced text */}
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="w-full bg-bg border border-border/60 rounded-xl px-5 py-4 text-text text-base min-h-[120px] resize-y focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors"
        />

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-text-dim">
          <span className="px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
            {intent}
          </span>
          {!result.wasEnhanced && (
            <span className="px-2 py-0.5 rounded bg-border/30 text-text-dim">
              passthrough — no changes
            </span>
          )}
          {result.error && (
            <span className="px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">
              enhancement failed — using original
            </span>
          )}
          <span className="truncate max-w-xs">
            Original: &ldquo;{result.rawInput.slice(0, 60)}{result.rawInput.length > 60 ? "..." : ""}&rdquo;
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onAccept(editedText)}
            className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold py-3.5 px-8 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-accent/20 hover:shadow-accent/40 active:scale-[0.98]"
          >
            Launch Swarm with This →
          </button>
          <button
            onClick={onEditOriginal}
            className="px-6 py-3.5 rounded-xl border border-border hover:border-text-dim text-text-dim hover:text-text text-sm transition-colors"
          >
            Edit Original
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EnhancePreview.jsx
git commit -m "feat: add EnhancePreview component with editable query panel"
```

---

### Task 4: Modify `src/components/InputForm.jsx`

**Files:**
- Modify: `src/components/InputForm.jsx`

Add drag-and-drop file handling, URL auto-detection chips, attachment strip, and change the submit button to "Enhance & Review". Props gain `attachments`, `onAttachmentsChange`, `loadingLabel`.

- [ ] **Step 1: Add new imports and constants**

Add `useMemo` and `useState` to the React import, and add file handling constants after the existing `SWARM_PRESETS` array.

Replace line 1:
```jsx
import { useRef } from "react";
```
With:
```jsx
import { useRef, useState, useMemo } from "react";
```

After line 11 (after `SWARM_PRESETS`), add:
```jsx
const ACCEPTED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.gif";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
```

- [ ] **Step 2: Update component signature**

Replace the existing function signature and add new state/handlers.

Replace the entire component function from line 22 to line 29:
```jsx
export default function InputForm({ question, onQuestionChange, apiKey, onApiKeyChange, agentCount, onAgentCountChange, concurrency, onConcurrencyChange, onSubmit, isLoading }) {
  const textareaRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (question.trim() && apiKey.trim()) onSubmit();
  }
```

With:
```jsx
export default function InputForm({
  question, onQuestionChange,
  apiKey, onApiKeyChange,
  agentCount, onAgentCountChange,
  concurrency, onConcurrencyChange,
  onSubmit, isLoading, loadingLabel,
  attachments, onAttachmentsChange,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (question.trim() && apiKey.trim()) onSubmit();
  }

  function handleFiles(files) {
    const newAttachments = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      if (file.type === "application/pdf") {
        newAttachments.push({ type: "pdf", file, filename: file.name });
      } else if (ACCEPTED_FILE_TYPES.includes(file.type)) {
        newAttachments.push({ type: "image", file, filename: file.name });
      }
    }
    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e) {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function removeAttachment(index) {
    const next = [...attachments];
    next.splice(index, 1);
    onAttachmentsChange(next);
  }
```

- [ ] **Step 3: Add URL detection and update variables**

After the `removeAttachment` function (just added), find line with `const needsKey` and `const perCategory`, and add `urls`:

After:
```jsx
  const needsKey = !apiKey.trim();
  const perCategory = Math.floor(agentCount / CATEGORIES.length);
```

Add:
```jsx
  const urls = useMemo(() => {
    const matches = question.match(/https?:\/\/[^\s<>")']+/g);
    return matches ? [...new Set(matches)] : [];
  }, [question]);
```

- [ ] **Step 4: Add URL chips after the settings `<details>` block**

After the closing `</details>` tag of the settings section (around line 134), and before `<form onSubmit={handleSubmit}>`, insert:

```jsx
        {/* URL chips */}
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {urls.map((url, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-lg text-[11px] text-accent font-mono max-w-[300px] truncate"
              >
                🔗 {url}
              </span>
            ))}
          </div>
        )}
```

- [ ] **Step 5: Add attachment chips and drop zone inside the form**

After the `<textarea>` element and before the `<div className="flex flex-col sm:flex-row gap-3">` (the button area), insert:

```jsx
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border/60 rounded-lg text-xs text-text-dim"
                >
                  {att.type === "pdf" ? "📄" : "🖼️"} {att.filename}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="text-text-dim/60 hover:text-danger ml-0.5 leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-accent bg-accent/10 text-accent"
                : "border-border/40 hover:border-accent/40 text-text-dim"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-sm">
              {dragOver ? "Drop files here…" : "Drop PDFs or images here, or click to browse"}
            </p>
            <p className="text-[10px] text-text-dim/50 mt-1">PDF, PNG, JPG, WebP, GIF — max 10MB each</p>
          </div>
```

- [ ] **Step 6: Update submit button text**

Replace the button text:
```jsx
              {isLoading ? "Launching Swarm…" : `Launch ${agentCount}-Agent Swarm →`}
```
With:
```jsx
              {isLoading ? (loadingLabel || "Processing…") : "Enhance & Review →"}
```

- [ ] **Step 7: Update footer text**

Replace:
```jsx
            Powered by openrouter/free · {agentCount} agents · {concurrency} concurrent · tiered compilation
```
With:
```jsx
            Queries enhanced before reaching the swarm · {agentCount} agents · {concurrency} concurrent · tiered compilation
```

- [ ] **Step 8: Commit**

```bash
git add src/components/InputForm.jsx
git commit -m "feat: add drag-drop file upload, URL chips, and enhancement trigger to InputForm"
```

---

### Task 5: Modify `src/App.jsx`

**Files:**
- Modify: `src/App.jsx`

Add import for `enhanceInput` and `EnhancePreview`, add `"enhancing"` phase, `attachments` state, `enhancedResult` state, `handleEnhance` callback, `handleLaunchSwarm` callback, and wire `EnhancePreview` into the render.

- [ ] **Step 1: Add imports**

After line 2:
```jsx
import AgentLoader from "./components/AgentLoader";
```
Add:
```jsx
import EnhancePreview from "./components/EnhancePreview";
```

After line 5:
```jsx
import { generateAgents, runSwarm, compileSwarmResults, DEFAULT_MODEL } from "./lib/agents";
```
Add:
```jsx
import { enhanceInput } from "./lib/enhancer";
```

- [ ] **Step 2: Add new state variables**

After line 21 (`const [question, setQuestion] = useState("");`), add:
```jsx
  const [attachments, setAttachments] = useState([]);
  const [enhancedResult, setEnhancedResult] = useState(null);
```

- [ ] **Step 3: Add enhancement handler**

After the existing `useEffect` cleanup (line 32) and before the `runAnalysis` callback, insert:

```jsx
  const handleEnhance = useCallback(async () => {
    if (!question.trim() || !apiKey.trim()) return;
    setPhase("enhancing");
    setError(null);
    try {
      const result = await enhanceInput({
        rawInput: question,
        attachments,
        apiKey,
        model: DEFAULT_MODEL,
      });
      setEnhancedResult(result);
      setPhase("input");
    } catch (err) {
      console.warn("[enhancer] enhancement failed, using original:", err.message);
      setEnhancedResult({
        rawInput: question,
        combinedInput: question,
        enhancedOutput: question,
        wasEnhanced: false,
        shouldPassthrough: true,
        detectedIntent: "research",
        error: err.message,
      });
      setPhase("input");
    }
  }, [question, attachments, apiKey]);
```

- [ ] **Step 4: Add launch swarm and edit original handlers**

After `handleEnhance`, add:

```jsx
  const handleLaunchSwarm = useCallback(async (enhancedQuestion) => {
    if (!enhancedQuestion.trim() || !apiKey.trim()) return;
    const controller = new AbortController();
    setAbortRef(controller);
    setPhase("analyzing");
    setError(null);
    setResults(null);
    setEnhancedResult(null);
    setProgress({ completed: 0, total: agents.length, currentAgent: "" });
    setCompilePhase("");
    try {
      const rawResponses = await runSwarm({
        agents, apiKey, model: DEFAULT_MODEL,
        question: enhancedQuestion, concurrency,
        onProgress: (p) => setProgress(p),
      });
      if (controller.signal.aborted) return;
      setPhase("compiling");
      setCompilePhase("Compiling category groups...");
      const { compiledReport, groupSummaries } = await compileSwarmResults({
        apiKey, model: DEFAULT_MODEL, results: rawResponses,
        onProgress: (p) => setCompilePhase(p.message),
        onGroupDone: (done, total) => setCompilePhase(`Compiling group ${done}/${total}...`),
      });
      setResults({
        rawResponses, groupSummaries, compiledReport,
        agentCount: agents.length,
        timestamp: new Date().toISOString(),
      });
      setPhase("report");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message);
      setPhase("input");
    } finally {
      setAbortRef(null);
    }
  }, [apiKey, agentCount, concurrency, agents]);

  const handleEditOriginal = useCallback(() => {
    setEnhancedResult(null);
  }, []);
```

- [ ] **Step 5: Update handleReset to clear new state**

Replace the existing `handleReset` function:
```jsx
  const handleReset = () => {
    abortRef?.abort();
    setPhase("input");
    setQuestion("");
    setResults(null);
    setError(null);
    setProgress({ completed: 0, total: 0, currentAgent: "" });
    setCompilePhase("");
  };
```
With:
```jsx
  const handleReset = useCallback(() => {
    abortRef?.abort();
    setPhase("input");
    setQuestion("");
    setAttachments([]);
    setEnhancedResult(null);
    setResults(null);
    setError(null);
    setProgress({ completed: 0, total: 0, currentAgent: "" });
    setCompilePhase("");
  }, []);
```

- [ ] **Step 6: Remove old runAnalysis callback**

Delete the entire old `runAnalysis` callback (the original one starting with `const runAnalysis = useCallback(async () => {` through its closing `}, [question, apiKey, agentCount, concurrency, agents]);`). This is replaced by `handleLaunchSwarm`.

- [ ] **Step 7: Update header status display for "enhancing" phase**

Replace the pulse dot classes:
```jsx
              phase === "analyzing" ? "animate-agent-pulse bg-accent"
              : phase === "compiling" ? "animate-agent-pulse bg-gold"
              : phase === "report" ? "bg-success"
              : "bg-border"
```
With:
```jsx
              phase === "enhancing" ? "animate-agent-pulse bg-purple"
              : phase === "analyzing" ? "animate-agent-pulse bg-accent"
              : phase === "compiling" ? "animate-agent-pulse bg-gold"
              : phase === "report" ? "bg-success"
              : "bg-border"
```

Replace the status text:
```jsx
              {phase === "input" ? "STANDBY" : phase === "analyzing" ? "ANALYZING" : phase === "compiling" ? "COMPILING" : "REPORT READY"}
```
With:
```jsx
              {phase === "input" ? "STANDBY" : phase === "enhancing" ? "ENHANCING" : phase === "analyzing" ? "ANALYZING" : phase === "compiling" ? "COMPILING" : "REPORT READY"}
```

- [ ] **Step 8: Update the main content render**

Replace the existing `<main>` content block (from `{phase === "input" && (` through the closing of the report section):

```jsx
      <main className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {phase === "input" && (
          <InputForm
            question={question}
            onQuestionChange={setQuestion}
            apiKey={apiKey}
            onApiKeyChange={(val) => { setApiKey(val); saveStorage(STORAGE_KEY_API, val); }}
            agentCount={agentCount}
            onAgentCountChange={(val) => { setAgentCount(val); saveStorage(STORAGE_KEY_COUNT, String(val)); }}
            concurrency={concurrency}
            onConcurrencyChange={(val) => { setConcurrency(val); saveStorage(STORAGE_KEY_CONCURRENCY, String(val)); }}
            onSubmit={runAnalysis}
            isLoading={phase === "analyzing"}
          />
        )}

        {(phase === "analyzing" || phase === "compiling") && (
          <AgentLoader
            progress={progress}
            question={question}
            compilePhase={compilePhase}
            isCompiling={phase === "compiling"}
            agentCount={agentCount}
          />
        )}

        {phase === "report" && results && (
          <ReportCard results={results} question={question} onReset={handleReset} />
        )}
      </main>
```

With:

```jsx
      <main className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {phase === "enhancing" && (
          <div className="max-w-3xl mx-auto animate-fade-in-up text-center py-20">
            <div className="inline-block mb-4 animate-agent-pulse">
              <div className="w-12 h-12 rounded-full bg-purple/20 flex items-center justify-center border border-purple/40 mx-auto">
                <span className="text-2xl">✨</span>
              </div>
            </div>
            <p className="text-white font-bold text-lg">Enhancing your query…</p>
            <p className="text-text-dim text-sm mt-2">Extracting content and optimizing for swarm analysis</p>
          </div>
        )}

        {phase === "input" && !enhancedResult && (
          <InputForm
            question={question}
            onQuestionChange={setQuestion}
            apiKey={apiKey}
            onApiKeyChange={(val) => { setApiKey(val); saveStorage(STORAGE_KEY_API, val); }}
            agentCount={agentCount}
            onAgentCountChange={(val) => { setAgentCount(val); saveStorage(STORAGE_KEY_COUNT, String(val)); }}
            concurrency={concurrency}
            onConcurrencyChange={(val) => { setConcurrency(val); saveStorage(STORAGE_KEY_CONCURRENCY, String(val)); }}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onSubmit={handleEnhance}
            isLoading={false}
            loadingLabel="Enhancing…"
          />
        )}

        {phase === "input" && enhancedResult && (
          <EnhancePreview
            result={enhancedResult}
            onAccept={handleLaunchSwarm}
            onEditOriginal={handleEditOriginal}
          />
        )}

        {(phase === "analyzing" || phase === "compiling") && (
          <AgentLoader
            progress={progress}
            question={enhancedResult?.enhancedOutput || question}
            compilePhase={compilePhase}
            isCompiling={phase === "compiling"}
            agentCount={agentCount}
          />
        )}

        {phase === "report" && results && (
          <ReportCard results={results} question={enhancedResult?.enhancedOutput || question} onReset={handleReset} />
        )}
      </main>
```

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire enhancement pipeline into App with new enhancing phase"
```

---

### Task 6: Build and Verify

- [ ] **Step 1: Run build to check for errors**

```bash
cd "/Users/mrputra/Documents/Project/Finish Project/The Truth"
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and test the flow**

```bash
npm run dev
```

Manual test checklist:
1. Open the app in browser
2. Type a short vague query (e.g., "south china sea") → click "Enhance & Review" → should show enhancing spinner → should show preview with enhanced query
3. Edit the enhanced text in the preview textarea → click "Launch Swarm with This" → should proceed to analysis
4. Click "Edit Original" → should return to input form
5. Type a long structured query (>500 chars with headings) → click "Enhance & Review" → should show "passthrough" badge, no enhancement
6. Paste a URL into the textarea → should show URL chip below
7. Drag a PDF onto the drop zone → should show PDF attachment chip
8. Drag an image onto the drop zone → should show image attachment chip
9. Remove an attachment chip via × button
10. Add multiple attachments + text + URL → enhance → verify combined content in preview
11. Check browser console for `[enhancer]` debug logs showing original → intent → enhanced

- [ ] **Step 3: Fix any issues found during testing**

Address any bugs or UX issues discovered.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: address issues from integration testing"
```
