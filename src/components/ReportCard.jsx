import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "../lib/agents";
import { parseReport, parseAgentResponse, aggregateConfidenceByCategory, renderFormattedText } from "../lib/parser.jsx";
import ConfidenceBar from "./ConfidenceBar";

const SECTION_ORDER = ["truth", "confidence", "hidden", "future", "dissent"];

const SECTION_META = {
  truth:      { icon: "🔍", title: "The Real Truth" },
  confidence: { icon: "📊", title: "Confidence Breakdown" },
  hidden:     { icon: "⚠️", title: "Hidden Factors" },
  future:     { icon: "🔮", title: "Future Predictions" },
  dissent:    { icon: "⚡", title: "Agent Dissent" },
};

export default function ReportCard({ results, question, onReset }) {
  const { rawResponses, groupSummaries, compiledReport, agentCount, timestamp } = results;
  const [copied, setCopied] = useState(false);
  const sectionRefs = useRef([]);

  const sections = parseReport(compiledReport);
  const categoryConfidence = aggregateConfidenceByCategory(rawResponses);

  const overallConfidence = categoryConfidence.length
    ? Math.round(categoryConfidence.reduce((s, c) => s + c.avgConfidence, 0) / categoryConfidence.length)
    : 0;

  const successCount = rawResponses.filter((r) => !r.error).length;

  useEffect(() => {
    sectionRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transitionDelay = `${i * 150}ms`;
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(compiledReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text">Truth Report</h2>
          <p className="text-xs text-text-dim mt-1">
            {new Date(timestamp).toLocaleString()} · {agentCount} agents · {successCount} successful
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs text-text-dim hover:text-text hover:border-border transition-all"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs text-text-dim hover:text-text hover:border-border transition-all"
          >
            New Analysis
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 mb-5">
        <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1.5 font-medium">Question</p>
        <p className="text-text text-sm leading-relaxed">{question}</p>
      </div>

      {/* Swarm Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-surface border border-border-subtle rounded-xl p-3 text-center">
          <p className="text-xl font-semibold text-text">{agentCount}</p>
          <p className="text-[10px] text-text-dim uppercase tracking-wider mt-0.5">Agents</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3 text-center">
          <p className="text-xl font-semibold text-accent">{successCount}</p>
          <p className="text-[10px] text-text-dim uppercase tracking-wider mt-0.5">Successful</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3 text-center">
          <p className="text-xl font-semibold text-text">{overallConfidence}%</p>
          <p className="text-[10px] text-text-dim uppercase tracking-wider mt-0.5">Confidence</p>
        </div>
      </div>

      {/* Sections */}
      {SECTION_ORDER.map((key, i) => {
        const content = sections[key];
        const meta = SECTION_META[key];

        if (key === "confidence") {
          return (
            <section
              key={key}
              ref={(el) => (sectionRefs.current[i] = el)}
              className="bg-surface border border-border-subtle rounded-xl p-5 mb-3 opacity-0 translate-y-3 transition-all duration-500"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.icon}</span>
                  <h3 className="text-sm font-semibold text-text uppercase tracking-wider">{meta.title}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-accent/8 text-accent text-xs font-medium">
                  {overallConfidence}%
                </span>
              </div>
              <div className="space-y-3">
                {categoryConfidence.map((cat, j) => (
                  <ConfidenceBar
                    key={cat.category}
                    label={cat.name}
                    value={cat.avgConfidence}
                    delay={j * 80}
                    subtitle={`${cat.agentCount} agents`}
                  />
                ))}
              </div>
            </section>
          );
        }

        return (
          <section
            key={key}
            ref={(el) => (sectionRefs.current[i] = el)}
            className="bg-surface border border-border-subtle rounded-xl p-5 mb-3 opacity-0 translate-y-3 transition-all duration-500"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{meta.icon}</span>
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">{meta.title}</h3>
            </div>
            <div className="bg-bg rounded-lg p-4 border border-border-subtle">
              {content ? (
                renderFormattedText(content)
              ) : (
                <p className="text-text-dim text-sm italic">This section was not generated in the report.</p>
              )}
            </div>
          </section>
        );
      })}

      {/* Group Summaries */}
      {groupSummaries && groupSummaries.length > 0 && (
        <details className="mt-3 bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium text-text-dim hover:text-text transition-colors">
            Category Summaries ({groupSummaries.length} groups)
          </summary>
          <div className="px-5 pb-5 space-y-3 border-t border-border-subtle pt-4">
            {groupSummaries.map((g, i) => (
              <div key={i} className={`bg-bg rounded-lg p-4 border ${g.error ? "border-danger/20" : "border-border-subtle"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-text text-sm">{g.category}</span>
                  <span className="text-[10px] text-text-dim">{g.count} agents</span>
                  {g.error && <span className="text-[10px] text-danger/80">Error</span>}
                </div>
                <pre className="text-[11px] text-text-dim whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {g.content}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Raw Agent Responses */}
      <details className="mt-3 bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium text-text-dim hover:text-text transition-colors">
          Raw Agent Responses ({rawResponses.length})
        </summary>
        <div className="px-5 pb-5 space-y-2 border-t border-border-subtle pt-4 max-h-96 overflow-y-auto">
          {rawResponses.slice(0, 100).map((r, i) => (
            <div key={i} className={`bg-bg rounded-lg p-3 border ${r.error ? "border-danger/20" : "border-border-subtle"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{r.emoji}</span>
                <span className="font-medium text-text text-xs">{r.name}</span>
                {r.content.match(/CONFIDENCE:\s*(\d+)%/i) && (
                  <span className="ml-auto text-[10px] text-accent">
                    {r.content.match(/CONFIDENCE:\s*(\d+)%/i)[1]}%
                  </span>
                )}
                {r.error && <span className="text-[10px] text-danger/80">Error</span>}
              </div>
              <pre className="text-[10px] text-text-dim whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                {r.content.slice(0, 500)}{r.content.length > 500 ? "\n..." : ""}
              </pre>
            </div>
          ))}
          {rawResponses.length > 100 && (
            <p className="text-center text-[11px] text-text-dim py-2">
              Showing 100 of {rawResponses.length.toLocaleString()} responses
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
