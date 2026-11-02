import { useEffect, useMemo, useState } from "react";
import { PlusIcon, TrashIcon, UsersIcon, ShieldCheckIcon, Code2Icon, CompassIcon } from "lucide-react";
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

const DEFAULT_ROLES: TeamMemberRole[] = [
  {
    id: "role_1",
    roleName: "Architect & Planner",
    focus: "Analyze requirements, design modular architecture, break down tasks into actionable steps.",
    harness: "codex",
  },
  {
    id: "role_2",
    roleName: "Core Developer",
    focus: "Write and refactor code, apply changes to repository, run build and test commands.",
    harness: "opencode",
  },
  {
    id: "role_3",
    roleName: "Code Reviewer & QA",
    focus: "Review diffs, enforce coding standards, audit security, and verify edge-case coverage.",
    harness: "antigravity-native",
  },
];

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function CreateAgentTeamDialog({
  open,
  onOpenChange,
  onCreate,
  initialName = "",
  initialDescription = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: AgentBundleInput) => void | Promise<void>;
  initialName?: string;
  initialDescription?: string;
}) {
  const { data: hosts = [] } = useHosts();
  const onlineHosts = hosts.filter((h) => h.status === "online");

  const [teamName, setTeamName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [orchestratorHostId, setOrchestratorHostId] = useState("");
  const [orchestratorHarness, setOrchestratorHarness] = useState("codex");
  const [orchestratorModel, setOrchestratorModel] = useState("gpt-4o");
  const [roles, setRoles] = useState<TeamMemberRole[]>(DEFAULT_ROLES);
  const [pending, setPending] = useState(false);

  // Sync initial props when dialog opens
  useEffect(() => {
    if (open) {
      if (initialName) setTeamName(initialName);
      if (initialDescription) setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  // Model choices for orchestrator
  const { data: hostModels } = useHostModelOptions(
    orchestratorHostId || null,
    orchestratorHarness,
    Boolean(orchestratorHostId),
  );

  const nameInvalid = teamName.trim().length > 0 && !AGENT_NAME_PATTERN.test(teamName.trim());
  const canSubmit = AGENT_NAME_PATTERN.test(teamName.trim()) && roles.length > 0;

  function addRole() {
    const newId = `role_${Date.now()}`;
    setRoles((prev) => [
      ...prev,
      {
        id: newId,
        roleName: `Specialist ${prev.length + 1}`,
        focus: "Specialized tasks for this team member",
        harness: "codex",
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

You are the Lead Orchestrator of the "${teamName.trim()}" autonomous development team.
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
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-emerald-500" />
            <span>Create Agent Team (Multi-Role Orchestration)</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure a coordinated team of AI agents (like Paseo Agent Team). Each role can be
            assigned specific responsibilities, engines, and runner hosts.
          </p>
        </DialogHeader>

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
              placeholder="A short summary of this team's workflow and domain"
            />
          </div>

          {/* Lead Orchestrator Settings */}
          <div className="rounded-lg border border-border bg-card/60 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <CompassIcon className="size-4 text-primary" />
                Team Lead Orchestrator
              </span>
              <Badge variant="outline" className="text-xs font-normal">
                Coordinates the team
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Runtime / Host</label>
                <Select
                  value={orchestratorHostId || "__any__"}
                  onValueChange={(val) => setOrchestratorHostId(val === "__any__" ? "" : val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select host" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any / Standard</SelectItem>
                    {hosts.map((h) => (
                      <SelectItem key={h.host_id} value={h.host_id}>
                        {h.name} {h.status === "online" ? "● Online" : "○ Offline"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Harness Engine</label>
                <Select
                  value={orchestratorHarness}
                  onValueChange={setOrchestratorHarness}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">Codex (Runner Native)</SelectItem>
                    <SelectItem value="opencode">OpenCode (Runner Native)</SelectItem>
                    <SelectItem value="antigravity-native">Antigravity CLI</SelectItem>
                    <SelectItem value="claude-sdk">Claude SDK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Orchestrator Model</label>
              <Input
                value={orchestratorModel}
                onChange={(e) => setOrchestratorModel(e.target.value)}
                placeholder="e.g. gpt-4o, claude-3-5-sonnet, gemini-2.5-pro"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Member Roles */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Code2Icon className="size-4 text-emerald-500" />
                Team Roles ({roles.length})
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              Create Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
