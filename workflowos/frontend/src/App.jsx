import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ActivityMonitor from "./pages/ActivityMonitor";
import DiscoveredWorkflows from "./pages/DiscoveredWorkflows";
import Automation from "./pages/Automation";
import ExecutionHistory from "./pages/ExecutionHistory";
import ComingSoon from "./pages/ComingSoon";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activity" element={<ActivityMonitor />} />
      <Route path="/discovered" element={<DiscoveredWorkflows />} />
      <Route path="/automation" element={<Automation />} />
      <Route path="/executions" element={<ExecutionHistory />} />
      <Route
        path="/settings"
        element={
          <ComingSoon
            title="Settings"
            subtitle="Gemini API status, database status, integrations, and privacy controls."
            phaseNote="A later build will surface live Gemini/PostgreSQL connection status, integration toggles, and automation-mode controls here."
          />
        }
      />
    </Routes>
  );
}
