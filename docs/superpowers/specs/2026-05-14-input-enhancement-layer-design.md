# Input Enhancement Layer — Design Spec

**Date:** 2026-05-14
**Project:** Truth Engine v3
**Scope:** Background input processing pipeline that intercepts raw user messages, enriches them, and passes enhanced queries to the swarm.

---

## Overview

Add a preprocessing layer between user input and swarm launch. Accepts text, URLs, PDFs, images (or any combination), extracts content, rewrites into a precise research query via LLM, and presents an editable preview before the swarm runs.

**Key constraints:**
- Client-side only (no backend). Uses same OpenRouter API key as swarm.
- Zero content filtering. Enhancement only — no blocking, no refusal.
- Smart passthrough: skip LLM call on already-clean input.

---

## Architecture

### Phase Flow

```
input → enhancing → preview → analyzing → compiling → report
```

New phase `"enhancing"` inserted between `"input"` and `"analyzing"`. New `"preview"` sub-state within the input phase where the user reviews the enhanced query.

### New Files

| File | Purpose |
|------|---------|
| `src/lib/enhancer.js` | Content extraction, URL fetch, PDF parse, image handling, passthrough heuristic, LLM enhancement call |
| `src/components/EnhancePreview.jsx` | Collapsible preview panel: original vs enhanced, edit capability, launch/edit-original actions |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.jsx` | New phase state `"enhancing"`, `handleEnhance` callback, pass enhanced question to `runAnalysis` |
| `src/components/InputForm.jsx` | Drop zone, URL chips, attachment strip, "Enhance & Review" button |
| `package.json` | Add `pdfjs-dist` dependency |

### Data Flow

```js
{
  rawInput: "user's typed text",
  attachments: [
    { type: "url", url: "https://...", content: "fetched text" },
    { type: "pdf", filename: "doc.pdf", content: "extracted text" },
    { type: "image", filename: "img.png", description: "vision model output" }
  ],
  combinedInput: "raw text + all extracted content merged",
  detectedIntent: "research|compare|explain|analyze|verify|predict|explore",
  enhancedOutput: "precise, well-structured query",
  wasEnhanced: true,
  shouldPassthrough: false
}
```

---

## Ingestion Layer

### Text

No processing. Pass through as-is.

### URL Detection

- Regex scan input for `https?://\S+`
- Fetch via `fetch()` — if CORS fails, fallback to `https://api.allorigins.win/raw?url=`
- Extract readable text via `DOMParser` → `<body>` textContent
- Truncate to ~4000 chars

### PDF Upload

- User drops/selects `.pdf` file in drop zone
- Parse client-side with `pdfjs-dist` (dynamic import)
- Extract all page text, truncate to ~4000 chars
- Store as `{ type: "pdf", filename, content }`

### Image Upload

- User drops/selects image (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)
- Read as base64 data URL
- Send to OpenRouter vision API for OCR/description
- Store as `{ type: "image", filename, description }`

### Combined Input Construction

```
[User's text message]

--- Attached Content ---

[From URL: https://example.com]
<extracted text>

[From PDF: document.pdf]
<extracted text>

[From Image: screenshot.png]
<vision model description>
```

---

## Enhancement Logic

### Passthrough Heuristic

Skip LLM call if ALL of:
- Combined input > 500 chars
- Contains structural markers (headings, numbered lists, or explicit action verbs like "analyze", "compare", "explain")
- No attachments were added

### LLM Enhancement Call

**System prompt:** "You are an input enhancement layer. Rewrite the user's raw input into a precise, well-structured research query optimized for multi-agent analysis. Preserve ALL information and intent — do not filter, block, refuse, or remove any content. Add structure, clarify scope, surface implicit goals. Output ONLY the enhanced query, nothing else."

**Input:** combined string from ingestion
**Model:** `openrouter/free` (same as swarm)
**Temperature:** 0.3

### Intent Detection

Classify into one of: `research`, `compare`, `explain`, `analyze`, `verify`, `predict`, `explore`. Used for logging only.

### Internal Log

```js
console.debug("[enhancer]", { original, intent, enhanced, passthrough });
```

---

## UI Design

### InputForm Changes

1. **Drop zone** — drag-and-drop area below textarea. Accepts PDFs and images. Shows attachment chips after upload (filename + remove button).

2. **URL auto-detection** — when user pastes text with URLs, show chips: `[https://example.com ×]`. Content fetched during enhancement, not on paste.

3. **Attachment strip** — horizontal strip between textarea and submit button. Chips for each attachment with type icon, filename, and remove button.

4. **Submit button** — changed from "Launch Swarm →" to "Enhance & Review →". Triggers the enhancement pipeline.

### EnhancePreview Component

Collapsible panel appearing below InputForm when enhancement completes.

**Expanded state:**
```
┌─────────────────────────────────────────────┐
│ ✨ Enhanced Query                    [▼]    │
├─────────────────────────────────────────────┤
│ [editable textarea with enhanced text]      │
│                                             │
│ Original: "check this url..."               │
│ Intent: research                            │
│                                             │
│ [Launch Swarm with This →]  [Edit Original] │
└─────────────────────────────────────────────┘
```

**Collapsed state:**
`✨ Enhanced query ready · "first 60 chars..." · [Expand]`

**Passthrough state:**
`✨ No enhancement needed — query already well-formed` with launch button directly.

- "Launch Swarm with This" sends the (potentially user-edited) enhanced text to `runAnalysis`
- "Edit Original" collapses preview, returns to input form preserving original text
- User can edit the enhanced text in the preview textarea

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Enhancement LLM fails | Fallback to raw combined input. Show warning: `Enhancement failed — using original input`. Never block swarm launch. |
| URL fetch fails | Include URL as plain text with `[Could not fetch content from URL]` note. |
| PDF parse fails | Chip shows error state (red border). User can remove. Does not block enhancement. |
| Image > 10MB | Reject with inline error. |
| Empty LLM response (< 20 chars) | Treat as passthrough, use original input. |
| No API key | Existing guard prevents submission. No special handling needed. |

---

## Dependencies

| Package | Size Impact | Notes |
|---------|-------------|-------|
| `pdfjs-dist` | ~300KB gzipped | Dynamic import — only loaded on PDF upload |

No other new dependencies. URL fetching via native `fetch`. Image handling via base64 + OpenRouter vision. `DOMParser` is built-in.

---

## Scope Exclusions

- No server-side processing
- No persistent storage of enhanced queries
- No content filtering or refusal logic
- No automatic enhancement on typing (only on submit)
- No attachment preview thumbnails for images (filename chip only)
