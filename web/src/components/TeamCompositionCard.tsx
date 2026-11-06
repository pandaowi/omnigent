import {
  CompassIcon,
  Code2Icon,
  ShieldCheckIcon,
  UsersIcon,
  BotIcon,
  ArrowRightIcon,
  CopyIcon,
  PencilIcon,
  CpuIcon,
  ServerIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamMemberRole } from "@/shell/CreateAgentTeamDialog";

export function parseTeamRoles(instructions?: string | null, description?: string | null): TeamMemberRole[] | null {
  const text = (instructions || "") + "\n" + (description || "");
  if (!text) return null;

  // 1. Try parsing structured Markdown sections: "### Role X: Role Name"
  const roleBlocks = text.split(/(?=### Role \d+:)/);
  if (roleBlocks.length > 1) {
    const parsed: TeamMemberRole[] = [];
    for (let i = 1; i < roleBlocks.length; i++) {
      const block = roleBlocks[i];
      const headerMatch = block.match(/### Role \d+:\s*([^\n\r]+)/);
      const roleName = headerMatch ? headerMatch[1].trim() : `Role ${i}`;
      const focusMatch = block.match(/-\s*\*\*Specialization \/ Focus\*\*:\s*([^\n\r]+)/);
      const focus = focusMatch ? focusMatch[1].trim() : "";
      const harnessMatch = block.match(/-\s*\*\*Assigned Harness Engine\*\*:\s*([^\n\r]+)/);
      const harness = harnessMatch ? harnessMatch[1].trim() : "codex";
      const hostMatch = block.match(/-\s*\*\*Runtime Host\*\*:\s*([^\n\r]+)/);
      const host = hostMatch ? hostMatch[1].trim() : undefined;
      const modelMatch = block.match(/-\s*\*\*Preferred Model\*\*:\s*([^\n\r]+)/);
      const model = modelMatch ? modelMatch[1].trim() : undefined;

      parsed.push({
        id: `role_${i}`,
        roleName,
        focus,
        harness,
        hostId: host,
        model,
      });
    }
    if (parsed.length > 0) return parsed;
  }

  // 2. Try parsing roles from parenthetical summary in description, e.g. "(Test Engineer, Feature Implementer)"
  const parenMatch = description?.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const names = parenMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().includes("lead orchestrator"));
    if (names.length > 0 && names.length <= 8) {
      return names.map((name, i) => ({
        id: `role_${i + 1}`,
        roleName: name,
        focus: `Specialized ${name} responsibilities`,
        harness: "codex",
      }));
    }
  }

  // 3. Built-in agent-team fallback (only if description or text specifically mentions the full squad)
  if (
    text.toLowerCase().includes("autonomous multi-role agent team") ||
    text.toLowerCase().includes("architect, developer, reviewer")
  ) {
    return [
      {
        id: "role_1",
        roleName: "Lead Orchestrator",
        focus: "Coordinates overarching plan, manages context, and delegates subtasks to specialists.",
        harness: "codex",
        model: "gpt-4o",
      },
      {
        id: "role_2",
        roleName: "Architect & Planner",
        focus: "Analyzes system architecture, outlines modular boundaries, and authors task specifications.",
        harness: "codex",
        model: "gpt-4o",
      },
      {
        id: "role_3",
        roleName: "Core Developer",
        focus: "Writes clean production code, implements modules, tests logic, and applies git patches.",
        harness: "opencode",
        model: "claude-3-5-sonnet",
      },
      {
        id: "role_4",
        roleName: "Code Reviewer & QA",
        focus: "Reviews diffs, checks security standards, audits test coverage, and prevents regressions.",
        harness: "claude-native",
        model: "claude-3-5-sonnet",
      },
    ];
  }

  return null;
}

function getRoleIcon(roleName: string) {
  const lower = roleName.toLowerCase();
  if (lower.includes("architect") || lower.includes("plan")) return CompassIcon;
  if (lower.includes("develop") || lower.includes("coder") || lower.includes("core")) return Code2Icon;
  if (lower.includes("review") || lower.includes("qa") || lower.includes("test") || lower.includes("audit")) return ShieldCheckIcon;
  if (lower.includes("orchestrat") || lower.includes("lead")) return UsersIcon;
  return BotIcon;
}

export function TeamCompositionCard({
  agentName,
  roles,
  canEdit,
  onCustomize,
  onEditRoles,
}: {
  agentName: string;
  roles: TeamMemberRole[];
  canEdit: boolean;
  onCustomize?: () => void;
  onEditRoles?: () => void;
}) {
  return (
    <div data-testid={`team-composition-${agentName}`} className="my-6 flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground">
            <UsersIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Multi-Role Agent Team Pipeline
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                {roles.length} Specialists
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous collaboration workflow across specialized AI agents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canEdit && onCustomize && (
            <Button
              size="sm"
              onClick={onCustomize}
              className="gap-1.5 font-medium"
            >
              <CopyIcon className="size-3.5" />
              Customize as My Team
            </Button>
          )}
          {canEdit && onEditRoles && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEditRoles}
              className="gap-1.5"
            >
              <PencilIcon className="size-3.5" />
              Edit Team Roles
            </Button>
          )}
        </div>
      </div>

      {/* Visual Pipeline Sequence */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {roles.map((r, i) => {
          const Icon = getRoleIcon(r.roleName);
          return (
            <div key={r.id || i} className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-medium shadow-xs">
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{r.roleName}</span>
              </div>
              {i < roles.length - 1 && (
                <ArrowRightIcon className="size-3.5 text-muted-foreground/60 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((role, idx) => {
          const Icon = getRoleIcon(role.roleName);
          return (
            <div
              key={role.id || idx}
              className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card/90 p-3.5 transition-colors hover:border-border-strong"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-3.5 text-foreground" />
                    </div>
                    <span className="truncate text-xs font-semibold text-foreground">
                      {role.roleName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground/70">
                    #{idx + 1}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {role.focus || "Specialized tasks and execution for this role."}
                </p>
              </div>

              {/* Specs Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 text-[11px]">
                <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  <CpuIcon className="size-3" />
                  <span>{role.harness || "codex"}</span>
                </div>
                {role.model && (
                  <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <SparklesIcon className="size-3 text-amber-500" />
                    <span>{role.model}</span>
                  </div>
                )}
                {role.hostId && (
                  <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <ServerIcon className="size-3" />
                    <span>{role.hostId}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
