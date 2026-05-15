import { useState, useCallback, useEffect, useMemo } from "react";
import InputForm from "./components/InputForm";
import AgentLoader from "./components/AgentLoader";
import ReportCard from "./components/ReportCard";
import EnhancePreview from "./components/EnhancePreview";
import HistoryPanel from "./components/HistoryPanel";
import { generateAgents, runSwarm, compileSwarmResults, DEFAULT_MODEL } from "./lib/agents";
import { enhanceInput } from "./lib/enhancer";

const STORAGE_KEY_COUNT = "truthEngineAgentCount";
const STORAGE_KEY_CONCURRENCY = "truthEngineConcurrency";

function loadStorage(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function saveStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export default function App() {
  const [phase, setPhase] = useState("input"); // input | enhancing | analyzing | compiling | report
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [enhancedResult, setEnhancedResult] = useState(null);
  const [agentCount, setAgentCount] = useState(() => parseInt(loadStorage(STORAGE_KEY_COUNT, "8"), 10));
  const [concurrency, setConcurrency] = useState(() => parseInt(loadStorage(STORAGE_KEY_CONCURRENCY, "20"), 10));
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, currentAgent: "" });
  const [compilePhase, setCompilePhase] = useState("");
  const [abortRef, setAbortRef] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);

  const agents = useMemo(() => generateAgents(agentCount), [agentCount]);

  useEffect(() => { return () => abortRef?.abort(); }, [abortRef]);

  const saveToHistory = useCallback(async (questionText, enhancedQuestion, swarmResults) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionText,
          enhanced_question: enhancedQuestion,
          agent_count: swarmResults.agentCount,
          results_json: JSON.stringify(swarmResults.rawResponses),
          report_json: swarmResults.compiledReport,
          group_summaries_json: JSON.stringify(swarmResults.groupSummaries),
        }),
      });
      setHistorySaved(true);
    } catch (err) {
      console.warn("[history] save failed:", err.message);
    }
  }, []);

  const handleEnhance = useCallback(async () => {
    if (!question.trim()) return;
    setPhase("enhancing");
    setError(null);
    try {
      const result = await enhanceInput({
        rawInput: question,
        attachments,
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
  }, [question, attachments]);

  const handleLaunchSwarm = useCallback(async (enhancedQuestion) => {
    if (!enhancedQuestion.trim()) return;

    const controller = new AbortController();
    setAbortRef(controller);

    setPhase("analyzing");
    setError(null);
    setResults(null);
    setEnhancedResult(null);
    setProgress({ completed: 0, total: agents.length, currentAgent: "" });
    setCompilePhase("");
    setHistorySaved(false);

    try {
      const rawResponses = await runSwarm({
        agents,
        model: DEFAULT_MODEL,
        question: enhancedQuestion,
        concurrency,
        onProgress: (p) => setProgress(p),
      });

      if (controller.signal.aborted) return;

      setPhase("compiling");
      setCompilePhase("Compiling category groups...");

      const { compiledReport, groupSummaries } = await compileSwarmResults({
        model: DEFAULT_MODEL,
        results: rawResponses,
        onProgress: (p) => setCompilePhase(p.message),
        onGroupDone: (done, total) => setCompilePhase(`Compiling group ${done}/${total}...`),
      });

      const swarmResults = {
        rawResponses,
        groupSummaries,
        compiledReport,
        agentCount: agents.length,
        timestamp: new Date().toISOString(),
      };

      setResults(swarmResults);
      setPhase("report");

      saveToHistory(question, enhancedQuestion, swarmResults);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message);
      setPhase("input");
    } finally {
      setAbortRef(null);
    }
  }, [agentCount, concurrency, agents, question, saveToHistory]);

  const handleLoadFromHistory = useCallback((fullItem) => {
    const swarmResults = {
      rawResponses: fullItem.results_json ? JSON.parse(fullItem.results_json) : [],
      groupSummaries: fullItem.group_summaries_json ? JSON.parse(fullItem.group_summaries_json) : [],
      compiledReport: fullItem.report_json || "",
      agentCount: fullItem.agent_count || 8,
      timestamp: fullItem.created_at,
    };
    setQuestion(fullItem.question);
    setResults(swarmResults);
    setEnhancedResult(null);
    setPhase("report");
    setShowHistory(false);
    setHistorySaved(true);
  }, []);

  const handleEditOriginal = useCallback(() => {
    setEnhancedResult(null);
  }, []);

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
    setHistorySaved(false);
  }, []);

  const swarmLabel = agentCount >= 1000 ? "Mega Swarm" : agentCount >= 100 ? "Large Swarm" : agentCount >= 20 ? "Swarm" : "Micro Swarm";

  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col items-center">
      {/* Header */}
      <header className="w-full border-b border-border-subtle">
        <div className="max-w-4xl mx-auto w-full px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-text">Truth Engine</h1>
              <p className="text-[11px] text-text-dim">
                {agentCount}-Agent {swarmLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-xs text-text-dim hover:text-text px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              title="Analysis History"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                phase === "enhancing" ? "animate-smooth-pulse bg-purple"
                : phase === "analyzing" ? "animate-smooth-pulse bg-accent"
                : phase === "compiling" ? "animate-smooth-pulse bg-gold"
                : phase === "report" ? "bg-success"
                : "bg-border"
              }`} />
              <span className="text-xs text-text-dim">
                {phase === "input" ? "Ready" : phase === "enhancing" ? "Enhancing" : phase === "analyzing" ? "Analyzing" : phase === "compiling" ? "Compiling" : "Report ready"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && phase === "input" && (
        <div className="max-w-3xl mx-auto px-5 mt-6 animate-fade-in">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Analysis failed</p>
              <p className="text-danger/70 text-xs mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-danger/40 hover:text-danger text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-5 py-8">
        {phase === "enhancing" && (
          <div className="max-w-3xl mx-auto animate-fade-in text-center py-20">
            <div className="w-10 h-10 rounded-full bg-purple/10 border border-purple/20 flex items-center justify-center mx-auto mb-4">
              <div className="w-4 h-4 border-2 border-purple/40 border-t-purple rounded-full animate-spin" />
            </div>
            <p className="text-text font-medium text-base">Enhancing your query</p>
            <p className="text-text-dim text-sm mt-2">Optimizing for swarm analysis</p>
          </div>
        )}

        {phase === "input" && !enhancedResult && (
          <InputForm
            question={question}
            onQuestionChange={setQuestion}
            agentCount={agentCount}
            onAgentCountChange={(val) => { setAgentCount(val); saveStorage(STORAGE_KEY_COUNT, String(val)); }}
            concurrency={concurrency}
            onConcurrencyChange={(val) => { setConcurrency(val); saveStorage(STORAGE_KEY_CONCURRENCY, String(val)); }}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onSubmit={handleEnhance}
            isLoading={false}
            loadingLabel="Enhancing..."
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

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel onLoad={handleLoadFromHistory} onClose={() => setShowHistory(false)} />
      )}

      {/* Footer */}
      <footer className="w-full border-t border-border-subtle text-center py-6 text-xs text-text-dim">
        <p>Truth Engine v3 — Adversarial multi-agent analysis. No consensus assumed.</p>
      </footer>
    </div>
  );
}
