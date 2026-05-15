import { CATEGORIES } from "../lib/agents";

export default function AgentLoader({ progress, question, compilePhase, isCompiling, agentCount }) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const done = progress.completed >= progress.total && progress.total > 0;

  const perCategory = progress.total > 0 ? Math.floor(progress.total / CATEGORIES.length) : 0;
  const categoryProgress = CATEGORIES.map((cat, i) => {
    const catStart = i * perCategory;
    const catEnd = catStart + perCategory + (i < progress.total % CATEGORIES.length ? 1 : 0);
    const catCompleted = Math.min(Math.max(progress.completed - catStart, 0), catEnd - catStart);
    const catTotal = catEnd - catStart;
    return { ...cat, completed: catCompleted, total: catTotal, pct: catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0 };
  });

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${
          isCompiling
            ? "bg-gold/8 text-gold border border-gold/15"
            : "bg-accent/8 text-accent border border-accent/15"
        }`}>
          <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
            isCompiling
              ? "border-gold/30 border-t-gold"
              : "border-accent/30 border-t-accent"
          }`} />
          {isCompiling ? "Compiling" : "Swarm active"}
        </div>
        <h2 className="text-xl font-semibold text-text mb-2">
          {question.length > 80 ? question.slice(0, 80) + "..." : question}
        </h2>
        <p className="text-text-dim text-sm">
          {isCompiling
            ? compilePhase || "Synthesizing results..."
            : `${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()} agents reporting`}
        </p>
      </div>

      {/* Progress Bar */}
      {!isCompiling && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-text-dim">Progress</span>
            <span className="text-xs text-accent font-medium">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-dim/60">
            <span>{progress.completed.toLocaleString()} completed</span>
            <span>{agentCount - progress.completed} remaining</span>
          </div>
        </div>
      )}

      {/* Compiling progress */}
      {isCompiling && (
        <div className="mb-8 p-4 rounded-xl bg-surface border border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">Tiered Compilation</p>
              <p className="text-[11px] text-text-dim">{compilePhase || "Processing..."}</p>
            </div>
          </div>
          <div className="mt-3 w-full h-1 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full" style={{ width: "100%", opacity: 0.5 }} />
          </div>
        </div>
      )}

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categoryProgress.map((cat) => (
          <div
            key={cat.id}
            className={`rounded-xl p-3 border transition-all duration-500 ${
              cat.pct >= 100
                ? "bg-surface border-accent/20"
                : cat.pct > 0
                ? "bg-surface border-accent/30"
                : isCompiling
                ? "bg-surface/50 border-border-subtle"
                : "bg-surface/30 border-border-subtle opacity-40"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{cat.emoji}</span>
              <div>
                <div className={`text-xs font-medium ${
                  cat.pct >= 100 ? "text-accent" : cat.pct > 0 ? "text-text" : "text-text-dim"
                }`}>
                  {cat.name}
                </div>
                <div className="text-[10px] text-text-dim">
                  {cat.completed}/{cat.total}
                </div>
              </div>
            </div>

            <div className="h-1 bg-bg rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${
                cat.pct >= 100 ? "w-full bg-accent" : cat.pct > 0 ? "bg-accent/70" : "w-0"
              }`} style={{ width: `${cat.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Phase indicator */}
      {done && !isCompiling && (
        <div className="mt-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-accent/15 text-accent text-sm">
            <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Launching tiered compilation...
          </div>
        </div>
      )}
    </div>
  );
}
