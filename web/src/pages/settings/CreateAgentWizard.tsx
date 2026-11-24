import { useEffect, useMemo, useState } from "react";
import {
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CpuIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
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
import { useHosts, useHostModelOptions, type Host } from "@/hooks/useHosts";
import { BRAIN_HARNESS_LABELS, useBrainHarnessLabels } from "@/lib/agentLabels";
import type { AgentBundleInput, MCPServerInput } from "@/lib/agentBundle";
import { cn } from "@/lib/utils";

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_HARNESS = Object.keys(BRAIN_HARNESS_LABELS)[0] ?? "codex";

interface MCPFormEntry {
  key: number;
  name: string;
  transport: "http" | "stdio";
  url: string;
  command: string;
  args: string;
}

function emptyMCPEntry(key: number): MCPFormEntry {
  return { key, name: "", transport: "stdio", url: "", command: "", args: "" };
}

function toMCPInputs(entries: MCPFormEntry[]): MCPServerInput[] | undefined {
  const result: MCPServerInput[] = [];
  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    if (e.transport === "stdio") {
      const command = e.command.trim();
      if (!command) continue;
      result.push({
        name,
        transport: "stdio",
        command,
        args: e.args
          .split(/\s+/)
          .map((a) => a.trim())
          .filter(Boolean),
      });
    } else {
      const url = e.url.trim();
      if (!url) continue;
      result.push({ name, transport: "http", url });
    }
  }
  return result.length > 0 ? result : undefined;
}

function isHarnessReadyOnHost(host: Host, harnessId: string): boolean | string {
  const cfg = host.configured_harnesses;
  if (!cfg) return false;
  if (cfg[harnessId] !== undefined) return cfg[harnessId];
  if (cfg[`${harnessId}-native`] !== undefined) return cfg[`${harnessId}-native`];
  if (harnessId === "antigravity-native" && cfg["antigravity"] !== undefined) {
    return cfg["antigravity"];
  }
  return false;
}

export interface CreateAgentWizardProps {
  onCancel: () => void;
  onCreate: (input: AgentBundleInput) => Promise<{ id: string; name: string }>;
  onOpenAgent: (id: string) => void;
}

