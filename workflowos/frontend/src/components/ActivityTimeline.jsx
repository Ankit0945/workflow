import AppIcon from "./AppIcon";

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function actionLabel(event) {
  const map = {
    open_application: "Opened application",
    open_email: "Opened email",
    download_attachment: "Downloaded attachment",
    search_customer: "Searched customer",
    update_customer: "Updated customer record",
    send_message: "Sent message",
  };
  return map[event.action] || event.action?.replace(/_/g, " ");
}

function detailLine(event) {
  const md = event.event_metadata || event.metadata || {};
  if (event.action === "open_email") return md.subject;
  if (event.action === "download_attachment") return event.target;
  if (event.action === "search_customer" || event.action === "update_customer") return md.customer;
  if (event.action === "send_message") return event.target;
  return event.target;
}

export default function ActivityTimeline({ events, emptyLabel = "No activity yet." }) {
  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-11 h-11 rounded-full bg-base-surface2 border border-base-border flex items-center justify-center mb-3">
          <span className="w-2 h-2 rounded-full bg-ink-500" />
        </div>
        <p className="text-sm text-ink-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className="relative">
      {events.map((event, idx) => (
        <li key={event.id || idx} className="flex gap-3 pb-5 last:pb-0 animate-slide-in relative">
          {idx !== events.length - 1 && (
            <span className="absolute left-[19px] top-10 bottom-0 w-px bg-base-border" />
          )}
          <AppIcon application={event.application} size={16} />
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-100">
                <span className="font-medium">{event.application}</span>
                <span className="text-ink-500"> · {actionLabel(event)}</span>
              </p>
              <span className="text-[11px] text-ink-500 font-mono shrink-0">{formatTime(event.timestamp)}</span>
            </div>
            {detailLine(event) && (
              <p className="text-[13px] text-ink-500 mt-0.5 truncate">{detailLine(event)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
