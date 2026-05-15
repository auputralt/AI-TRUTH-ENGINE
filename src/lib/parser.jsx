import React from "react";

const SECTION_PATTERNS = [
  { key: "truth", regex: /##\s*THE REAL TRUTH\s*\n([\s\S]*?)(?=\n##\s|$)/ },
  { key: "confidence", regex: /##\s*CONFIDENCE BREAKDOWN\s*\n([\s\S]*?)(?=\n##\s|$)/ },
  { key: "hidden", regex: /##\s*HIDDEN FACTORS\s*\n([\s\S]*?)(?=\n##\s|$)/ },
  { key: "future", regex: /##\s*FUTURE PREDICTION\s*\n([\s\S]*?)(?=\n##\s|$)/ },
  { key: "dissent", regex: /##\s*AGENT DISSENT\s*\n([\s\S]*?)(?=\n##\s|$)/ },
];

const FIELD_PATTERNS = [
  [/ANALYSIS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "analysis"],
  [/CONCLUSION:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "conclusion"],
  [/CONFIDENCE:\s*(\d+)%/i, "confidence"],
  [/CONTEXT:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "context"],
  [/PATTERNS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "patterns"],
  [/DATA_POINTS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "data"],
  [/STATISTICAL_ASSESSMENT:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "stats"],
  [/POWER_MAP:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "powers"],
  [/MOTIVE_ANALYSIS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "motives"],
  [/OUTCOME_ASSESSMENT:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "outcome"],
  [/COUNTER_NARRATIVE:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "counter"],
  [/EVIDENCE_FOR_CONTRARIAN_VIEW:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "evidence"],
  [/LOGICAL_FLAWS_IN_CONSENSUS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "flaws"],
  [/PATTERNS_IDENTIFIED:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "patterns"],
  [/CONNECTIONS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "connections"],
  [/SYSTEMIC_ASSESSMENT:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "systemic"],
  [/SCENARIO_HIGH:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "scenarioHigh"],
  [/SCENARIO_MEDIUM:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "scenarioMedium"],
  [/SCENARIO_LOW:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "scenarioLow"],
  [/KEY_TRIGGERS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "triggers"],
  [/SOURCE_ASSESSMENT:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "sources"],
  [/MANIPULATION_INDICATORS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "manipulation"],
  [/MISSING_INFORMATION:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "missing"],
  [/NARRATIVE_CONTROLLERS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "narrative"],
  [/HIDDEN_FACTORS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i, "hidden"],
];

export function parseReport(compiledReport) {
  const sections = {};
  for (const { key, regex } of SECTION_PATTERNS) {
    const match = compiledReport.match(regex);
    if (match) sections[key] = match[1].trim();
  }
  return sections;
}

export function parseAgentResponse(content) {
  const fields = {};
  for (const [regex, key] of FIELD_PATTERNS) {
    const match = content.match(regex);
    if (match) fields[key] = match[1]?.trim();
  }
  if (fields.confidence) fields.confidence = parseInt(fields.confidence, 10);
  return fields;
}

// Aggregate confidence by category from swarm results
export function aggregateConfidenceByCategory(rawResponses) {
  const byCategory = {};
  for (const r of rawResponses) {
    if (r.error) continue;
    const parsed = parseAgentResponse(r.content);
    if (!parsed.confidence) continue;
    const cat = r.category || "unknown";
    if (!byCategory[cat]) byCategory[cat] = { sum: 0, count: 0, emoji: r.emoji, name: r.name.split(" #")[0] };
    byCategory[cat].sum += parsed.confidence;
    byCategory[cat].count++;
  }

  return Object.entries(byCategory).map(([cat, { sum, count, emoji, name }]) => ({
    category: cat,
    name: name || cat,
    emoji: emoji || "📌",
    avgConfidence: Math.round(sum / count),
    agentCount: count,
  }));
}

export function renderFormattedText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return <li key={i} className="ml-2 list-disc">{trimmed.slice(2)}</li>;
    }
    return <p key={i} className="mb-1">{trimmed}</p>;
  });
}
