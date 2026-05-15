import { useRef, useState, useMemo } from "react";
import { CATEGORIES } from "../lib/agents";
import PythonCodeBox from "./PythonCodeBox";

const SWARM_PRESETS = [
  { label: "Quick", count: 8 },
  { label: "Standard", count: 50 },
  { label: "Deep", count: 200 },
  { label: "Maximum", count: 1000 },
];

const ACCEPTED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.gif";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FEATURES = [
  { icon: "⚡", title: "Up to 1,000 Agents", desc: "8 adversarial categories, scaled to 125 per category" },
  { icon: "🔓", title: "First Principles", desc: "Each agent reasons independently from scratch" },
  { icon: "📊", title: "Confidence Scored", desc: "Category-level aggregation with consensus metrics" },
  { icon: "🔮", title: "Future Predictions", desc: "Probabilistic scenarios with trigger events" },
  { icon: "🔄", title: "Tiered Compilation", desc: "Groups compile first, then final synthesis" },
  { icon: "🛡️", title: "Resilient", desc: "Retry with backoff, graceful degradation" },
];

export default function InputForm({
  question, onQuestionChange,
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
    if (question.trim()) onSubmit();
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

  const perCategory = Math.floor(agentCount / CATEGORIES.length);

  const urls = useMemo(() => {
    const matches = question.match(/https?:\/\/[^\s<>")']+/g);
    return matches ? [...new Set(matches)] : [];
  }, [question]);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {/* Hero */}
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-text tracking-tight mb-4">
          What is the truth
          <br />
          <span className="text-accent">behind...</span>
        </h2>
        <p className="text-text-dim text-sm max-w-md mx-auto leading-relaxed">
          One question. Up to 1,000 adversarial AI agents. Zero consensus assumed.
          Type anything and let the swarm tear it apart.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-7">
        {/* Settings */}
        <details className="mb-5 group">
          <summary className="cursor-pointer text-sm text-text-dim hover:text-text select-none font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </summary>
          <div className="mt-4 space-y-5 pt-4 border-t border-border-subtle">
            {/* Agent Count */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-text-dim font-medium">Agent Count</label>
                <span className="text-xs font-mono text-accent">{agentCount} agents ({perCategory}/category)</span>
              </div>
              <input
                type="range"
                min="8"
                max="1000"
                step="1"
                value={agentCount}
                onChange={(e) => onAgentCountChange(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between mt-2 gap-1">
                {SWARM_PRESETS.map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => onAgentCountChange(preset.count)}
                    className={`text-[11px] font-medium px-3 py-1 rounded-lg transition-all ${
                      agentCount === preset.count
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-text-dim hover:text-text hover:bg-surface-2"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Concurrency */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-text-dim font-medium">Concurrency</label>
                <span className="text-xs font-mono text-accent">{concurrency} parallel</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={concurrency}
                onChange={(e) => onConcurrencyChange(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-text-dim/50">1 (sequential)</span>
                <span className="text-[10px] text-text-dim/50">100 (max)</span>
              </div>
            </div>

            <p className="text-[10px] text-text-dim/60">
              Model: openrouter/free (auto-routed, zero cost). Higher agent counts = more API calls.
            </p>
          </div>
        </details>

        {/* URL chips */}
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {urls.map((url, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/8 border border-accent/15 rounded-lg text-[11px] text-accent font-mono max-w-[280px] truncate"
              >
                <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {url}
              </span>
            ))}
          </div>
        )}

        {/* Question Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="What is the truth behind the geopolitical conflict in the South China Sea?"
              className="w-full bg-bg border border-border-subtle rounded-xl px-5 py-4 text-text text-[15px] min-h-[100px] resize-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all placeholder:text-text-dim/35 leading-relaxed"
              required
            />
          </div>

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 rounded-lg text-xs text-text-dim"
                >
                  {att.type === "pdf" ? "📄" : "🖼️"} {att.filename}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="text-text-dim/40 hover:text-danger ml-0.5 leading-none"
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
            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-accent/50 bg-accent/5 text-accent"
                : "border-border-subtle hover:border-border text-text-dim/60 hover:text-text-dim"
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
              {dragOver ? "Drop files here" : "Drop PDFs or images, or click to browse"}
            </p>
            <p className="text-[10px] text-text-dim/40 mt-1">PDF, PNG, JPG, WebP, GIF — max 10MB</p>
          </div>

          {/* Python Custom Code Box */}
          <PythonCodeBox />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-8 rounded-xl transition-all text-sm active:scale-[0.98]"
            >
              {isLoading ? (loadingLabel || "Processing...") : "Enhance & Review"}
            </button>
          </div>

          <p className="text-[10px] text-text-dim/35 text-center">
            {agentCount} agents · {concurrency} concurrent · tiered compilation
          </p>
        </form>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-10">
        {FEATURES.map((feat, i) => (
          <div key={i} className="bg-surface/50 border border-border-subtle rounded-xl p-4 hover:border-border transition-colors">
            <div className="text-lg mb-2">{feat.icon}</div>
            <h3 className="font-medium text-text text-xs mb-1">{feat.title}</h3>
            <p className="text-[11px] text-text-dim leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