export function CreateAgentWizard({ onCancel, onCreate, onOpenAgent }: CreateAgentWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Runtime selection state
  const { data: hosts = [], isLoading: hostsLoading } = useHosts();
  const brainLabels = useBrainHarnessLabels();
  const [runtimeSearch, setRuntimeSearch] = useState("");
  const [expandedHostIds, setExpandedHostIds] = useState<Record<string, boolean>>({});
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [selectedHarness, setSelectedHarness] = useState<string>(DEFAULT_HARNESS);

  // Step 2: Configure state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [mcpEntries, setMcpEntries] = useState<MCPFormEntry[]>([]);
  const [nextMcpKey, setNextMcpKey] = useState(0);
  const [showMcpSection, setShowMcpSection] = useState(false);

  // Submission & Step 3 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{ id: string; name: string } | null>(null);

  // Auto-select and expand first online host
  useEffect(() => {
    if (hosts.length === 0) return;
    const firstOnline = hosts.find((h) => h.status === "online") ?? hosts[0];
    if (!selectedHostId && firstOnline) {
      setSelectedHostId(firstOnline.host_id);
      setExpandedHostIds((prev) => ({ ...prev, [firstOnline.host_id]: true }));
    }
  }, [hosts, selectedHostId]);

  const selectedHost = useMemo(
    () => hosts.find((h) => h.host_id === selectedHostId) ?? null,
    [hosts, selectedHostId],
  );

  const harnessList = useMemo(() => {
    return Object.entries(brainLabels).map(([id, label]) => ({ id, label }));
  }, [brainLabels]);

  const filteredHosts = useMemo(() => {
    const q = runtimeSearch.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => {
      if (h.name.toLowerCase().includes(q) || h.owner.toLowerCase().includes(q)) return true;
      return harnessList.some((har) => har.label.toLowerCase().includes(q));
    });
  }, [hosts, runtimeSearch, harnessList]);

  // Live-probe model options for selected host + harness
  const {
    data: hostModels = [],
    isLoading: loadingModels,
    refetch: refetchModels,
    isFetching: fetchingModels,
  } = useHostModelOptions(selectedHostId || null, selectedHarness, Boolean(selectedHostId));

  useEffect(() => {
    if (hostModels.length > 0 && !model) {
      const def = hostModels.find((m) => m.isDefault) ?? hostModels[0];
      if (def) setModel(def.id || def.model || "");
    }
  }, [hostModels, model]);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return hostModels;
    return hostModels.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.model && m.model.toLowerCase().includes(q)),
    );
  }, [hostModels, modelSearch]);

  const nameTrimmed = name.trim();
  const nameInvalid = nameTrimmed.length > 0 && !AGENT_NAME_PATTERN.test(nameTrimmed);
  const canSubmit =
    AGENT_NAME_PATTERN.test(nameTrimmed) && model.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onCreate({
        name: nameTrimmed,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        harness: selectedHarness,
        model: model.trim(),
        hostId: selectedHostId || undefined,
        mcpServers: toMCPInputs(mcpEntries),
      });
      setCreatedAgent(result);
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create agent.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedHarnessLabel = brainLabels[selectedHarness] ?? selectedHarness;

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] rounded-xl border border-border bg-card overflow-hidden">
      {/* Top Stepper Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 bg-card">
        <div className="flex items-center gap-4 min-w-0 overflow-x-auto">
          <span className="text-sm font-semibold text-foreground shrink-0">Create an agent</span>
          <span className="h-4 w-px bg-border shrink-0" aria-hidden />
          <nav aria-label="Wizard steps" className="flex items-center gap-2 text-xs shrink-0">
            <StepPill index={1} label="Choose runtime" current={step} />
            <span className="w-6 h-px bg-border" aria-hidden />
            <StepPill index={2} label="Configure" current={step} />
            <span className="w-6 h-px bg-border" aria-hidden />
            <StepPill index={3} label="Done" current={step} />
          </nav>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
          Cancel
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {step === 1 && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Where should this agent run?
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a runner host and harness runtime for this agent.
                </p>
              </div>
              <div className="flex h-8 w-full sm:w-56 items-center gap-2 rounded-md border border-border bg-background px-2.5">
                <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  aria-label="Search harnesses or machines"
                  placeholder="Search harnesses or machines"
                  value={runtimeSearch}
                  onChange={(e) => setRuntimeSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Machines / Runner Hosts Group */}
            <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ServerIcon className="size-3.5" aria-hidden />
                  <span>Runner Hosts</span>
                  <span className="tabular-nums text-[11px] opacity-80">{filteredHosts.length}</span>
                </div>
              </div>

              {hostsLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading runner hosts…
                </div>
              ) : filteredHosts.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {hosts.length === 0
                      ? "No runner hosts connected. You can still configure a default harness."
                      : "No runner hosts match your search."}
                  </p>
                  {hosts.length === 0 && (
                    <div className="pt-2 flex flex-wrap justify-center gap-2">
                      {harnessList.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setSelectedHostId("");
                            setSelectedHarness(h.id);
                          }}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                            selectedHarness === h.id
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredHosts.map((host) => {
                    const isExpanded = Boolean(expandedHostIds[host.host_id]);
                    const isOnline = host.status === "online";
                    const readyCount = harnessList.filter(
                      (h) => isHarnessReadyOnHost(host, h.id) === true,
                    ).length;

                    return (
                      <div key={host.host_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHostIds((prev) => ({
                              ...prev,
                              [host.host_id]: !prev[host.host_id],
                            }))
                          }
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isExpanded ? (
                              <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                              <ServerIcon className="size-3.5 text-muted-foreground" />
                              <span
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background",
                                  isOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
                                )}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {host.name}
                                </span>
                                {host.owner && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {host.owner}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-xs">
                            <span className="text-muted-foreground tabular-nums hidden sm:inline">
                              {readyCount > 0
                                ? `${readyCount} ready`
                                : `${harnessList.length} harnesses`}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 font-medium",
                                isOnline ? "text-emerald-500" : "text-muted-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  isOnline ? "bg-emerald-500" : "bg-muted-foreground/60",
                                )}
                              />
                              {isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div
                            role="radiogroup"
                            aria-label={`Harnesses on ${host.name}`}
                            className="border-t border-border/60 bg-background/60 divide-y divide-border/50"
                          >
                            {harnessList.map((har) => {
                              const readiness = isHarnessReadyOnHost(host, har.id);
                              const isSelected =
                                selectedHostId === host.host_id && selectedHarness === har.id;

                              return (
                                <label
                                  key={har.id}
                                  className={cn(
                                    "flex items-center justify-between gap-3 pl-11 pr-4 py-2.5 text-xs cursor-pointer transition-colors",
                                    isSelected ? "bg-muted/70" : "hover:bg-muted/30",
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <input
                                      type="radio"
                                      name="wizard-runtime-choice"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedHostId(host.host_id);
                                        setSelectedHarness(har.id);
                                        setModel("");
                                      }}
                                      className="accent-primary size-3.5 shrink-0"
                                    />
                                    <CpuIcon
                                      className="size-3.5 text-muted-foreground shrink-0"
                                      aria-hidden
                                    />
                                    <span className="font-medium text-foreground">{har.label}</span>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {har.id}
                                    </span>
                                  </div>
                                  <span className="shrink-0">
                                    {readiness === true ? (
                                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                                        Ready
                                      </span>
                                    ) : readiness === "needs-auth" ? (
                                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                                        Needs auth
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground/70">
                                        Available
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Configure the agent</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define identity, behavior instructions, and model selection.
              </p>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
              >
                {submitError}
              </div>
            )}

            {/* Identity Section */}
            <section className="space-y-1.5">
              <h2 className="text-xs font-medium text-muted-foreground">Identity</h2>
              <div className="rounded-xl border border-border bg-background/40 divide-y divide-border">
                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-2 sm:gap-4 p-4">
                  <label
                    htmlFor="wizard-agent-name"
                    className="text-xs font-medium text-foreground sm:pt-2"
                  >
                    Name <span className="text-destructive">*</span>
                  </label>
                  <div className="space-y-1">
                    <Input
                      id="wizard-agent-name"
                      placeholder="e.g. deep-research-agent"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                      aria-invalid={nameInvalid}
                      className="h-8 text-xs"
                    />
                    {nameInvalid ? (
                      <p className="text-[11px] text-destructive">
                        Use only letters, numbers, hyphens, and underscores.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Unique identifier (letters, numbers, hyphens, underscores).
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-2 sm:gap-4 p-4">
                  <label
                    htmlFor="wizard-agent-description"
                    className="text-xs font-medium text-foreground sm:pt-2"
                  >
                    Description
                  </label>
                  <div className="space-y-1">
                    <Textarea
                      id="wizard-agent-description"
                      placeholder="What does this agent do?"
                      maxLength={255}
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting}
                      className="text-xs resize-none min-h-[60px]"
                    />
                    <div className="flex justify-end text-[11px] text-muted-foreground tabular-nums">
                      {description.length} / 255
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Behavior & Capabilities */}
            <section className="space-y-1.5">
              <h2 className="text-xs font-medium text-muted-foreground">
                Behavior &amp; capabilities
              </h2>
              <div className="rounded-xl border border-border bg-background/40 divide-y divide-border">
                <div className="p-4 space-y-2">
                  <label
                    htmlFor="wizard-agent-instructions"
                    className="block text-xs font-medium text-foreground"
                  >
                    Instructions
                  </label>
                  <Textarea
                    id="wizard-agent-instructions"
                    placeholder="Write what this agent should do, what to focus on, what to avoid…"
                    rows={5}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={submitting}
                    className="font-mono text-xs min-h-[110px]"
                  />
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      MCP Servers ({mcpEntries.length})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        setShowMcpSection(true);
                        setMcpEntries((prev) => [...prev, emptyMCPEntry(nextMcpKey)]);
                        setNextMcpKey((k) => k + 1);
                      }}
                      className="h-7 gap-1 text-xs"
                    >
                      <PlusIcon className="size-3" />
                      Add MCP server
                    </Button>
                  </div>

                  {showMcpSection && mcpEntries.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {mcpEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className="rounded-lg border border-border bg-card p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Server name (e.g. github)"
                              value={entry.name}
                              onChange={(e) =>
                                setMcpEntries((prev) =>
                                  prev.map((m) =>
                                    m.key === entry.key ? { ...m, name: e.target.value } : m,
                                  ),
                                )
                              }
                              className="h-7 text-xs flex-1"
                            />
                            <Select
                              value={entry.transport}
                              onValueChange={(val: "http" | "stdio") =>
                                setMcpEntries((prev) =>
                                  prev.map((m) =>
                                    m.key === entry.key ? { ...m, transport: val } : m,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="stdio">stdio</SelectItem>
                                <SelectItem value="http">http</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove MCP server"
                              onClick={() =>
                                setMcpEntries((prev) => prev.filter((m) => m.key !== entry.key))
                              }
                              className="size-7 text-muted-foreground hover:text-destructive"
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>
                          {entry.transport === "stdio" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Command (e.g. npx)"
                                value={entry.command}
                                onChange={(e) =>
                                  setMcpEntries((prev) =>
                                    prev.map((m) =>
                                      m.key === entry.key ? { ...m, command: e.target.value } : m,
                                    ),
                                  )
                                }
                                className="h-7 text-xs font-mono"
                              />
                              <Input
                                placeholder="Args (space separated)"
                                value={entry.args}
                                onChange={(e) =>
                                  setMcpEntries((prev) =>
                                    prev.map((m) =>
                                      m.key === entry.key ? { ...m, args: e.target.value } : m,
                                    ),
                                  )
                                }
                                className="h-7 text-xs font-mono"
                              />
                            </div>
                          ) : (
                            <Input
                              placeholder="https://..."
                              value={entry.url}
                              onChange={(e) =>
                                setMcpEntries((prev) =>
                                  prev.map((m) =>
                                    m.key === entry.key ? { ...m, url: e.target.value } : m,
                                  ),
                                )
                              }
                              className="h-7 text-xs font-mono"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Execution Section */}
            <section className="space-y-1.5">
              <div>
                <h2 className="text-xs font-medium text-muted-foreground">Execution</h2>
                <p className="text-[11px] text-muted-foreground/80">
                  Runtime and model used when starting sessions with this agent.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">Runtime</span>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {selectedHarnessLabel}
                        {selectedHost ? ` (${selectedHost.name})` : ""}
                      </div>
                      {selectedHost && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              selectedHost.status === "online"
                                ? "bg-emerald-500"
                                : "bg-muted-foreground/50",
                            )}
                          />
                          <span className="truncate">{selectedHost.name}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setStep(1)}
                      className="h-7 text-xs shrink-0"
                    >
                      Change
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label
                    htmlFor="wizard-agent-model"
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    Model <span className="text-destructive">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        id="wizard-agent-model"
                        placeholder="Select or type model ID…"
                        value={model}
                        onFocus={() => setModelMenuOpen(true)}
                        onChange={(e) => {
                          setModel(e.target.value);
                          setModelSearch(e.target.value);
                          setModelMenuOpen(true);
                        }}
                        disabled={submitting}
                        className="h-9 text-xs font-mono pr-8"
                      />
                      <button
                        type="button"
                        aria-label="Toggle model list"
                        onClick={() => setModelMenuOpen((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDownIcon className="size-3.5" />
                      </button>
                    </div>
                    {selectedHostId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Refresh models"
                        disabled={fetchingModels}
                        onClick={() => void refetchModels()}
                        className="size-9 shrink-0"
                      >
                        <RefreshCwIcon
                          className={cn("size-3.5", fetchingModels && "animate-spin")}
                        />
                      </Button>
                    )}
                  </div>

                  {modelMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
                        <SearchIcon className="size-3 text-muted-foreground shrink-0" />
                        <input
                          type="search"
                          placeholder="Search or type a model ID…"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {loadingModels ? (
                          <p className="px-2.5 py-3 text-xs text-muted-foreground">
                            Probing models from host…
                          </p>
                        ) : filteredModels.length === 0 ? (
                          <p className="px-2.5 py-3 text-xs text-muted-foreground">
                            No probed models found. Type a custom model ID above.
                          </p>
                        ) : (
                          filteredModels.map((m) => {
                            const id = m.id || m.model || "";
                            const active = model === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  setModel(id);
                                  setModelSearch("");
                                  setModelMenuOpen(false);
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                                  active ? "bg-muted text-foreground" : "hover:bg-muted/50",
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{m.label}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                                    {id}
                                  </div>
                                </div>
                                {active && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {step === 3 && createdAgent && (
          <div className="mx-auto max-w-md py-8 text-center space-y-6">
            <div className="mx-auto flex h-24 w-full items-center justify-center rounded-xl border border-border bg-background/50">
              <SparklesIcon className="size-7 text-primary" aria-hidden />
            </div>

            <div className="space-y-1.5">
              <div className="relative mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted">
                <BotIcon className="size-6 text-foreground" />
                <CheckCircle2Icon className="absolute -bottom-1 -right-1 size-5 rounded-full bg-card text-emerald-500" />
              </div>
              <h1 className="text-lg font-semibold text-foreground pt-2">
                {createdAgent.name} is ready
              </h1>
              <p className="text-xs text-muted-foreground">
                Runs on {selectedHarnessLabel}
                {selectedHost ? ` (${selectedHost.name})` : ""}
              </p>
            </div>

            <div className="space-y-2 text-left">
              <p className="text-[11px] font-medium text-muted-foreground">What next</p>
              <button
                type="button"
                onClick={() => onOpenAgent(createdAgent.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span>Open agent details &amp; properties</span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span>Return to Agents &amp; Teams list</span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <footer className="flex items-center justify-between border-t border-border px-5 py-3 bg-card">
        <span className="text-xs text-muted-foreground tabular-nums">Step {step} of 3</span>
        <div className="flex items-center gap-2">
          {step === 1 && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setStep(2)}
                className="gap-1 font-medium"
              >
                Next
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit}
                loading={submitting}
                onClick={() => void handleSubmit()}
                className="font-medium"
              >
                Create agent
              </Button>
            </>
          )}
          {step === 3 && createdAgent && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Back to agents
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onOpenAgent(createdAgent.id)}
                className="font-medium"
              >
                Open agent
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepPill({
  index,
  label,
  current,
}: {
  index: 1 | 2 | 3;
  label: string;
  current: 1 | 2 | 3;
}) {
  const done = current > index;
  const active = current === index;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        active ? "text-foreground font-medium" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
          done
            ? "bg-emerald-500/20 text-emerald-500"
            : active
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground",
        )}
      >
        {done ? <CheckIcon className="size-2.5" /> : index}
      </span>
      <span>{label}</span>
    </span>
  );
}
