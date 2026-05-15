export default function ConfidenceBar({ label, value, subtitle, delay = 0 }) {
  const colorClass =
    value >= 75 ? "bg-accent"
    : value >= 50 ? "bg-accent/70"
    : value >= 25 ? "bg-gold"
    : "bg-danger/70";

  return (
    <div
      className="flex items-center gap-4 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-28 shrink-0">
        <span className="text-sm text-text-dim block text-right font-medium leading-tight">{label}</span>
        {subtitle && <span className="text-[10px] text-text-dim/50 block text-right">{subtitle}</span>}
      </div>
      <div className="flex-1 h-5 bg-bg rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`}
          style={{ width: `${Math.max(value, 2)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-2.5">
          <span className="text-[10px] font-medium text-white/90">
            {value}%
          </span>
        </div>
      </div>
    </div>
  );
}
