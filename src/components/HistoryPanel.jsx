import { useState, useEffect, useCallback } from "react";

export default function HistoryPanel({ onLoad, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this analysis?")) return;
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleLoad(item) {
    try {
      const res = await fetch(`/api/history/${item.id}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const full = await res.json();
      onLoad(full);
    } catch (err) {
      console.error("Load failed:", err);
    }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso + (iso.includes("Z") ? "" : "Z"));
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-surface border-l border-border-subtle flex flex-col animate-slide-in-right h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </h2>
          <button onClick={onClose} className="text-text-dim/60 hover:text-text text-xl leading-none p-1">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="px-5 py-8 text-center">
              <p className="text-danger text-sm">{error}</p>
              <button onClick={fetchHistory} className="mt-3 text-xs text-accent hover:underline">Retry</button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="text-text-dim text-sm">No analyses yet</p>
              <p className="text-text-dim/50 text-xs mt-1">Run your first swarm to see history here</p>
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="border-b border-border-subtle/50 hover:bg-surface-2/30 transition-colors cursor-pointer"
              onClick={() => handleLoad(item)}
            >
              <div className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-text leading-snug line-clamp-2 flex-1">
                    {item.question}
                  </p>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="text-text-dim/30 hover:text-danger shrink-0 p-1 text-xs"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-text-dim/50">{formatDate(item.created_at)}</span>
                  <span className="text-[10px] text-accent/60 font-mono">{item.agent_count} agents</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.25s ease-out forwards; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
