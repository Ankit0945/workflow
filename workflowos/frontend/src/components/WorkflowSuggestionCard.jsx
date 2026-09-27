import { useState } from "react";
import {
  Sparkles, Check, X, PlayCircle, Loader2, ChevronDown, ChevronUp,
  ArrowRight, ShieldAlert, Pencil, Undo2,
} from "lucide-react";
import AppIcon from "./AppIcon";
import WorkflowStepEditor from "./WorkflowStepEditor";
import ExecutionPanel from "./ExecutionPanel";
import { api } from "../services/api";

function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-base-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-teal-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-ink-500 font-mono">{pct}%</span>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: { label: "Awaiting review", cls: "bg-amber-400/10 text-amber-400" },
    approved: { label: "Approved", cls: "bg-teal-500/10 text-teal-400" },
    rejected: { label: "Rejected", cls: "bg-rose-400/10 text-rose-400" },
  };
  const entry = map[status] || map.pending;
  return (
    <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

function actionLabel(action) {
  return (action.type || action.step_type || "").replace(/_/g, " ");
}

export default function WorkflowSuggestionCard({ suggestion, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null); // "approve" | "reject" | "run" | null
  const [error, setError] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState(null); // populated after approve
  const [executionId, setExecutionId] = useState(null);

  const proposed = suggestion.proposed_workflow || {};
  const originalActions = proposed.actions || [];
  const toEditableSteps = (actions) =>
    actions.map((a, i) => ({
      _id: `orig-${i}`, step_type: a.type, application: a.application || "", config: a.config || {},
    }));
  const [editedSteps, setEditedSteps] = useState(toEditableSteps(originalActions));
  const conditions = proposed.conditions || [];
  const trigger = proposed.trigger || {};

  const stepsToShow = editing ? editedSteps : originalActions.map((a) => ({
    step_type: a.type, application: a.application, config: a.config,
  }));
  const stripIds = (steps) => steps.map(({ _id, ...rest }) => rest);
  const wasEdited = JSON.stringify(stripIds(editedSteps)) !== JSON.stringify(stripIds(toEditableSteps(originalActions)));

  const handleApprove = async () => {
    setError(null);
    setBusy("approve");
    try {
      const payload = wasEdited ? stripIds(editedSteps).map((s) => ({ ...s, type: s.step_type })) : null;
      const workflow = await api.approveWorkflow(suggestion.id, payload);
      setActiveWorkflow(workflow);
      setEditing(false);
      onChange?.({ ...suggestion, status: "approved" });
    } catch (err) {
      setError(err.message || "Approve failed");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setError(null);
    setBusy("reject");
    try {
      await api.rejectWorkflow(suggestion.id);
      onChange?.({ ...suggestion, status: "rejected" });
    } catch (err) {
      setError(err.message || "Reject failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRun = async () => {
    if (!activeWorkflow) return;
    setError(null);
    setBusy("run");
    try {
      const execution = await api.executeWorkflow(activeWorkflow.id);
      setExecutionId(execution.id);
    } catch (err) {
      setError(err.message || "Execution failed to start");
    } finally {
      setBusy(null);
    }
  };

  const isPending = suggestion.status === "pending";

  return (
    <div className="rounded-2xl border border-base-border bg-base-surface p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={16} className="text-violet-400" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-ink-100">{suggestion.intent}</h3>
              {suggestion.category && (
                <span className="text-[11px] text-ink-500 bg-base-surface2 px-2 py-0.5 rounded-full">
                  {suggestion.category.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">{suggestion.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusPill status={suggestion.status} />
          <ConfidenceBar value={suggestion.confidence} />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-100 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Hide generated workflow" : "View generated workflow"}
        </button>
        {isPending && expanded && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Pencil size={12} /> Edit steps
          </button>
        )}
        {isPending && editing && (
          <button
            onClick={() => {
              setEditing(false);
              setEditedSteps(toEditableSteps(originalActions));
            }}
            className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-100 transition-colors"
          >
            <Undo2 size={12} /> Revert edits
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl border border-base-border bg-base-surface2/60 p-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-500 mb-1.5">Trigger</p>
            <p className="text-[13px] text-ink-100">
              {trigger.type ? trigger.type.replace(/_/g, " ") : "unknown"}
              {trigger.source && <span className="text-ink-500"> · {trigger.source}</span>}
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-500 mb-2">
              Steps {editing && <span className="normal-case text-violet-400">(editing)</span>}
            </p>
            {editing ? (
              <WorkflowStepEditor steps={editedSteps} onChange={setEditedSteps} />
            ) : (
              <ol className="space-y-2">
                {stepsToShow.map((action, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-ink-100">
                    <span className="text-[11px] text-ink-500 font-mono w-4 shrink-0">{i + 1}</span>
                    {action.application && <AppIcon application={action.application} size={13} />}
                    <span>{actionLabel(action)}</span>
                    {i !== stepsToShow.length - 1 && (
                      <ArrowRight size={12} className="text-ink-500 ml-auto shrink-0" />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {conditions.length > 0 && !editing && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-500 mb-2">
                Fallback conditions
              </p>
              <ul className="space-y-1.5">
                {conditions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-ink-500">
                    <ShieldAlert size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <span>
                      if <span className="text-ink-100">{(c.if_ || c.if || "").replace(/_/g, " ")}</span>{" "}
                      → <span className="text-ink-100">{(c.then || "").replace(/_/g, " ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[12px] text-rose-400 mt-3">{error}</p>}

      {executionId && (
        <div className="mt-4">
          <ExecutionPanel executionId={executionId} />
        </div>
      )}

      <div className="flex items-center gap-2.5 mt-5">
        {isPending && (
          <>
            <button
              onClick={handleApprove}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {wasEdited && editing ? "Approve edited workflow" : "Approve"}
            </button>
            <button
              onClick={handleReject}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {busy === "reject" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Reject
            </button>
          </>
        )}
        {suggestion.status === "approved" && (
          <button
            onClick={handleRun}
            disabled={busy !== null || !activeWorkflow || executionId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            {executionId
              ? "Run started — see progress above"
              : activeWorkflow
                ? "Run automation now"
                : "Approved — open Automation to run it"}
          </button>
        )}
        {suggestion.status === "rejected" && (
          <p className="text-[12px] text-ink-500">This suggestion was dismissed.</p>
        )}
      </div>
    </div>
  );
}
