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

export const HARNESS_DEFAULT_MODELS: Record<
  string,
  { id: string; label: string; isDefault?: boolean }[]
> = {
  codex: [
    { id: "gpt-4o", label: "GPT-4o (Omni - Recommended)", isDefault: true },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Lightweight)" },
    { id: "o1", label: "OpenAI o1 (Deep Reasoning)" },
    { id: "o3-mini", label: "OpenAI o3-mini (Math & Coding)" },
    { id: "chatgpt-4o-latest", label: "ChatGPT-4o (Latest Snapshot)" },
  ],
  "claude-native": [
    { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Hybrid Reasoning)", isDefault: true },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet v2" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast)" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus (Complex Analysis)" },
  ],
  claude: [
    { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Hybrid Reasoning)", isDefault: true },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet v2" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast)" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  opencode: [
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", isDefault: true },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "deepseek-chat", label: "DeepSeek V3" },
    { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoning)" },
    { id: "qwen2.5-coder-32b", label: "Qwen 2.5 Coder 32B" },
  ],
  "antigravity-native": [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Reasoning)", isDefault: true },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Ultra Fast)" },
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  antigravity: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Reasoning)", isDefault: true },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Ultra Fast)" },
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  cursor: [
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", isDefault: true },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "cursor-small", label: "Cursor Small" },
  ],
};

function RoleModelSelect({
  label = "Model",
  harness,
  hostId,
  value,
  onChange,
  heightClass = "h-7",
}: {
  label?: string;
  harness: string;
  hostId?: string;
  value?: string;
  onChange: (val: string) => void;
  heightClass?: string;
}) {
  const { data: hostModels, isLoading } = useHostModelOptions(
    hostId || null,
    harness,
    Boolean(hostId),
  );

  const fallbackModels = HARNESS_DEFAULT_MODELS[harness] || HARNESS_DEFAULT_MODELS["codex"];

  const options = useMemo(() => {
    if (hostModels && hostModels.length > 0) {
      return hostModels.map((m) => ({
        id: m.id || m.model || "",
        label: m.displayName || m.model || m.id,
        isDefault: m.isDefault,
      }));
    }
    return fallbackModels;
  }, [hostModels, fallbackModels]);

  const [isCustom, setIsCustom] = useState(false);

  // Auto-select default model if empty or doesn't match
  useEffect(() => {
    if (!value && options.length > 0) {
      const def = options.find((o) => o.isDefault) ?? options[0];
      if (def) onChange(def.id);
    }
  }, [value, options, onChange]);

  const matched = options.find((o) => o.id === value);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">{label}</label>
        {isLoading && (
          <span className="text-[10px] text-muted-foreground animate-pulse">Detecting…</span>
        )}
      </div>

      {!isCustom ? (
        <Select
          value={matched ? value : (options[0]?.id || "")}
          onValueChange={(val) => {
            if (val === "__custom__") {
              setIsCustom(true);
            } else {
              onChange(val);
            }
          }}
        >
          <SelectTrigger className={`${heightClass} text-xs font-mono`}>
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span>{opt.label}</span>
                  {opt.isDefault && (
                    <span className="text-[10px] text-emerald-500 font-medium">(Default)</span>
                  )}
                </div>
              </SelectItem>
            ))}
            <SelectItem value="__custom__" className="text-xs text-muted-foreground italic">
              + Custom / Other model…
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. claude-3-7-sonnet"
            className={`${heightClass} text-xs font-mono flex-1`}
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setIsCustom(false);
              const def = options.find((o) => o.isDefault) ?? options[0];
              if (def) onChange(def.id);
            }}
            className={`${heightClass} text-[10px] px-1.5 text-muted-foreground`}
          >
            Presets
          </Button>
        </div>
      )}
    </div>
  );
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
        model: "claude-3-7-sonnet-20250219",
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
  const [roles, setRoles] = useState<TeamMemberRole[]>(
    initialRoles && initialRoles.length > 0 ? initialRoles : DEFAULT_ROLES,
  );
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
    const defHarness = "opencode";
    const defModel = HARNESS_DEFAULT_MODELS[defHarness]?.[0]?.id || "claude-3-5-sonnet";
    setRoles((prev) => [
      ...prev,
      {
        id: newId,
        roleName: `Specialist ${prev.length + 1}`,
        focus: "Specialized tasks for this team member",
        harness: defHarness,
        model: defModel,
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
                  onValueChange={(val) => {
                    setOrchestratorHarness(val);
                    const def = HARNESS_DEFAULT_MODELS[val]?.[0]?.id || "gpt-4o";
                    setOrchestratorModel(def);
                  }}
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

              <RoleModelSelect
                label="Orchestrator Model"
                harness={orchestratorHarness}
                hostId={orchestratorHostId}
                value={orchestratorModel}
                onChange={setOrchestratorModel}
                heightClass="h-8"
              />

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
                        onValueChange={(val) => {
                          const def = HARNESS_DEFAULT_MODELS[val]?.[0]?.id || "gpt-4o";
                          updateRole(role.id, { harness: val, model: def });
                        }}
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

                    <RoleModelSelect
                      label="Model"
                      harness={role.harness}
                      hostId={role.hostId || orchestratorHostId}
                      value={role.model}
                      onChange={(newModel) => updateRole(role.id, { model: newModel })}
                      heightClass="h-7"
                    />

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
