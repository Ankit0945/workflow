import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import Layout from "../components/Layout";
import WorkflowSuggestionCard from "../components/WorkflowSuggestionCard";
import { api } from "../services/api";

export default function DiscoveredWorkflows() {
  const location = useLocation();
  const navigate = useNavigate();
  const analyzedSessionRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadSuggestions = useCallback(async () => {
    try {
      const data = await api.listSuggestedWorkflows();
      setSuggestions(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const runAnalysis = useCallback(
    async (sessionId) => {
      setAnalyzing(true);
      setNotice(null);
      try {
        const before = await api.listSuggestedWorkflows();
        const result = await api.analyzeWorkflows(sessionId);
        setSuggestions(result);
        if (result.length === 0) {
          setNotice(
            "No repeated workflow detected yet — run the demo simulation at least once from the Dashboard so the same sequence occurs 2+ times."
          );
        } else if (result.length > before.length) {
          setNotice(`Gemini detected ${result.length - before.length} new workflow suggestion(s).`);
        }
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  useEffect(() => {
    const incomingSessionId = location.state?.sessionId;

    (async () => {
      await loadSuggestions();
      // If we just arrived from "Simulate Customer Request Workflow" on the
      // Dashboard, automatically run discovery + Gemini analysis for that
      // session once, so the full pipeline completes without another click.
      if (incomingSessionId && analyzedSessionRef.current !== incomingSessionId) {
        analyzedSessionRef.current = incomingSessionId;
        await runAnalysis(incomingSessionId);
        // clear the location state so a refresh doesn't re-trigger it
        navigate(location.pathname, { replace: true, state: {} });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSuggestionChange = (updated) => {
    setSuggestions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  };

  return (
    <Layout
      title="Discovered Workflows"
      subtitle="AI-detected repeated workflows awaiting your review."
      actions={
        <button
          onClick={() => runAnalysis()}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-glow"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          {analyzing ? "Analyzing activity..." : "Detect workflows now"}
        </button>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
          Could not reach the backend ({error}). Is it running on the expected port?
        </div>
      )}
      {notice && !error && (
        <div className="mb-6 rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-sm text-ink-100">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-ink-500 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading suggestions...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-border bg-base-surface/50 p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-10">
          <div className="w-12 h-12 rounded-xl bg-base-surface2 border border-base-border flex items-center justify-center mb-4">
            <Sparkles size={20} className="text-ink-500" />
          </div>
          <h3 className="font-display font-semibold text-ink-100 mb-1.5">No workflows discovered yet</h3>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Run the demo simulation from the Dashboard, or click "Detect workflows now" once the same
            activity sequence has happened at least twice.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {suggestions.map((s) => (
            <WorkflowSuggestionCard key={s.id} suggestion={s} onChange={handleSuggestionChange} />
          ))}
        </div>
      )}
    </Layout>
  );
}
