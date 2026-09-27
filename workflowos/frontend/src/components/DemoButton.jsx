import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { api } from "../services/api";

/**
 * Triggers /api/demo/start (which persists real ActivityEvent rows so the
 * discovery engine has data to analyze), then replays the same sequence
 * client-side with realistic delays so the UI *feels* like it's watching
 * live activity happen.
 *
 * onEvent(event) is called for each simulated event as it "arrives".
 * onComplete(sessionId) is called once the full sequence has played.
 */
export default function DemoButton({ onEvent, onComplete, disabled }) {
  const [status, setStatus] = useState("idle"); // idle | starting | playing | done
  const [error, setError] = useState(null);

  const run = async () => {
    setError(null);
    setStatus("starting");
    try {
      const [sequence, demoResult] = await Promise.all([
        api.getDemoSequence(),
        api.startDemo(),
      ]);

      setStatus("playing");
      const startTs = Date.now();

      for (const step of sequence) {
        // space events out ~900ms apart regardless of the backend's own
        // stored offsets, tuned for a smooth live demo feel
        await new Promise((r) => setTimeout(r, 900));
        onEvent?.({
          id: `${demoResult.session_id}-${step.offset}`,
          timestamp: new Date(startTs + step.offset * 1000).toISOString(),
          application: step.application,
          action: step.action,
          target: step.target,
          event_metadata: step.metadata,
          session_id: demoResult.session_id,
          source: "simulated",
        });
      }

      setStatus("done");
      onComplete?.(demoResult.session_id);
    } catch (err) {
      setError(err.message || "Failed to run demo");
      setStatus("idle");
    }
  };

  const isBusy = status === "starting" || status === "playing";

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={run}
        disabled={disabled || isBusy}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-glow"
      >
        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
        {status === "starting" && "Starting demo..."}
        {status === "playing" && "Simulating activity..."}
        {(status === "idle" || status === "done") && "Simulate Customer Request Workflow"}
      </button>
      {error && <p className="text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}
