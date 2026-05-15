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

  if (!expanded) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div
          className="bg-surface border border-accent/20 rounded-xl p-4 cursor-pointer hover:border-accent/35 transition-all"
          onClick={() => setExpanded(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">
                  {result.wasEnhanced ? "Enhanced query ready" : "Query ready"}
                </p>
                <p className="text-xs text-text-dim mt-0.5 truncate">
                  &ldquo;{editedText.slice(0, 100)}{editedText.length > 100 ? "..." : ""}&rdquo;
                </p>
              </div>
            </div>
            <button className="text-xs text-text-dim hover:text-text shrink-0 ml-4">
              Expand
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-7">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {result.wasEnhanced ? "Enhanced Query" : "Query Review"}
          </h3>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-text-dim hover:text-text transition-colors"
          >
            Collapse
          </button>
        </div>

        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="w-full bg-bg border border-border-subtle rounded-xl px-4 py-3 text-text text-sm min-h-[120px] resize-y focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-text-dim">
          <span className="px-2 py-0.5 rounded-md bg-accent/8 text-accent">
            {intent}
          </span>
          {!result.wasEnhanced && (
            <span className="px-2 py-0.5 rounded-md bg-surface-2 text-text-dim">
              No changes
            </span>
          )}
          {result.error && (
            <span className="px-2 py-0.5 rounded-md bg-danger/8 text-danger/80">
              Enhancement failed
            </span>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onAccept(editedText)}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-8 rounded-xl transition-all text-sm active:scale-[0.98]"
          >
            Launch Swarm
          </button>
          <button
            onClick={onEditOriginal}
            className="px-5 py-3 rounded-xl border border-border hover:border-border text-text-dim hover:text-text text-sm transition-all"
          >
            Edit Original
          </button>
        </div>
      </div>
    </div>
  );
}
