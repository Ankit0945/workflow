import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Activity, Sparkles, Workflow, PlayCircle, History, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/activity", label: "Activity Monitor", icon: Activity },
  { to: "/discovered", label: "Discovered Workflows", icon: Sparkles },
  { to: "/automation", label: "Automation", icon: Workflow },
  { to: "/executions", label: "Execution History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-base-border bg-base-surface/60 backdrop-blur">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-teal-400 flex items-center justify-center shadow-glow">
          <Workflow size={17} className="text-base-bg" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display font-bold text-[15px] leading-none text-ink-100">WorkFlowOS</div>
          <div className="text-[11px] text-ink-500 mt-1">Hackathon build</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-violet-500/12 text-ink-100 font-medium"
                  : "text-ink-500 hover:text-ink-100 hover:bg-base-surface2"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={2} className={isActive ? "text-violet-400" : ""} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 mx-3 mb-4 rounded-xl bg-base-surface2 border border-base-border">
        <p className="text-[12px] text-ink-300 leading-snug">
          Your work teaches the computer how to automate it.
        </p>
      </div>
    </aside>
  );
}
