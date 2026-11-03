import { useEffect, useMemo, useState } from "react";
import {
  PlusIcon,
  TrashIcon,
  UsersIcon,
  ShieldCheckIcon,
  Code2Icon,
  CompassIcon,
  SparklesIcon,
  CpuIcon,
  ServerIcon,
  BotIcon,
  LayersIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AgentBundleInput } from "@/lib/agentBundle";
import { useHosts, useHostModelOptions } from "@/hooks/useHosts";

export interface TeamMemberRole {
  id: string;
  roleName: string;
  focus: string;
  harness: string;
  hostId?: string;
  model?: string;
}

const PRESET_TEAMS: {
  title: string;
  icon: typeof SparklesIcon;
  description: string;
  roles: TeamMemberRole[];
}[] = [
  {
    title: "Full-Stack Squad",
    icon: Code2Icon,
    description: "Standard end-to-end engineering squad with architecture, implementation, and review.",
    roles: [
      {
        id: "role_1",
        roleName: "Architect & Planner",
        focus: "Analyze requirements, design modular architecture, author specifications, and break down tasks.",
        harness: "codex",
        model: "gpt-4o",
      },
      {
        id: "role_2",
        roleName: "Core Developer",
        focus: "Write clean production code, implement features, integrate endpoints, and run local test suites.",
        harness: "opencode",
        model: "claude-3-5-sonnet",
      },
      {
        id: "role_3",
        roleName: "Code Reviewer & QA",
        focus: "Audit code diffs, verify security best practices, review test coverage, and inspect edge cases.",
        harness: "claude-native",
        model: "claude-3-5-sonnet",
      },
    ],
  },
  {
    title: "Security & Refactor",
    icon: ShieldCheckIcon,
    description: "Specialized in auditing vulnerabilities, code hygiene, and defensive refactoring.",
    roles: [
      {
        id: "role_1",
        roleName: "Security Auditor",
        focus: "Scan codebase for CVEs, permission bypasses, input validation flaws, and unsafe data flows.",
        harness: "codex",
        model: "gpt-4o",
      },
      {
        id: "role_2",
        roleName: "Refactoring Engineer",
        focus: "Apply structural improvements, decouple tight dependencies, and preserve existing unit tests.",
        harness: "opencode",
        model: "claude-3-5-sonnet",
      },
      {
        id: "role_3",
        roleName: "Regression Tester",
        focus: "Run test matrices, verify backwards compatibility, and benchmark performance metrics.",
        harness: "antigravity-native",
        model: "gemini-2.5-pro",
      },
    ],
  },
  {
    title: "TDD & Test Suite",
    icon: CompassIcon,
    description: "Test-driven development workflow: test specifications first, then robust implementation.",
    roles: [
      {
        id: "role_1",
        roleName: "Test Engineer",
        focus: "Draft failing test cases (unit, integration, e2e) according to functional requirements.",
        harness: "codex",
        model: "gpt-4o",
      },
      {
        id: "role_2",
        roleName: "Feature Implementer",
        focus: "Write minimal code required to pass all tests, then refactor cleanly.",
        harness: "opencode",
        model: "claude-3-5-sonnet",
      },
    ],
  },
];

