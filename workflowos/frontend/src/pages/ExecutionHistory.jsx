import { useCallback, useEffect, useState } from "react";
import {
  History, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, ShieldAlert, Clock3, RefreshCcw,
} from "lucide-react";
import Layout from "../components/Layout";
import ExecutionPanel from "../components/ExecutionPanel";
import { api } from "../services/api";

function formatDateTime(ts) {
  try {
    return new Date(ts).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

const STATUS_META = {
  pending: { icon: Clock3, cls: "text-ink-500", label: "Queued" },
  running: { icon: Loader2, cls: "text-violet-400", label: "Running", spin: true },
  success: { icon: CheckCircle2, cls: "text-teal-400", label: "Success" },
  failed: { icon: XCircle, cls: "text-rose-400", label: "Failed" },
  needs_intervention: { icon: ShieldAlert, cls: "text-amber-400", label: "Needs input" },
};

function ExecutionRow({ execution, expandedId, setExpandedId }) {
  const meta = STATUS_META[execution.status] || STATUS_META.pending;
  const Icon = meta.icon;
  const isExpanded = expandedId === execution.id;

  return (
    <div className="rounded-2xl border border-base-border bg-base-surface overflow-hidden">
      <button
        onClick={() => setExpandedId(isExpanded ? null : execution.id)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-base-surface2/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={16} className={`${meta.cls} shrink-0 ${meta.spin ? "animate-spin" : ""}`} />
          <div className="min-w-0">
            <p className="text-[13.5px] text-ink-100 font-medium truncate">
              {execution.workflow_name || "Workflow"}
            </p>
            <p className="text-[11.5px] text-ink-500">{formatDateTime(execution.started_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className={`text-[12px] font-medium ${meta.cls}`}>{meta.label}</span>
          <span className="text-[11px] text-ink-500 font-mono w-10 text-right">
            {execution.duration_seconds != null ? `${execution.duration_seconds.toFixed(1)}s` : "–"}
          </span>
          {isExpanded ? <ChevronUp size={15} className="text-ink-500" /> : <ChevronDown size={15} className="text-ink-500" />}
        </div>
      </button>
      {isExpanded && (
        <div className="px-5 pb-5">
          <ExecutionPanel executionId={execution.id} initialExecution={execution} compact />
        </div>
      )}
    </div>
  );
}

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listExecutions();
      setExecutions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout
      title="Execution History"
      subtitle="Every past workflow run, with status and timing."
      actions={
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-base-border text-ink-500 hover:text-ink-100 hover:border-violet-400/40 text-[13px] transition-colors"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
          Could not reach the backend ({error}). Is it running on the expected port?
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-ink-500 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading executions...
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-border bg-base-surface/50 p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-10">
          <div className="w-12 h-12 rounded-xl bg-base-surface2 border border-base-border flex items-center justify-center mb-4">
            <History size={20} className="text-ink-500" />
          </div>
          <h3 className="font-display font-semibold text-ink-100 mb-1.5">No executions yet</h3>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Run an active automation from the Automation page to see it appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {executions.map((execution) => (
            <ExecutionRow
              key={execution.id}
              execution={execution}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
