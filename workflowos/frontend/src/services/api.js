/**
 * Thin fetch wrapper around the WorkFlowOS backend.
 * Every major UI action goes through here — nothing in the UI is a fake button.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/api/health"),

  // Activity
  listActivity: (limit = 50) => request(`/api/activity?limit=${limit}`),
  createActivity: (payload) =>
    request("/api/activity", { method: "POST", body: JSON.stringify(payload) }),

  // Demo mode
  startDemo: () => request("/api/demo/start", { method: "POST" }),
  getDemoSequence: () => request("/api/demo/sequence"),

  // Workflows (discovery + suggestions)
  analyzeWorkflows: (sessionId) =>
    request("/api/workflows/analyze", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId || null }),
    }),
  listSuggestedWorkflows: () => request("/api/workflows"),
  getSuggestedWorkflow: (id) => request(`/api/workflows/${id}`),
  approveWorkflow: (id, editedSteps) =>
    request(`/api/workflows/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ edited_steps: editedSteps || null }),
    }),
  rejectWorkflow: (id) => request(`/api/workflows/${id}/reject`, { method: "POST" }),
  listActiveWorkflows: () => request("/api/workflows/active/list"),
  executeWorkflow: (id, simulateCustomerNotFound = false) =>
    request(
      `/api/workflows/${id}/execute?simulate_customer_not_found=${simulateCustomerNotFound}`,
      { method: "POST" }
    ),
  updateWorkflowSteps: (id, steps) =>
    request(`/api/workflows/active/${id}/steps`, {
      method: "PUT",
      body: JSON.stringify({ steps }),
    }),
  getWorkflowReliability: (id) => request(`/api/workflows/active/${id}/reliability`),

  // Executions
  listExecutions: (workflowId) =>
    request(`/api/executions${workflowId ? `?workflow_id=${workflowId}` : ""}`),
  getExecution: (id) => request(`/api/executions/${id}`),
  resolveExecution: (id, { action = "retry", customerName } = {}) =>
    request(`/api/executions/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, customer_name: customerName || null }),
    }),

  // Dashboard
  getDashboardStats: () => request("/api/dashboard/stats"),
};
