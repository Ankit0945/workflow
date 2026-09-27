"""
Modular automation adapters.

Architecture (per requirements):

    AutomationEngine
    |
    +-- APIAdapter            (real API integrations - stub, ready to extend)
    +-- BrowserAdapter        (Playwright structure - stub, ready to extend)
    +-- ApplicationAdapter    (native app integration - stub)
    +-- AccessibilityAdapter  (semantic UI automation - stub)
    +-- SimulationAdapter     (fully implemented — drives the hackathon demo)

Every adapter implements the same `execute_step(step_type, config, context)`
interface so the AutomationEngine can pick the best available adapter for a
given step without the caller needing to know which one ran.
"""
import random
import time
from typing import Any


class BaseAdapter:
    name = "base"

    def supports(self, step_type: str) -> bool:
        raise NotImplementedError

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class SimulationAdapter(BaseAdapter):
    """
    Fully implemented for the hackathon MVP. Actually "executes" the demo
    workflow step by step with realistic timing and deterministic, successful
    output — except for a controllable failure case used to demonstrate
    human-in-the-loop intervention.
    """
    name = "simulation"

    STEP_LABELS = {
        "read_email": "Email analyzed",
        "identify_customer": "Customer identified",
        "download_attachment": "Attachment downloaded",
        "find_customer": "CRM customer found",
        "update_customer": "Customer record updated",
        "send_notification": "Slack notification sent",
        "review_manually": "Manual review requested",
    }

    def supports(self, step_type: str) -> bool:
        return True  # simulation is the universal fallback

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        # small realistic delay per step
        time.sleep(random.uniform(0.3, 0.7))

        customer_name = context.get("customer", "Rahul Sharma")

        # Controllable failure: if the context explicitly marks the customer
        # as missing, the "find_customer" step fails to trigger human
        # intervention (requirement #11).
        if step_type == "find_customer" and context.get("simulate_customer_not_found"):
            return {
                "success": False,
                "label": f'Customer "{customer_name}" could not be found',
                "error": "customer_not_found",
            }

        label = self.STEP_LABELS.get(step_type, step_type.replace("_", " ").capitalize())
        return {"success": True, "label": label, "customer": customer_name}


class APIAdapter(BaseAdapter):
    """Stub for real API integrations (Gmail API, Slack API, CRM REST API, ...).
    Not implemented for the hackathon — kept ready for post-hackathon extension."""
    name = "api"

    def supports(self, step_type: str) -> bool:
        return False  # no real integrations configured yet

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("APIAdapter is a stub — configure real credentials to enable it.")


class BrowserAdapter(BaseAdapter):
    """Stub structure for Playwright-based browser automation."""
    name = "browser"

    def supports(self, step_type: str) -> bool:
        return False

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        # Real implementation would launch Playwright here, e.g.:
        #   async with async_playwright() as p:
        #       browser = await p.chromium.launch()
        #       ...
        raise NotImplementedError("BrowserAdapter is a stub — implement Playwright steps here.")


class ApplicationAdapter(BaseAdapter):
    """Stub for native desktop application integration (e.g. OS automation APIs)."""
    name = "application"

    def supports(self, step_type: str) -> bool:
        return False

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("ApplicationAdapter is a stub.")


class AccessibilityAdapter(BaseAdapter):
    """Stub for semantic UI / accessibility-tree based automation."""
    name = "accessibility"

    def supports(self, step_type: str) -> bool:
        return False

    def execute_step(self, step_type: str, config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("AccessibilityAdapter is a stub.")
