import { useCallback, useEffect, useState } from "react";
import {
  Workflow as WorkflowIcon, PlayCircle, Loader2, Pencil, Save, X, ChevronDown, ChevronUp,
  TrendingUp, Clock, AlertOctagon,
} from "lucide-react";
import Layout from "../components/Layout";
import AppIcon from "../components/AppIcon";
import WorkflowStepEditor from "../components/WorkflowStepEditor";
import ExecutionPanel from "../components/ExecutionPanel";
import { api } from "../services/api";

function ReliabilityStrip({ stats }) {
  if (!stats) return null;
  if (stats.total_executions === 0) {
    return <p className="text-[12px] text-ink-500">No runs yet — reliability stats will appear here.</p>;
  }
  return (
    <div className="flex items-center gap-4 flex-wrap text-[12px] text-ink-500">
      <span className="flex items-center gap-1.5">
        <TrendingUp size={13} className="text-teal-400" />
        <span className="text-ink-100 font-medium">{stats.success_rate}%</span> success ·{" "}
        {stats.total_executions} run{stats.total_executions === 1 ? "" : "s"}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock size={13} className="text-violet-400" />
        avg <span className="text-ink-100 font-medium">{stats.average_duration_seconds}s</span>
      </span>
      {stats.needs_intervention_count > 0 && (
        <span className="flex items-center gap-1.5 text-amber-400">
          <AlertOctagon size={13} />
          {stats.needs_intervention_count} needed intervention
        </span>
      )}
    </div>
  );
}

function toEditableSteps(workflowSteps) {
  return workflowSteps.map((s) => ({
    _id: s.id, step_type: s.step_type, application: s.application || "", config: s.config || {},
  }));
}

function WorkflowCard({ workflow, onStepsSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState(toEditableSteps(workflow.steps));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [simulateFailure, setSimulateFailure] = useState(false);
  const [executionId, setExecutionId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState(null);
  const [reliability, setReliability] = useState(null);

  const loadReliability = useCallback(async () => {
    try {
      setReliability(await api.getWorkflowReliability(workflow.id));
    } catch {
      // stats are a nice-to-have; don't block the card on failure
    }
  }, [workflow.id]);

  useEffect(() => {
    loadReliability();
  }, [loadReliability]);

  const handleRun = async () => {
    setRunError(null);
    setStarting(true);
    try {
      const execution = await api.executeWorkflow(workflow.id, simulateFailure);
      setExecutionId(execution.id);
    } catch (err) {
      setRunError(err.message || "Could not start execution");
    } finally {
      setStarting(false);
    }
  };

  const handleSaveSteps = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateWorkflowSteps(workflow.id, steps.map((s) => ({
        step_type: s.step_type, application: s.application || null, config: s.config,
      })));
      setEditing(false);
      onStepsSaved?.(updated);
    } catch (err) {
      setSaveError(err.message || "Could not save steps");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-base-border bg-base-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <WorkflowIcon size={16} className="text-teal-400" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-ink-100">{workflow.name}</h3>
            {workflow.description && (
              <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">{workflow.description}</p>
            )}
          </div>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-teal-500/10 text-teal-400 shrink-0">
          Active
        </span>
      </div>

      <div className="mt-3">
        <ReliabilityStrip stats={reliability} />
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-100 transition-colors mt-3"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? "Hide steps" : `View ${workflow.steps.length} step${workflow.steps.length === 1 ? "" : "s"}`}
      </button>

      {expanded && (
        <div className="mt-3 rounded-xl border border-base-border bg-base-surface2/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-500">Steps</p>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300"
              >
                <Pencil size={12} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditing(false);
                    setSteps(toEditableSteps(workflow.steps));
                    setSaveError(null);
                  }}
                  className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-100"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={handleSaveSteps}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-[12px] text-teal-400 hover:text-teal-300 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <>
              <WorkflowStepEditor steps={steps} onChange={setSteps} />
              {saveError && <p className="text-[12px] text-rose-400 mt-2">{saveError}</p>}
            </>
          ) : (
            <ol className="space-y-2">
              {workflow.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2.5 text-[13px] text-ink-100">
                  <span className="text-[11px] text-ink-500 font-mono w-4 shrink-0">{i + 1}</span>
                  {s.application && <AppIcon application={s.application} size={13} />}
                  <span>{(s.description || s.step_type).replace(/_/g, " ")}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {executionId && (
        <div className="mt-4">
          <ExecutionPanel
            executionId={executionId}
            onUpdate={(exec) => {
              if (["success", "failed"].includes(exec.status)) loadReliability();
            }}
          />
        </div>
      )}

      {runError && <p className="text-[12px] text-rose-400 mt-3">{runError}</p>}

      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={handleRun}
          disabled={starting || executionId}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-[13px] font-medium transition-colors disabled:opacity-50"
        >
          {starting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          {executionId ? "Running…" : "Run now"}
        </button>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
            disabled={!!executionId}
            className="accent-amber-400"
          />
          Demo: simulate customer not found
        </label>
      </div>
    </div>
  );
}

export default function Automation() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listActiveWorkflows();
      setWorkflows(data);
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

  const handleStepsSaved = (updated) => {
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  return (
    <Layout
      title="Automation"
      subtitle="Active automations WorkFlowOS is running on your behalf."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
          Could not reach the backend ({error}). Is it running on the expected port?
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-ink-500 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading automations...
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-border bg-base-surface/50 p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-10">
          <div className="w-12 h-12 rounded-xl bg-base-surface2 border border-base-border flex items-center justify-center mb-4">
            <WorkflowIcon size={20} className="text-ink-500" />
          </div>
          <h3 className="font-display font-semibold text-ink-100 mb-1.5">No active automations yet</h3>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Approve a suggestion from Discovered Workflows to activate your first automation.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {workflows.map((w) => (
            <WorkflowCard key={w.id} workflow={w} onStepsSaved={handleStepsSaved} />
          ))}
        </div>
      )}
    </Layout>
  );
}
