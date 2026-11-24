import { useEffect, useMemo, useState } from "react";
import {
  BotIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  CpuIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { Link } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeamCompositionCard, parseTeamRoles } from "@/components/TeamCompositionCard";
import { CreateAgentDialog } from "@/shell/CreateAgentDialog";
import { CreateAgentTeamDialog } from "@/shell/CreateAgentTeamDialog";
import {
  useCustomAgentConfig,
  useDeleteCustomAgent,
  useSaveCustomAgent,
  type ManagedAgent,
} from "@/hooks/useCustomAgents";
import { useHosts, useHostModelOptions } from "@/hooks/useHosts";
import { useBrainHarnessLabels } from "@/lib/agentLabels";
import type { AgentBundleInput, MCPServerInput } from "@/lib/agentBundle";
import { CUSTOM_AGENT_DETAIL_ENTRY } from "@/pages/settings/search/catalog/customAgents";
import { settingsControlProps } from "@/pages/settings/search/settingsControl";
import { settingsOverlayProps } from "@/pages/settings/search/settingsOwnership";
import { cn } from "@/lib/utils";

const BASE = "/settings/custom-agents";

function formatDate(value: number | null) {
  return value === null
    ? "—"
    : new Date(value * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

interface MCPDraftEntry {
  key: number;
  name: string;
  transport: "http" | "stdio";
  url: string;
  command: string;
  args: string;
}

export interface AgentDetailViewProps {
  agent: ManagedAgent;
  owned: boolean | undefined;
  editable: boolean;
  harnessLabel: string;
  onDeleted: () => void;
  onNavigateAgent: (id: string) => void;
}

export function AgentDetailView({
  agent,
  owned,
  editable,
  harnessLabel,
  onDeleted,
  onNavigateAgent,
}: AgentDetailViewProps) {
  const save = useSaveCustomAgent();
  const remove = useDeleteCustomAgent();
  const { data: hosts = [] } = useHosts();
  const brainLabels = useBrainHarnessLabels();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [inUse, setInUse] = useState<string | null>(null);
  const [cloneTeamOpen, setCloneTeamOpen] = useState(false);
  const [cloneAgentOpen, setCloneAgentOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Properties rail popovers
  const [runtimePopoverOpen, setRuntimePopoverOpen] = useState(false);
  const [runtimeDrillHostId, setRuntimeDrillHostId] = useState<string | null>(null);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [savingProp, setSavingProp] = useState<string | null>(null);
  const [propError, setPropError] = useState<string | null>(null);

  const configQuery = useCustomAgentConfig(agent.id);
  const instructions = configQuery.data?.config?.instructions ?? agent.instructions ?? "";
  const description = configQuery.data?.config?.description ?? agent.description ?? "";
  const currentModel = configQuery.data?.config?.model ?? (agent as { model?: string }).model ?? "";
  const currentHarness = configQuery.data?.config?.harness ?? agent.harness ?? "codex";
  const currentHostId =
    (configQuery.data?.config as { host_id?: string } | undefined)?.host_id ?? "";

  const currentHost = useMemo(
    () => hosts.find((h) => h.host_id === currentHostId) ?? null,
    [hosts, currentHostId],
  );

  const {
    data: hostModels = [],
    isLoading: loadingModels,
    refetch: refetchModels,
    isFetching: fetchingModels,
  } = useHostModelOptions(
    currentHostId || null,
    currentHarness,
    Boolean(currentHostId) && (modelPopoverOpen || settingsOpen),
  );

  const teamRoles = useMemo(
    () => parseTeamRoles(instructions, description),
    [instructions, description],
  );

  const isTeam = useMemo(() => {
    if (teamRoles) return true;
    if (agent.name === "agent-team") return true;
    if (agent.name.toLowerCase().includes("team")) return true;
    if (description.toLowerCase().includes("team")) return true;
    if (instructions.includes("## Team Members & Responsibilities")) return true;
    if (instructions.includes("### Role 1:")) return true;
    return false;
  }, [teamRoles, agent.name, description, instructions]);

  const canEdit = owned === true && editable;
  const resolvedHarnessLabel = brainLabels[currentHarness] ?? harnessLabel ?? currentHarness;
  const hostOnline = currentHost ? currentHost.status === "online" : true;

  const existingMcpInputs: MCPServerInput[] = useMemo(() => {
    const cfgMap = configQuery.data?.config?.mcp_servers;
    if (!cfgMap) return [];
    return Object.entries(cfgMap).map(([name, m]) => ({
      name,
      transport: m.transport === "http" ? "http" : "stdio",
      url: m.url ?? undefined,
      command: m.command ?? undefined,
      args: m.args,
    }));
  }, [configQuery.data?.config?.mcp_servers]);

  async function saveAgentPatch(patch: Partial<AgentBundleInput>, propKey?: string) {
    if (propKey) setSavingProp(propKey);
    setPropError(null);
    try {
      await save.mutateAsync({
        name: agent.name,
        description: patch.description !== undefined ? patch.description : description || undefined,
        instructions:
          patch.instructions !== undefined ? patch.instructions : instructions || undefined,
        harness: patch.harness ?? currentHarness,
        model: patch.model ?? (currentModel || "default"),
        hostId: patch.hostId !== undefined ? patch.hostId : currentHostId || undefined,
        mcpServers:
          patch.mcpServers !== undefined
            ? patch.mcpServers
            : existingMcpInputs.length > 0
              ? existingMcpInputs
              : undefined,
      });
      await configQuery.refetch();
    } catch (err) {
      setPropError(err instanceof Error ? err.message : "Failed to update agent.");
      throw err;
    } finally {
      if (propKey) setSavingProp(null);
    }
  }

  async function onRemove() {
    try {
      const count = await remove.mutateAsync({ id: agent.id, force: inUse !== null });
      if (count === null) onDeleted();
      else setInUse(count);
    } catch {
      /* Displayed in dialog */
    }
  }

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

  const harnessEntries = useMemo(() => Object.entries(brainLabels), [brainLabels]);

  return (
    <div className="space-y-5">
      {/* Breadcrumb + Top Actions */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
          <Link
            to={BASE}
            componentId="settings.custom_agents.back"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Agents &amp; Teams
          </Link>
          <ChevronRightIcon className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground truncate">
            {isTeam ? (
              <UsersIcon className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
            ) : (
              <BotIcon className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
            )}
            <span className="truncate">{agent.name}</span>
          </span>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {!canEdit && (
            <Button
              size="sm"
              onClick={() => (isTeam ? setCloneTeamOpen(true) : setCloneAgentOpen(true))}
              className="gap-1.5 font-medium"
            >
              <CopyIcon className="size-3.5" />
              {isTeam ? "Customize as My Team" : "Customize Agent"}
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => (isTeam ? setEditTeamOpen(true) : setSettingsOpen(true))}
              className="gap-1.5"
            >
              <SlidersHorizontalIcon className="size-3.5" />
              {isTeam ? "Edit Team Roles" : "All settings"}
            </Button>
          )}
          {owned === true && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete agent"
              onClick={() => {
                remove.reset();
                setInUse(null);
                setConfirmDeleteOpen(true);
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <TrashIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Overview + Properties Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-6 items-start">
        {/* Left: Main Content */}
        <div className="min-w-0 space-y-6">
          {/* Identity Header */}
          <div className="flex items-start gap-3.5">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
              {isTeam ? (
                <UsersIcon className="size-5 text-foreground" aria-hidden />
              ) : (
                <BotIcon className="size-5 text-foreground" aria-hidden />
              )}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
                  hostOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground break-words">{agent.name}</h1>
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {isTeam ? "Team" : "Single Agent"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {description || (isTeam ? "Multi-role orchestrated agent team." : "No description.")}
              </p>
            </div>
          </div>

          {/* Team Composition */}
          {isTeam && teamRoles && (
            <TeamCompositionCard
              agentName={agent.name}
              roles={teamRoles}
              canEdit={canEdit}
              onCustomize={() => setCloneTeamOpen(true)}
              onEditRoles={canEdit ? () => setEditTeamOpen(true) : undefined}
            />
          )}

          {/* Instructions */}
          {!isTeam && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-foreground">Instructions</h2>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setSettingsOpen(true)}
                    className="h-6 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <PencilIcon className="size-3" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card/50 p-3.5 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-foreground/90">
                {instructions || (
                  <span className="text-muted-foreground italic">No instructions configured.</span>
                )}
              </div>
            </section>
          )}

          {/* Skills */}
          {!isTeam && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-foreground">
                Skills{" "}
                <span className="text-muted-foreground tabular-nums font-normal">
                  {agent.skills?.length ?? 0}
                </span>
              </h2>
              {agent.skills?.length ? (
                <ul className="space-y-2">
                  {agent.skills.map((skill) => (
                    <li
                      key={skill.name}
                      className="rounded-xl border border-border bg-card/40 px-3.5 py-2.5"
                    >
                      <p className="text-xs font-medium text-foreground">{skill.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {skill.description}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No skills assigned.</p>
              )}
            </section>
          )}

          {/* MCP Servers */}
          {!isTeam && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-foreground">
                MCP servers{" "}
                <span className="text-muted-foreground tabular-nums font-normal">
                  {agent.mcp_servers?.length ?? 0}
                </span>
              </h2>
              {agent.mcp_servers?.length ? (
                <ul className="space-y-2">
                  {agent.mcp_servers.map((server) => (
                    <li
                      key={server.name}
                      className="rounded-xl border border-border bg-card/40 px-3.5 py-2.5"
                    >
                      <p className="text-xs font-medium text-foreground">{server.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {server.transport}
                        {server.description ? ` · ${server.description}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No MCP servers configured.</p>
              )}
            </section>
          )}

          <p className="text-[11px] text-muted-foreground pt-2">
            {owned === true
              ? editable
                ? "Changes apply to sessions on their next turn."
                : "Update the server to enable configuration editing."
              : owned === false
                ? "Server-provided agents are read-only. Customize to create an editable copy."
                : "Ownership information is unavailable."}
          </p>
        </div>

        {/* Right: Properties Rail */}
        <aside
          aria-label="Agent properties"
          className="rounded-xl border border-border bg-card/40 p-4 lg:border-0 lg:border-l lg:rounded-none lg:bg-transparent lg:pl-5 lg:py-0 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground">Properties</h2>
            {savingProp && (
              <span className="text-[11px] text-muted-foreground">Saving…</span>
            )}
          </div>

          {propError && (
            <p role="alert" className="text-[11px] text-destructive">
              {propError}
            </p>
          )}

          <dl className="space-y-3 text-xs">
            {/* Status */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-1.5 font-medium text-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    hostOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
                  )}
                />
                <span>{hostOnline ? "Online · Idle" : "Offline"}</span>
              </dd>
            </div>

            {/* Runtime (Editable 2-level Picker) */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2 relative">
              <dt className="text-muted-foreground">Runtime</dt>
              <dd className="min-w-0">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModelPopoverOpen(false);
                      setRuntimeDrillHostId(null);
                      setRuntimePopoverOpen((v) => !v);
                    }}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-left font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    title="Change runtime host & harness"
                  >
                    <CpuIcon className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
                    <span className="truncate">
                      {resolvedHarnessLabel}
                      {currentHost ? ` · ${currentHost.name}` : ""}
                    </span>
                  </button>
                ) : (
                  <span className="truncate block font-medium text-foreground">
                    {resolvedHarnessLabel}
                    {currentHost ? ` · ${currentHost.name}` : ""}
                  </span>
                )}

                {runtimePopoverOpen && canEdit && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                    {runtimeDrillHostId === null ? (
                      <div className="space-y-1">
                        <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          Select runner host
                        </div>
                        {hosts.length === 0 ? (
                          <div className="space-y-0.5">
                            {harnessEntries.map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={async () => {
                                  setRuntimePopoverOpen(false);
                                  await saveAgentPatch({ harness: id, hostId: "" }, "runtime");
                                }}
                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 cursor-pointer"
                              >
                                <span>{label}</span>
                                {currentHarness === id && (
                                  <CheckIcon className="size-3.5 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          hosts.map((h) => (
                            <button
                              key={h.host_id}
                              type="button"
                              onClick={() => setRuntimeDrillHostId(h.host_id)}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 cursor-pointer"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full shrink-0",
                                    h.status === "online"
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/50",
                                  )}
                                />
                                <span className="truncate font-medium">{h.name}</span>
                              </span>
                              <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setRuntimeDrillHostId(null)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
                        >
                          <ChevronLeftIcon className="size-3.5" />
                          <span className="truncate">
                            {hosts.find((h) => h.host_id === runtimeDrillHostId)?.name ?? "Back"}
                          </span>
                        </button>
                        <div className="border-t border-border/60 pt-1 space-y-0.5">
                          {harnessEntries.map(([id, label]) => {
                            const active =
                              currentHostId === runtimeDrillHostId && currentHarness === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={async () => {
                                  const targetHost = runtimeDrillHostId;
                                  setRuntimePopoverOpen(false);
                                  await saveAgentPatch(
                                    { harness: id, hostId: targetHost },
                                    "runtime",
                                  );
                                }}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <CpuIcon className="size-3.5 text-muted-foreground" />
                                  <span>{label}</span>
                                </span>
                                {active && <CheckIcon className="size-3.5 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </dd>
            </div>

            {/* Harness */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <dt className="text-muted-foreground">Harness</dt>
              <dd className="font-medium text-foreground truncate">{resolvedHarnessLabel}</dd>
            </div>

            {/* Model (Editable Searchable Picker) */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2 relative">
              <dt className="text-muted-foreground">Model</dt>
              <dd className="min-w-0">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRuntimePopoverOpen(false);
                      setModelPopoverOpen((v) => !v);
                    }}
                    className="w-full rounded-md px-1.5 py-1 -mx-1.5 text-left font-mono text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors truncate cursor-pointer"
                    title={currentModel || "Default"}
                  >
                    {currentModel || "Default"}
                  </button>
                ) : (
                  <span className="font-mono text-[11px] font-medium text-foreground truncate block">
                    {currentModel || "Default"}
                  </span>
                )}

                {modelPopoverOpen && canEdit && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                    <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
                      <SearchIcon className="size-3 text-muted-foreground shrink-0" />
                      <input
                        type="search"
                        placeholder="Search or type model ID…"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                      />
                      {currentHostId && (
                        <button
                          type="button"
                          aria-label="Refresh models"
                          onClick={() => void refetchModels()}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <RefreshCwIcon
                            className={cn("size-3", fetchingModels && "animate-spin")}
                          />
                        </button>
                      )}
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {loadingModels ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">Loading models…</p>
                      ) : filteredModels.length === 0 ? (
                        <div className="p-2 space-y-2">
                          <p className="text-[11px] text-muted-foreground">
                            No probed models match.
                          </p>
                          {modelSearch.trim() && (
                            <Button
                              type="button"
                              size="xs"
                              className="w-full"
                              onClick={async () => {
                                const val = modelSearch.trim();
                                setModelPopoverOpen(false);
                                setModelSearch("");
                                await saveAgentPatch({ model: val }, "model");
                              }}
                            >
                              Use &ldquo;{modelSearch.trim()}&rdquo;
                            </Button>
                          )}
                        </div>
                      ) : (
                        filteredModels.map((m) => {
                          const id = m.id || m.model || "";
                          const active = currentModel === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={async () => {
                                setModelPopoverOpen(false);
                                setModelSearch("");
                                await saveAgentPatch({ model: id }, "model");
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 cursor-pointer",
                                active && "bg-muted",
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
              </dd>
            </div>

            {/* Version */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium text-foreground tabular-nums">v{agent.version}</dd>
            </div>

            {/* Created */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {formatDate(agent.created_at)}
              </dd>
            </div>

            {/* Last edited */}
            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <dt className="text-muted-foreground">Last edited</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {formatDate(agent.updated_at)}
              </dd>
            </div>
          </dl>

          {canEdit && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
                  <span>All settings</span>
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Contextual Two-Pane Agent Settings Dialog */}
      {canEdit && (
        <AgentSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          agentName={agent.name}
          initialDescription={description}
          initialInstructions={instructions}
          initialHostId={currentHostId}
          initialHarness={currentHarness}
          initialModel={currentModel}
          initialMcpServers={existingMcpInputs}
          onSave={async (draft) => {
            await saveAgentPatch(draft);
            setSettingsOpen(false);
          }}
        />
      )}

      {/* Team & Clone Dialogs */}
      <CreateAgentTeamDialog
        open={cloneTeamOpen}
        onOpenChange={setCloneTeamOpen}
        initialName={`my-${agent.name}`}
        initialDescription={description || `Custom team based on ${agent.name}`}
        initialRoles={teamRoles || undefined}
        initialHarness={currentHarness || "codex"}
        initialModel={currentModel || ""}
        onCreate={async (input) => {
          const newAgent = await save.mutateAsync(input);
          onNavigateAgent(newAgent.id);
        }}
      />

      <CreateAgentTeamDialog
        open={editTeamOpen}
        onOpenChange={setEditTeamOpen}
        initialName={agent.name}
        initialDescription={description || ""}
        initialRoles={teamRoles || undefined}
        initialHarness={currentHarness || "codex"}
        initialModel={currentModel || ""}
        isEditMode
        onCreate={async (input) => {
          await save.mutateAsync({ ...input, name: agent.name });
          await configQuery.refetch();
          setEditTeamOpen(false);
        }}
      />

      <CreateAgentDialog
        open={cloneAgentOpen}
        onOpenChange={setCloneAgentOpen}
        initialValues={{
          name: `my-${agent.name}`,
          description: description || `Custom agent based on ${agent.name}`,
          instructions,
          harness: currentHarness,
          model: currentModel,
          hostId: currentHostId || undefined,
        }}
        onCreate={async (input) => {
          const newAgent = await save.mutateAsync(input);
          onNavigateAgent(newAgent.id);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirmDeleteOpen(open);
        }}
      >
        <DialogContent
          showCloseButton={!remove.isPending}
          {...settingsOverlayProps(CUSTOM_AGENT_DETAIL_ENTRY, "delete")}
        >
          <DialogHeader>
            <DialogTitle>Delete {agent.name}</DialogTitle>
            <DialogDescription>
              {inUse === null ? (
                `Are you sure you want to delete ${agent.name}?`
              ) : (
                <span className="flex flex-col gap-2">
                  <span>
                    {agent.name} is used by {inUse} existing {inUse === "1" ? "session" : "sessions"}.
                  </span>
                  <span>Deleting it will also delete those sessions.</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p role="alert" className="text-ui text-destructive">
              Could not delete {agent.name}.
            </p>
          )}
          <DialogFooter>
            <Button
              data-settings-dialog-action="Cancel"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              {...settingsControlProps(
                CUSTOM_AGENT_DETAIL_ENTRY,
                "confirmDelete",
                inUse === null ? undefined : { alternative: "inUse" },
              )}
              variant="destructive"
              loading={remove.isPending}
              onClick={() => void onRemove()}
            >
              {inUse === null ? "Delete" : "Delete agent and sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentSettingsDialog({
  open,
  onOpenChange,
  agentName,
  initialDescription,
  initialInstructions,
  initialHostId,
  initialHarness,
  initialModel,
  initialMcpServers,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  initialDescription: string;
  initialInstructions: string;
  initialHostId: string;
  initialHarness: string;
  initialModel: string;
  initialMcpServers: MCPServerInput[];
  onSave: (patch: Partial<AgentBundleInput>) => Promise<void>;
}) {
  const [category, setCategory] = useState<"general" | "mcp">("general");
  const [description, setDescription] = useState(initialDescription);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [hostId, setHostId] = useState(initialHostId);
  const [harness, setHarness] = useState(initialHarness);
  const [model, setModel] = useState(initialModel);
  const [mcpEntries, setMcpEntries] = useState<MCPDraftEntry[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: hosts = [] } = useHosts();
  const brainLabels = useBrainHarnessLabels();
  const { data: hostModels = [] } = useHostModelOptions(
    hostId || null,
    harness,
    open && Boolean(hostId),
  );

  // Sync draft when dialog opens
  useEffect(() => {
    if (!open) return;
    setCategory("general");
    setDescription(initialDescription);
    setInstructions(initialInstructions);
    setHostId(initialHostId);
    setHarness(initialHarness);
    setModel(initialModel);
    setMcpEntries(
      initialMcpServers.map((m, idx) => ({
        key: idx,
        name: m.name,
        transport: m.transport,
        url: m.url ?? "",
        command: m.command ?? "",
        args: (m.args ?? []).join(" "),
      })),
    );
    setNextKey(initialMcpServers.length);
    setError(null);
  }, [
    open,
    initialDescription,
    initialInstructions,
    initialHostId,
    initialHarness,
    initialModel,
    initialMcpServers,
  ]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const mcpServers: MCPServerInput[] = [];
      for (const e of mcpEntries) {
        const name = e.name.trim();
        if (!name) continue;
        if (e.transport === "stdio") {
          if (!e.command.trim()) continue;
          mcpServers.push({
            name,
            transport: "stdio",
            command: e.command.trim(),
            args: e.args
              .split(/\s+/)
              .map((a) => a.trim())
              .filter(Boolean),
          });
        } else {
          if (!e.url.trim()) continue;
          mcpServers.push({ name, transport: "http", url: e.url.trim() });
        }
      }
      await onSave({
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        hostId: hostId || undefined,
        harness,
        model: model.trim() || "default",
        mcpServers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
          <DialogDescription className="text-xs">{agentName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] min-h-[380px] max-h-[70vh]">
          {/* Left Category Nav */}
          <nav
            aria-label="Settings categories"
            className="border-b sm:border-b-0 sm:border-r border-border p-2.5 flex sm:flex-col gap-1 bg-muted/20"
          >
            <button
              type="button"
              onClick={() => setCategory("general")}
              className={cn(
                "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer",
                category === "general"
                  ? "bg-muted text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setCategory("mcp")}
              className={cn(
                "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer",
                category === "mcp"
                  ? "bg-muted text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              MCP Servers ({mcpEntries.length})
            </button>
          </nav>

          {/* Right Form Area */}
          <div className="overflow-y-auto p-5 space-y-5">
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            )}

            {category === "general" ? (
              <>
                <section className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Profile</h3>
                  <div className="rounded-xl border border-border divide-y divide-border">
                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-center gap-2 p-3">
                      <span className="text-xs font-medium text-foreground">Name</span>
                      <Input value={agentName} readOnly disabled className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-start gap-2 p-3">
                      <label
                        htmlFor="settings-agent-desc"
                        className="text-xs font-medium text-foreground sm:pt-1.5"
                      >
                        Description
                      </label>
                      <Textarea
                        id="settings-agent-desc"
                        rows={2}
                        maxLength={255}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="text-xs resize-none min-h-[54px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-start gap-2 p-3">
                      <label
                        htmlFor="settings-agent-inst"
                        className="text-xs font-medium text-foreground sm:pt-1.5"
                      >
                        Instructions
                      </label>
                      <Textarea
                        id="settings-agent-inst"
                        rows={4}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="font-mono text-xs min-h-[90px]"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Execution</h3>
                  <div className="rounded-xl border border-border divide-y divide-border">
                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-center gap-2 p-3">
                      <span className="text-xs font-medium text-foreground">Runner Host</span>
                      <Select
                        value={hostId || "__none__"}
                        onValueChange={(v) => setHostId(v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Default host" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Default (server)</SelectItem>
                          {hosts.map((h) => (
                            <SelectItem key={h.host_id} value={h.host_id}>
                              <span className="flex items-center gap-2">
                                <ServerIcon className="size-3 text-muted-foreground" />
                                <span>{h.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({h.status})
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-center gap-2 p-3">
                      <span className="text-xs font-medium text-foreground">Harness</span>
                      <Select value={harness} onValueChange={setHarness}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(brainLabels).map(([id, label]) => (
                            <SelectItem key={id} value={id}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] items-center gap-2 p-3">
                      <label
                        htmlFor="settings-agent-model"
                        className="text-xs font-medium text-foreground"
                      >
                        Model
                      </label>
                      <div className="space-y-1.5">
                        <Input
                          id="settings-agent-model"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="Model ID"
                          className="h-8 text-xs font-mono"
                        />
                        {hostModels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {hostModels.slice(0, 5).map((m) => {
                              const id = m.id || m.model || "";
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setModel(id)}
                                  className={cn(
                                    "rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors cursor-pointer",
                                    model === id
                                      ? "border-primary bg-primary/10 text-foreground"
                                      : "border-border text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {id}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-medium text-foreground">MCP Servers</h3>
                    <p className="text-[11px] text-muted-foreground">
                      External tool servers attached to this agent.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setMcpEntries((prev) => [
                        ...prev,
                        {
                          key: nextKey,
                          name: "",
                          transport: "stdio",
                          url: "",
                          command: "",
                          args: "",
                        },
                      ]);
                      setNextKey((k) => k + 1);
                    }}
                    className="gap-1"
                  >
                    <PlusIcon className="size-3" />
                    Add server
                  </Button>
                </div>

                {mcpEntries.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No MCP servers configured.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {mcpEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="rounded-xl border border-border p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Server name"
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
                            onValueChange={(v: "http" | "stdio") =>
                              setMcpEntries((prev) =>
                                prev.map((m) =>
                                  m.key === entry.key ? { ...m, transport: v } : m,
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
                            aria-label="Remove server"
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
                              placeholder="Command"
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
                              placeholder="Args"
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
              </section>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 bg-card">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={saving}
            onClick={() => void handleSave()}
            className="font-medium"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
