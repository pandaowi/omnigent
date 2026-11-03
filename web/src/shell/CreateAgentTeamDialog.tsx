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
import { cn } from "@/lib/utils";
import { BRAIN_HARNESS_LABELS, useBrainHarnessLabels } from "@/lib/agentLabels";
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

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const HARNESS_FALLBACK_MODELS: Record<string, { id: string; displayName: string; isDefault?: boolean }[]> = {
  codex: [
    { id: "gpt-5.6-sol", displayName: "GPT 5.6 Sol", isDefault: true },
    { id: "gpt-5.6-terra", displayName: "GPT 5.6 Terra" },
    { id: "gpt-5.6-luna", displayName: "GPT 5.6 Luna" },
    { id: "gpt-5-mini", displayName: "GPT 5 Mini" },
    { id: "gpt-4o", displayName: "GPT-4o" },
    { id: "gpt-4o-mini", displayName: "GPT-4o Mini" },
    { id: "o1", displayName: "o1" },
    { id: "o3-mini", displayName: "o3-mini" },
  ],
  "codex-native": [
    { id: "gpt-5.6-sol", displayName: "GPT 5.6 Sol", isDefault: true },
    { id: "gpt-5.6-terra", displayName: "GPT 5.6 Terra" },
    { id: "gpt-5.6-luna", displayName: "GPT 5.6 Luna" },
    { id: "gpt-5-mini", displayName: "GPT 5 Mini" },
    { id: "gpt-4o", displayName: "GPT-4o" },
    { id: "gpt-4o-mini", displayName: "GPT-4o Mini" },
    { id: "o1", displayName: "o1" },
    { id: "o3-mini", displayName: "o3-mini" },
  ],
  "antigravity-native": [
    { id: "gemini-3.8-flash-high", displayName: "Gemini 3.8 Flash (High)", isDefault: true },
    { id: "gemini-4-argon-high", displayName: "Gemini 4 Argon (High)" },
    { id: "gemini-3.8-flash-medium", displayName: "Gemini 3.8 Flash (Medium)" },
    { id: "claude-sonnet-5-5-high", displayName: "Claude Sonnet 5.5 (High)" },
    { id: "gpt-oss-120b-medium", displayName: "GPT OSS 120B (Medium)" },
  ],
  antigravity: [
    { id: "gemini-3.8-flash-high", displayName: "Gemini 3.8 Flash (High)", isDefault: true },
    { id: "gemini-4-argon-high", displayName: "Gemini 4 Argon (High)" },
    { id: "gemini-3.8-flash-medium", displayName: "Gemini 3.8 Flash (Medium)" },
    { id: "claude-sonnet-5-5-high", displayName: "Claude Sonnet 5.5 (High)" },
    { id: "gpt-oss-120b-medium", displayName: "GPT OSS 120B (Medium)" },
  ],
  opencode: [
    { id: "gpt-5.6-sol", displayName: "GPT 5.6 Sol", isDefault: true },
    { id: "gpt-4o", displayName: "GPT-4o" },
    { id: "claude-3-7-sonnet", displayName: "Claude 3.7 Sonnet" },
    { id: "deepseek-chat", displayName: "DeepSeek-V3" },
  ],
  "opencode-native": [
    { id: "gpt-5.6-sol", displayName: "GPT 5.6 Sol", isDefault: true },
    { id: "gpt-4o", displayName: "GPT-4o" },
    { id: "claude-3-7-sonnet", displayName: "Claude 3.7 Sonnet" },
    { id: "deepseek-chat", displayName: "DeepSeek-V3" },
  ],
  "claude-native": [
    { id: "claude-3-7-sonnet-latest", displayName: "Claude 3.7 Sonnet", isDefault: true },
    { id: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku" },
  ],
  claude: [
    { id: "claude-3-7-sonnet-latest", displayName: "Claude 3.7 Sonnet", isDefault: true },
    { id: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku" },
  ],
  "claude-sdk": [
    { id: "claude-3-7-sonnet-latest", displayName: "Claude 3.7 Sonnet", isDefault: true },
    { id: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku" },
  ],
};

/**
 * Clean, single-control dynamic Model Picker.
 * - Prioritizes live-probed models from host runner.
 * - Provides graceful fallback options when host probe is loading or unavailable.
 * - Renders ONLY a select dropdown when picking from known models (no redundant input).
 * - Allows switching to custom model input via "+ Custom model identifier...".
 */
function HostModelPicker({
  label = "Model",
  harness,
  hostId,
  model,
  setModel,
  compact = false,
}: {
  label?: string;
  harness: string;
  hostId?: string | null;
  model: string;
  setModel: (val: string) => void;
  compact?: boolean;
}) {
  const probeHarness = harness === "codex" ? "codex-native" : harness;
  const { data: hostModels, isLoading } = useHostModelOptions(
    hostId || null,
    probeHarness,
    Boolean(hostId),
  );

  const availableModels = useMemo(() => {
    if (hostModels && hostModels.length > 0) {
      return hostModels.map((m) => ({
        id: m.id || m.model || "",
        displayName: m.displayName || m.model || m.id || "",
        isDefault: Boolean(m.isDefault),
      }));
    }
    return (
      HARNESS_FALLBACK_MODELS[harness] ||
      HARNESS_FALLBACK_MODELS[harness.replace("-native", "")] ||
      []
    );
  }, [hostModels, harness]);

  const [isCustom, setIsCustom] = useState(false);

  // Auto-sync default model from list when models load or harness changes
  useEffect(() => {
    if (availableModels.length > 0) {
      const match = availableModels.find((m) => m.id === model);
      if (!match) {
        if (!model) {
          const def = availableModels.find((m) => m.isDefault) ?? availableModels[0];
          if (def) {
            setModel(def.id);
            setIsCustom(false);
          }
        }
      } else {
        setIsCustom(false);
      }
    }
  }, [availableModels, harness]);

  const isKnownModel = availableModels.some((m) => m.id === model);
  const showCustomInput = isCustom || (Boolean(model) && !isKnownModel && availableModels.length > 0);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between h-4">
        <label
          className={cn(
            "text-muted-foreground truncate",
            compact ? "text-[11px]" : "text-xs font-medium",
          )}
        >
          {label} <span className="text-destructive">*</span>
        </label>
        {isLoading && (
          <span className="text-[10px] text-muted-foreground animate-pulse truncate">
            Detecting…
          </span>
        )}
      </div>

      {showCustomInput ? (
        <div className="flex items-center gap-1">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. gpt-4o, claude-3-5-sonnet"
            className={cn("w-full min-w-0 font-mono", compact ? "h-7 text-xs" : "h-8 text-xs")}
            autoFocus
          />
          {availableModels.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => {
                setIsCustom(false);
                const def = availableModels.find((m) => m.isDefault) ?? availableModels[0];
                if (def) setModel(def.id);
              }}
              title="Return to list of available models"
              className={compact ? "size-7 shrink-0 text-xs" : "size-8 shrink-0 text-xs"}
            >
              <SparklesIcon className="size-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      ) : (
        <Select
          value={model}
          onValueChange={(val) => {
            if (val === "__custom__") {
              setIsCustom(true);
              setModel("");
            } else {
              setIsCustom(false);
              setModel(val);
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "w-full min-w-0 font-mono text-left truncate",
              compact ? "h-7 text-xs" : "h-8 text-xs",
            )}
          >
            <SelectValue placeholder="Select model..." className="truncate" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {availableModels.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">{m.displayName || m.id}</span>
                  {m.isDefault && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                      Default
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
            <SelectItem
              value="__custom__"
              className="text-xs text-muted-foreground border-t border-border/40 mt-1 pt-1 italic font-sans"
            >
              + Custom model identifier...
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

const PRESET_TEAMS: {
  title: string;
  icon: typeof SparklesIcon;
  description: string;
  roles: Omit<TeamMemberRole, "id">[];
}[] = [
  {
    title: "Full-Stack Squad",
    icon: Code2Icon,
    description: "Standard end-to-end engineering squad with architecture, implementation, and review.",
    roles: [
      {
        roleName: "Architect & Planner",
        focus: "Analyze requirements, design modular architecture, author specifications, and break down tasks.",
        harness: "codex",
      },
      {
        roleName: "Core Developer",
        focus: "Write clean production code, implement features, integrate endpoints, and run local test suites.",
        harness: "opencode",
      },
      {
        roleName: "Code Reviewer & QA",
        focus: "Audit code diffs, verify security best practices, review test coverage, and inspect edge cases.",
        harness: "claude-native",
      },
    ],
  },
  {
    title: "Security & Refactor",
    icon: ShieldCheckIcon,
    description: "Specialized in auditing vulnerabilities, code hygiene, and defensive refactoring.",
    roles: [
      {
        roleName: "Security Auditor",
        focus: "Scan codebase for CVEs, permission bypasses, input validation flaws, and unsafe data flows.",
        harness: "codex",
      },
      {
        roleName: "Refactoring Engineer",
        focus: "Apply structural improvements, decouple tight dependencies, and preserve existing unit tests.",
        harness: "opencode",
      },
      {
        roleName: "Regression Tester",
        focus: "Run test matrices, verify backwards compatibility, and benchmark performance metrics.",
        harness: "antigravity-native",
      },
    ],
  },
  {
    title: "TDD & Test Suite",
    icon: CompassIcon,
    description: "Test-driven development workflow: test specifications first, then robust implementation.",
    roles: [
      {
        roleName: "Test Engineer",
        focus: "Draft failing test cases (unit, integration, e2e) according to functional requirements.",
        harness: "codex",
      },
      {
        roleName: "Feature Implementer",
        focus: "Write minimal code required to pass all tests, then refactor cleanly.",
        harness: "opencode",
      },
    ],
  },
];

export function CreateAgentTeamDialog({
  open,
  onOpenChange,
  onCreate,
  initialName = "",
  initialDescription = "",
  initialRoles,
  initialHarness = "codex",
  initialModel = "",
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
  const [roles, setRoles] = useState<TeamMemberRole[]>([]);
  const [pending, setPending] = useState(false);

  // Auto-bind to first online host if not set (matches CreateAgentDialog)
  useEffect(() => {
    if (hosts.length > 0 && !orchestratorHostId) {
      const firstOnline = hosts.find((h) => h.status === "online");
      if (firstOnline) {
        setOrchestratorHostId(firstOnline.host_id);
      }
    }
  }, [hosts, orchestratorHostId]);

  // Sync initial props when dialog opens or props change
  useEffect(() => {
    if (open) {
      if (initialName) setTeamName(initialName);
      if (initialDescription) setDescription(initialDescription);
      if (initialHarness) setOrchestratorHarness(initialHarness);
      if (initialModel) setOrchestratorModel(initialModel);
      if (initialHostId) setOrchestratorHostId(initialHostId);

      if (initialRoles && initialRoles.length > 0) {
        setRoles(initialRoles);
      } else if (roles.length === 0) {
        // Initialize default roles without hardcoded models; models will auto-resolve via HostModelPicker
        setRoles(
          PRESET_TEAMS[0].roles.map((r, i) => ({
            ...r,
            id: `role_${i + 1}`,
            model: "",
          })),
        );
      }
    }
  }, [open, initialName, initialDescription, initialRoles, initialHarness, initialModel, initialHostId]);

  const brainHarnessLabels = useBrainHarnessLabels(true);
  const selectedHost = useMemo(
    () => hosts.find((h) => h.host_id === orchestratorHostId),
    [hosts, orchestratorHostId],
  );

  // Build dynamic harness options with host readiness badges (matches CreateAgentDialog)
  const harnessOptions = useMemo(() => {
    const list: { value: string; label: string; badge?: string }[] = [
      { value: "codex", label: "Codex (Runner Native CLI)" },
      { value: "opencode", label: "OpenCode (Runner Native CLI)" },
      { value: "antigravity-native", label: "Antigravity CLI (Runner Native)" },
      { value: "claude-native", label: "Claude Code CLI (Runner Native)" },
      { value: "claude-sdk", label: "Claude SDK (Cloud API Key)" },
      { value: "openai-agents", label: "OpenAI Agents (Cloud API Key)" },
      { value: "cursor", label: "Cursor" },
      { value: "pi", label: "Pi" },
      { value: "copilot", label: "Copilot" },
    ];

    for (const [val, lbl] of Object.entries(brainHarnessLabels)) {
      if (!list.some((item) => item.value === val)) {
        list.push({ value: val, label: lbl });
      }
    }

    if (!selectedHost?.configured_harnesses) return list;

    return list.map((opt) => {
      const cfg = selectedHost.configured_harnesses;
      const isReady =
        cfg?.[opt.value] === true ||
        cfg?.[`${opt.value}-native`] === true ||
        (opt.value === "antigravity-native" &&
          (cfg?.["antigravity"] === true || cfg?.["antigravity-native"] === true));
      return {
        ...opt,
        badge: isReady ? "Ready on host" : opt.badge,
      };
    });
  }, [brainHarnessLabels, selectedHost]);

  const nameInvalid = teamName.trim().length > 0 && !AGENT_NAME_PATTERN.test(teamName.trim());
  const canSubmit = AGENT_NAME_PATTERN.test(teamName.trim()) && roles.length > 0;

  function applyPreset(preset: (typeof PRESET_TEAMS)[number]) {
    setRoles(
      preset.roles.map((r, i) => ({
        ...r,
        id: `role_${Date.now()}_${i}`,
        model: "",
      })),
    );
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
        harness: "opencode",
        model: "",
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
        model: orchestratorModel.trim() || undefined,
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
      <DialogContent className="flex max-h-[85vh] flex-col p-0 sm:max-w-3xl lg:max-w-4xl overflow-hidden gap-0 rounded-[24px]">
        <DialogHeader className="p-6 pb-3 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-primary" />
            <span>{isEditMode ? "Edit Agent Team" : "Create Agent Team (Multi-Role Orchestration)"}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure a coordinated team of AI agents. Each role can be assigned specific
            responsibilities, engines, live-probed models from hosts, and runner workspaces.
          </p>

          {/* Quick Presets */}
          <div className="flex flex-col gap-1.5 pt-2">
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
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span>{preset.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <form
          id="create-agent-team-form"
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-6 py-2"
        >
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
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="size-3.5 text-muted-foreground" />
                Lead Orchestrator (Primary Chat Coordinator)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center h-4">
                  <label className="text-xs font-medium text-muted-foreground truncate">
                    Harness <span className="text-destructive">*</span>
                  </label>
                </div>
                <Select
                  value={orchestratorHarness}
                  onValueChange={(val) => {
                    setOrchestratorHarness(val);
                    setOrchestratorModel("");
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 h-8 text-xs truncate">
                    <SelectValue className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {harnessOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center h-4">
                  <label className="text-xs font-medium text-muted-foreground truncate">Runner Host</label>
                </div>
                <Select
                  value={orchestratorHostId || "__default__"}
                  onValueChange={(val) => setOrchestratorHostId(val === "__default__" ? "" : val)}
                >
                  <SelectTrigger className="w-full min-w-0 h-8 text-xs truncate">
                    <SelectValue placeholder="Select runtime host" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__default__">Any / Cloud (Standard)</SelectItem>
                    {hosts.map((h) => (
                      <SelectItem key={h.host_id} value={h.host_id}>
                        <span className="truncate">{h.name}</span>{" "}
                        <span className={h.status === "online" ? "text-emerald-500 text-[11px]" : "text-muted-foreground text-[11px]"}>
                          {h.status === "online" ? "● Online" : "○ Offline"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <HostModelPicker
                label="Orchestrator Model"
                harness={orchestratorHarness}
                hostId={orchestratorHostId}
                model={orchestratorModel}
                setModel={setOrchestratorModel}
              />
            </div>
          </div>

          {/* Member Roles */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <LayersIcon className="size-4 text-muted-foreground" />
                Team Roles &amp; Specialists ({roles.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRole}
                className="h-7 text-xs gap-1.5"
              >
                <PlusIcon className="size-3" />
                Add Role
              </Button>
            </div>

            <div className="flex flex-col gap-2.5">
              {roles.map((role, index) => {
                const roleHost = role.hostId || orchestratorHostId;
                return (
                  <div
                    key={role.id}
                    className="rounded-xl border border-border bg-card/40 p-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center h-4">
                          <label className="text-[11px] text-muted-foreground truncate">
                            Harness <span className="text-destructive">*</span>
                          </label>
                        </div>
                        <Select
                          value={role.harness}
                          onValueChange={(val) => {
                            updateRole(role.id, { harness: val, model: "" });
                          }}
                        >
                          <SelectTrigger className="w-full min-w-0 h-7 text-xs truncate">
                            <SelectValue className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {harnessOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span className="truncate">{opt.label}</span>
                                  {opt.badge && (
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                      {opt.badge}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center h-4">
                          <label className="text-[11px] text-muted-foreground truncate">Runner Host</label>
                        </div>
                        <Select
                          value={role.hostId || "__default__"}
                          onValueChange={(val) =>
                            updateRole(role.id, { hostId: val === "__default__" ? undefined : val })
                          }
                        >
                          <SelectTrigger className="w-full min-w-0 h-7 text-xs truncate">
                            <SelectValue placeholder="Inherit orchestrator host" className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="__default__">Inherit Host</SelectItem>
                            {hosts.map((h) => (
                              <SelectItem key={h.host_id} value={h.host_id}>
                                <span className="truncate">{h.name}</span>{" "}
                                <span className={h.status === "online" ? "text-emerald-500 text-[11px]" : "text-muted-foreground text-[11px]"}>
                                  {h.status === "online" ? "● Online" : "○ Offline"}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <HostModelPicker
                        label="Model"
                        harness={role.harness}
                        hostId={roleHost}
                        model={role.model || ""}
                        setModel={(newModel) => updateRole(role.id, { model: newModel })}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        <DialogFooter className="p-6 pt-3 border-t border-border/40 bg-card/30">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-agent-team-form"
            disabled={!canSubmit || pending}
            loading={pending}
          >
            {isEditMode ? "Save Changes" : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