const DEFAULT_ROLES: TeamMemberRole[] = PRESET_TEAMS[0].roles;

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function CreateAgentTeamDialog({
  open,
  onOpenChange,
  onCreate,
  initialName = "",
  initialDescription = "",
  initialRoles,
  initialHarness = "codex",
  initialModel = "gpt-4o",
  initialHostId = "",
  isEditMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: AgentBundleInput) => void | Promise<void>;
  initialName?: string;
  initialDescription?: string;
  initialRoles?: TeamMemberRole[];
  initialHarness?: string;
  initialModel?: string;
  initialHostId?: string;
  isEditMode?: boolean;
}) {
  const { data: hosts = [] } = useHosts();
  const onlineHosts = hosts.filter((h) => h.status === "online");

  const [teamName, setTeamName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [orchestratorHostId, setOrchestratorHostId] = useState(initialHostId);
  const [orchestratorHarness, setOrchestratorHarness] = useState(initialHarness);
  const [orchestratorModel, setOrchestratorModel] = useState(initialModel);
  const [roles, setRoles] = useState<TeamMemberRole[]>(initialRoles && initialRoles.length > 0 ? initialRoles : DEFAULT_ROLES);
  const [pending, setPending] = useState(false);

  // Sync initial props when dialog opens or props change
  useEffect(() => {
    if (open) {
      if (initialName) setTeamName(initialName);
      if (initialDescription) setDescription(initialDescription);
      if (initialRoles && initialRoles.length > 0) setRoles(initialRoles);
      if (initialHarness) setOrchestratorHarness(initialHarness);
      if (initialModel) setOrchestratorModel(initialModel);
      if (initialHostId) setOrchestratorHostId(initialHostId);
    }
  }, [open, initialName, initialDescription, initialRoles, initialHarness, initialModel, initialHostId]);

  const nameInvalid = teamName.trim().length > 0 && !AGENT_NAME_PATTERN.test(teamName.trim());
  const canSubmit = AGENT_NAME_PATTERN.test(teamName.trim()) && roles.length > 0;

  function applyPreset(preset: (typeof PRESET_TEAMS)[number]) {
    setRoles(preset.roles);
    if (!description || description.startsWith("Multi-role Agent Team")) {
      setDescription(preset.description);
    }
  }

  function addRole() {
    const newId = `role_${Date.now()}`;
    setRoles((prev) => [
      ...prev,
      {
        id: newId,
        roleName: `Specialist ${prev.length + 1}`,
        focus: "Specialized tasks for this team member",
        harness: "codex",
        model: "gpt-4o",
      },
    ]);
  }

  function removeRole(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRole(id: string, patch: Partial<TeamMemberRole>) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function generateTeamInstructions(): string {
    const roleDescriptions = roles
      .map(
        (r, idx) => `### Role ${idx + 1}: ${r.roleName}
- **Specialization / Focus**: ${r.focus}
- **Assigned Harness Engine**: ${r.harness}
- **Runtime Host**: ${r.hostId ? hosts.find((h) => h.host_id === r.hostId)?.name || r.hostId : "Default workspace"}
${r.model ? `- **Preferred Model**: ${r.model}` : ""}`,
      )
      .join("\n\n");

    return `# Agent Team: ${teamName.trim()}

You are the Lead Orchestrator of the "${teamName.trim()}" autonomous multi-role development team.
Your goal is to coordinate tasks across specialized team roles and deliver cohesive, robust solutions.

## Team Members & Responsibilities:

${roleDescriptions}

## Multi-Agent Team Collaboration Protocol:
1. **Planning & Task Decomposition**:
   - Begin by analyzing the user's objective and breaking it down into distinct subtasks.
   - Act as the primary coordinator, mapping each subtask to the most suited specialist member above.

2. **Sequential or Parallel Execution**:
   - For architecture design and technical discovery, rely on the Architect role.
   - For writing files, building modules, and refactoring, drive the Developer role.
   - For reviewing diffs and verifying edge cases, invoke the Reviewer/QA role.

3. **Synthesis & Transparency**:
   - Keep the user updated on what each team role is executing.
   - Once all phases complete, present a clear, unified summary of the work achieved and verify that all requirements have been met.
`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || pending) return;

    setPending(true);
    try {
      const instructions = generateTeamInstructions();
      const input: AgentBundleInput = {
        name: teamName.trim(),
        description:
          description.trim() ||
          `Multi-role Agent Team (${roles.map((r) => r.roleName).join(", ")})`,
        harness: orchestratorHarness,
        model: orchestratorModel.trim() || "gpt-4o",
        hostId: orchestratorHostId || undefined,
        instructions,
      };

      await onCreate(input);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-emerald-500" />
            <span>{isEditMode ? "Edit Agent Team" : "Create Agent Team (Multi-Role Orchestration)"}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure a coordinated team of AI agents (like Paseo Agent Team). Each role can be
            assigned specific responsibilities, engines, models, and runner hosts.
          </p>
        </DialogHeader>

        {/* Quick Presets */}
        <div className="flex flex-col gap-1.5 px-1">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Quick Templates
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEAMS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer"
                >
                  <Icon className="size-3.5 text-emerald-500" />
                  <span>{preset.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          {/* Team Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Team Identifier <span className="text-destructive">*</span>
            </label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. fullstack-dev-team"
              aria-invalid={nameInvalid || undefined}
              autoFocus
            />
            {nameInvalid && (
              <p className="text-xs text-destructive">
                Use only letters, numbers, hyphens, and underscores.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Team Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of this team's mission..."
            />
          </div>

          {/* Lead Orchestrator Configuration */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="size-3.5 text-emerald-500" />
                Lead Orchestrator (Primary Chat Coordinator)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Orchestrator Harness</label>
                <Select
                  value={orchestratorHarness}
                  onValueChange={(val) => setOrchestratorHarness(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">Codex (Runner Native)</SelectItem>
                    <SelectItem value="opencode">OpenCode (Runner Native)</SelectItem>
                    <SelectItem value="antigravity-native">Antigravity CLI</SelectItem>
                    <SelectItem value="claude-native">Claude Code CLI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Orchestrator Model</label>
                <Input
                  value={orchestratorModel}
                  onChange={(e) => setOrchestratorModel(e.target.value)}
                  placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Execution Host / Runner</label>
                <Select
                  value={orchestratorHostId || "__default__"}
                  onValueChange={(val) => setOrchestratorHostId(val === "__default__" ? "" : val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Default (auto-assign)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Auto (Default Workspace)</SelectItem>
                    {hosts.map((h) => (
                      <SelectItem key={h.host_id} value={h.host_id}>
                        {h.name} {h.status === "online" ? "● Online" : "○ Offline"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Member Roles */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <LayersIcon className="size-4 text-emerald-500" />
                Team Roles &amp; Specialists ({roles.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRole}
                className="h-7 text-xs gap-1"
              >
                <PlusIcon className="size-3" />
                Add Role
              </Button>
            </div>

            <div className="flex flex-col gap-2.5">
              {roles.map((role, index) => (
                <div
                  key={role.id}
                  className="rounded-lg border border-border bg-card/40 p-3 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <Input
                        value={role.roleName}
                        onChange={(e) => updateRole(role.id, { roleName: e.target.value })}
                        placeholder="Role Title (e.g. Backend Developer)"
                        className="h-7 text-xs font-medium max-w-[200px]"
                      />
                    </div>
                    {roles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeRole(role.id)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <Textarea
                    value={role.focus}
                    onChange={(e) => updateRole(role.id, { focus: e.target.value })}
                    placeholder="Describe this role's purpose, scope, and domain knowledge..."
                    className="min-h-[50px] text-xs resize-none"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] text-muted-foreground">Engine / Harness</label>
                      <Select
                        value={role.harness}
                        onValueChange={(val) => updateRole(role.id, { harness: val })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="codex">Codex (Runner Native)</SelectItem>
                          <SelectItem value="opencode">OpenCode (Runner Native)</SelectItem>
                          <SelectItem value="antigravity-native">Antigravity CLI</SelectItem>
                          <SelectItem value="claude-native">Claude Code CLI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] text-muted-foreground">Model</label>
                      <Input
                        value={role.model || ""}
                        onChange={(e) => updateRole(role.id, { model: e.target.value })}
                        placeholder="e.g. gpt-4o, claude-3-5"
                        className="h-7 text-xs font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <label className="text-[11px] text-muted-foreground">Host / Runtime</label>
                      <Select
                        value={role.hostId || "__default__"}
                        onValueChange={(val) =>
                          updateRole(role.id, { hostId: val === "__default__" ? undefined : val })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Inherit orchestrator host" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Inherit Host</SelectItem>
                          {hosts.map((h) => (
                            <SelectItem key={h.host_id} value={h.host_id}>
                              {h.name} {h.status === "online" ? "● Online" : "○ Offline"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || pending} loading={pending}>
              {isEditMode ? "Save Changes" : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
