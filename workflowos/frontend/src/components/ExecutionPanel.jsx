import { useEffect, useRef, useState } from "react";
import {
  Loader2, CheckCircle2, XCircle, Circle, MinusCircle, ShieldAlert, Send, Ban,
} from "lucide-react";
import AppIcon from "./AppIcon";
import { api } from "../services/api";

const STEP_LABELS = {
  read_email: "Read email",
  identify_customer: "Identify customer",
  download_attachment: "Download attachment",
  find_customer: "Find customer in CRM",
  update_customer: "Update customer record",
  send_notification: "Send notification",
  review_manually: "Manual review",
};

function stepLabel(stepType) {
  return STEP_LABELS[stepType] || stepType.replace(/_/g, " ");
}

const TERMINAL_STATUSES = ["success", "failed"];

function StepRow({ step }) {
  const icon = {
    pending: <Circle size={14} className="text-ink-500" />,
    running: <Loader2 size={14} className="text-violet-400 animate-spin" />,
    success: <CheckCircle2 size={14} className="text-teal-400" />,
    failed: <XCircle size={14} className="text-rose-400" />,
    skipped: <MinusCircle size={14} className="text-ink-500" />,
  }[step.status] || <Circle size={14} className="text-ink-500" />;

  return (
    <li className="flex items-center gap-2.5 text-[13px] py-1">
      {icon}
      <span className={step.status === "failed" ? "text-rose-400" : "text-ink-100"}>
        {stepLabel(step.step_type)}
      </span>
      {step.status === "failed" && step.error_message && (
        <span className="text-[11px] text-ink-500">— {step.error_message}</span>
      )}
    </li>
  );
}

/**
 * Renders live, polling execution progress for one WorkflowExecution, and —
 * when the execution is parked in "needs_intervention" — a human-in-the-loop
 * form to resolve it (requirement #11) so the run can continue.
 *
 * Self-contained: give it an executionId and it fetches + polls on its own.
 */
export default function ExecutionPanel({ executionId, initialExecution, onUpdate, compact = false }) {
  const [execution, setExecution] = useState(initialExecution || null);
  const [customerInput, setCustomerInput] = useState("");
  const [resolving, setResolving] = useState(null); // "retry" | "cancel" | null
  const [resolveError, setResolveError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await api.getExecution(executionId);
        if (cancelled) return;
        setExecution(data);
        onUpdate?.(data);
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(intervalRef.current);
        }
      } catch {
        // transient network hiccup — keep polling, don't blow up the UI
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 700);
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  if (!execution) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-ink-500 py-2">
        <Loader2 size={13} className="animate-spin" /> Starting execution…
      </div>
    );
  }

  const handleResolve = async (action) => {
    setResolveError(null);
    setResolving(action);
    try {
      const updated = await api.resolveExecution(executionId, {
        action,
        customerName: customerInput || undefined,
      });
      setExecution(updated);
      onUpdate?.(updated);
      if (action === "retry" && !intervalRef.current) {
        intervalRef.current = setInterval(async () => {
          const data = await api.getExecution(executionId);
          setExecution(data);
          onUpdate?.(data);
          if (TERMINAL_STATUSES.includes(data.status)) clearInterval(intervalRef.current);
        }, 700);
      }
    } catch (err) {
      setResolveError(err.message || "Could not resolve execution");
    } finally {
      setResolving(null);
    }
  };

  const statusMeta = {
    pending: { label: "Queued", cls: "text-ink-500" },
    running: { label: "Running", cls: "text-violet-400" },
    success: { label: "Completed", cls: "text-teal-400" },
    failed: { label: "Failed", cls: "text-rose-400" },
    needs_intervention: { label: "Needs your input", cls: "text-amber-400" },
  }[execution.status] || { label: execution.status, cls: "text-ink-500" };

  return (
    <div className={compact ? "" : "rounded-xl border border-base-border bg-base-surface2/50 p-4"}>
      <div className="flex items-center justify-between mb-2.5">
        <p className={`text-[13px] font-medium ${statusMeta.cls}`}>{statusMeta.label}</p>
        {execution.duration_seconds != null && (
          <span className="text-[11px] text-ink-500 font-mono">
            {execution.duration_seconds.toFixed(1)}s
          </span>
        )}
      </div>

      <ul>
        {execution.steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
        {execution.steps.length === 0 && (
          <li className="text-[12px] text-ink-500 py-1">Waiting for the first step to start…</li>
        )}
      </ul>

      {execution.status === "needs_intervention" && (
        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3.5">
          <div className="flex items-start gap-2 mb-2.5">
            <ShieldAlert size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[12.5px] text-ink-100 leading-relaxed">
              {execution.error_message || "A step needs a human to resolve it before continuing."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AppIcon application="crm" size={13} />
            <input
              value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              placeholder="Correct customer name"
              className="flex-1 min-w-[160px] rounded-lg bg-base-surface border border-base-border px-2.5 py-1.5 text-[13px] text-ink-100 focus:outline-none focus:border-violet-400"
            />
            <button
              onClick={() => handleResolve("retry")}
              disabled={resolving !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-[12.5px] font-medium disabled:opacity-50"
            >
              {resolving === "retry" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Resolve &amp; continue
            </button>
            <button
              onClick={() => handleResolve("cancel")}
              disabled={resolving !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 text-[12.5px] font-medium disabled:opacity-50"
            >
              {resolving === "cancel" ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
              Cancel run
            </button>
          </div>
          {resolveError && <p className="text-[11px] text-rose-400 mt-2">{resolveError}</p>}
        </div>
      )}
    </div>
  );
}
