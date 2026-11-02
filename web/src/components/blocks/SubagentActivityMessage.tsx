import { BotIcon } from "lucide-react";
import { Link, useLocation } from "@/lib/routing";
import { sessionNavigationSearch } from "@/lib/sessionNavigation";
import { readSubagentActivity } from "@/lib/subagentActivity";
import { useOpenSubagentInPanel } from "@/shell/subagentPanelOpener";

export function SubagentActivityMessage({ data }: { data: Record<string, unknown> }) {
  const { search } = useLocation();
  const openInPanel = useOpenSubagentInPanel();
  const activity = readSubagentActivity(data);
  if (!activity) return null;
  const params = new URLSearchParams(sessionNavigationSearch(search));
  params.set("panel", "agents");
  const to = {
    pathname: `/c/${encodeURIComponent(activity.sessionId)}`,
    search: `?${params.toString()}`,
  };
  let label = activity.phase === "delegated" ? "Started" : "Completed";
  if (activity.phase === "returned") {
    if (activity.status === "failed") label = "Failed";
    if (["cancelled", "killed", "stopped"].includes(activity.status ?? "")) label = "Stopped";
  }
  return (
    <div
      className="not-prose my-2 flex w-full items-center gap-2 text-xs text-muted-foreground"
      data-testid="subagent-activity"
      data-phase={activity.phase}
      data-child-session-id={activity.sessionId}
    >
      <span aria-hidden="true" className="min-w-0 flex-1 border-t border-border/40" />
      <div className="flex min-w-0 max-w-[85%] items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-center transition-all duration-150 hover:bg-muted/40 hover:border-border">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <BotIcon aria-hidden="true" className="size-3.5" />
        </span>
        <span className="min-w-0 break-words font-medium">
          <span className="text-muted-foreground mr-1.5">{label}</span>
          <Link
            to={to}
            onClick={(event) => {
              openInPanel(activity.sessionId, event);
            }}
            className="rounded font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {activity.title}
          </Link>
        </span>
      </div>
      <span aria-hidden="true" className="min-w-0 flex-1 border-t border-border/40" />
    </div>
  );
}
