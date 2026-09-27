import { Mail, Database, MessageSquare, LayoutGrid } from "lucide-react";

const ICONS = {
  gmail: { icon: Mail, color: "#EF6C5A", bg: "rgba(239,108,90,0.12)" },
  crm: { icon: Database, color: "#3FE0C5", bg: "rgba(63,224,197,0.12)" },
  slack: { icon: MessageSquare, color: "#8B7CFF", bg: "rgba(139,124,255,0.12)" },
};

export default function AppIcon({ application, size = 18, className = "" }) {
  const key = (application || "").toLowerCase();
  const entry = ICONS[key] || { icon: LayoutGrid, color: "#8A93A6", bg: "rgba(138,147,166,0.12)" };
  const Icon = entry.icon;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg ${className}`}
      style={{ width: size + 16, height: size + 16, background: entry.bg }}
    >
      <Icon size={size} color={entry.color} strokeWidth={2} />
    </span>
  );
}
