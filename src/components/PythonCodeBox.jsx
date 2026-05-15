import { useState, useRef } from "react";

const DEFAULT_CODE = `# Default: print a greeting
print("Hello from Truth Engine!")
print("No custom code supplied — running default.")
`;

export default function PythonCodeBox({ onCodeResult }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const textareaRef = useRef(null);

  async function handleRun() {
    setRunning(true);
    setOutput(null);
    const codeToSend = code.trim() || DEFAULT_CODE;

    try {
      const res = await fetch("/api/run-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToSend }),
      });
      const data = await res.json();
      setOutput(data);
      if (onCodeResult) onCodeResult(data);
    } catch (err) {
      setOutput({ ok: false, stdout: "", stderr: err.message, exitCode: -1 });
    } finally {
      setRunning(false);
    }
  }

  function handleClear() {
    setCode("");
    setOutput(null);
  }

  return (
    <div className="border border-border-subtle rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-dim hover:text-text hover:bg-surface-2/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          Python Custom Code
          {!code.trim() && <span className="text-[10px] text-text-dim/50">(default)</span>}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border-subtle p-4 space-y-3 animate-fade-in">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={DEFAULT_CODE.trim()}
            spellCheck={false}
            className="w-full bg-bg border border-border-subtle rounded-lg px-4 py-3 text-text font-mono text-[13px] min-h-[120px] resize-y focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all placeholder:text-text-dim/25 leading-relaxed"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 disabled:opacity-40 font-medium text-xs px-4 py-2 rounded-lg transition-all active:scale-[0.97]"
            >
              {running ? (
                <div className="w-3 h-3 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              {running ? "Running..." : "Run Code"}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-text-dim/60 hover:text-text-dim px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Clear
            </button>

            <span className="text-[10px] text-text-dim/40 ml-auto">
              Empty = default script
            </span>
          </div>

          {output && (
            <div className={`rounded-lg border p-3 text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto ${
              output.ok
                ? "bg-success/5 border-success/15 text-success/80"
                : "bg-danger/5 border-danger/15 text-danger/80"
            }`}>
              {output.stdout && <div>{output.stdout}</div>}
              {output.stderr && <div className="text-danger/60 mt-1">{output.stderr}</div>}
              {!output.ok && !output.stderr && <div>Exit code: {output.exitCode}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
