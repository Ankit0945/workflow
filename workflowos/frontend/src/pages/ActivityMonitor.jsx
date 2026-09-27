import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import ActivityTimeline from "../components/ActivityTimeline";
import DemoButton from "../components/DemoButton";
import { api } from "../services/api";

export default function ActivityMonitor() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listActivity(100);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDemoEvent = (event) => {
    setEvents((prev) => [...prev, event]);
  };

  return (
    <Layout
      title="Activity Monitor"
      subtitle="A live timeline of everything WorkFlowOS has observed."
      actions={<DemoButton onEvent={handleDemoEvent} onComplete={load} />}
    >
      <div className="rounded-2xl border border-base-border bg-base-surface p-6 max-w-3xl">
        {loading ? (
          <p className="text-sm text-ink-500">Loading activity…</p>
        ) : (
          <ActivityTimeline
            events={events}
            emptyLabel="No activity recorded yet. Run the simulator to generate a demo session."
          />
        )}
      </div>
    </Layout>
  );
}
