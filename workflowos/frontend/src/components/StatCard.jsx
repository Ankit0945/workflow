export default function StatCard({ label, value, sublabel, icon: Icon, accent = "violet" }) {
  const accentMap = {
    violet: "text-violet-400 bg-violet-500/10",
    teal: "text-teal-400 bg-teal-500/10",
    amber: "text-amber-400 bg-amber-400/10",
  };

  return (
    <div className="rounded-2xl border border-base-border bg-base-surface p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-500">{label}</span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div>
        <div className="text-3xl font-display font-semibold text-ink-100 tabular-nums">{value}</div>
        {sublabel && <div className="text-[12px] text-ink-500 mt-1">{sublabel}</div>}
      </div>
    </div>
  );
}
