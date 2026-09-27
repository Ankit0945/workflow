import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import AppIcon from "./AppIcon";

const STEP_TYPE_SUGGESTIONS = [
  "read_email",
  "download_attachment",
  "find_customer",
  "update_customer",
  "send_notification",
  "review_manually",
];

const APPLICATION_OPTIONS = ["", "gmail", "crm", "slack"];

function genId() {
  return `step-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeStep(step) {
  return {
    _id: step._id,
    step_type: step.step_type || step.type || "",
    application: step.application || "",
    config: step.config || {},
  };
}

/**
 * A lightweight visual workflow builder: an ordered, connected list of steps
 * a user can reorder, retype, retarget to a different app, edit the raw
 * config for, add to, or remove — without needing a heavy drag-and-drop
 * dependency. This is what both "review a suggested workflow before
 * approving" and "edit an already-active workflow's steps" render.
 */
export default function WorkflowStepEditor({ steps, onChange }) {
  const [configErrors, setConfigErrors] = useState({});

  const update = (index, patch) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  };

  const updateConfigText = (index, text) => {
    try {
      const parsed = text.trim() === "" ? {} : JSON.parse(text);
      setConfigErrors((prev) => ({ ...prev, [index]: null }));
      update(index, { config: parsed });
    } catch {
      setConfigErrors((prev) => ({ ...prev, [index]: "Invalid JSON — fix before saving." }));
      // keep the last valid config in state; only the text field shows the edit locally
    }
  };

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const addStep = () => {
    onChange([...steps, { _id: genId(), step_type: "custom_step", application: "", config: {} }]);
  };

  return (
    <div className="space-y-3">
      {steps.map((rawStep, index) => {
        const step = normalizeStep(rawStep);
        const error = configErrors[index];
        return (
          <div key={step._id || index} className="relative">
            {index !== steps.length - 1 && (
              <span className="absolute left-[19px] top-[52px] bottom-[-12px] w-px bg-base-border" />
            )}
            <div className="rounded-xl border border-base-border bg-base-surface2/60 p-3.5">
              <div className="flex items-start gap-3">
                <span className="text-[11px] text-ink-500 font-mono w-4 shrink-0 mt-2.5">
                  {index + 1}
                </span>

                <AppIcon application={step.application} size={14} />

                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-ink-500">
                      Step type
                    </label>
                    <input
                      list="workflowos-step-types"
                      value={step.step_type}
                      onChange={(e) => update(index, { step_type: e.target.value })}
                      className="mt-1 w-full rounded-lg bg-base-surface border border-base-border px-2.5 py-1.5 text-[13px] text-ink-100 focus:outline-none focus:border-violet-400"
                      placeholder="e.g. update_customer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-ink-500">
                      Application
                    </label>
                    <select
                      value={step.application}
                      onChange={(e) => update(index, { application: e.target.value })}
                      className="mt-1 w-full rounded-lg bg-base-surface border border-base-border px-2.5 py-1.5 text-[13px] text-ink-100 focus:outline-none focus:border-violet-400"
                    >
                      {APPLICATION_OPTIONS.map((app) => (
                        <option key={app || "none"} value={app}>
                          {app ? app.toUpperCase() : "— none —"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-wide text-ink-500">
                      Config (JSON)
                    </label>
                    <textarea
                      defaultValue={JSON.stringify(step.config, null, 2)}
                      onChange={(e) => updateConfigText(index, e.target.value)}
                      rows={2}
                      spellCheck={false}
                      className="mt-1 w-full rounded-lg bg-base-surface border border-base-border px-2.5 py-1.5 text-[12px] font-mono text-ink-300 focus:outline-none focus:border-violet-400 resize-y"
                    />
                    {error && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-400">
                        <AlertTriangle size={11} /> {error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded-md text-ink-500 hover:text-ink-100 hover:bg-base-surface disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === steps.length - 1}
                    className="p-1 rounded-md text-ink-500 hover:text-ink-100 hover:bg-base-surface disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1 rounded-md text-rose-400/80 hover:text-rose-400 hover:bg-rose-400/10"
                    title="Remove step"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <datalist id="workflowos-step-types">
        {STEP_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={addStep}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-base-border text-[12px] text-ink-500 hover:text-ink-100 hover:border-violet-400/50 transition-colors"
      >
        <Plus size={13} /> Add step
      </button>
    </div>
  );
}
