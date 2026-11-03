import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BotIcon,
  CopyIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
  CpuIcon,
  SparklesIcon,
  LayersIcon,
  PencilIcon,
} from "lucide-react";
import { Link, useNavigate } from "@/lib/routing";
import { useServerInfo } from "@/lib/CapabilitiesContext";
import { customAgentsSettingsEnabled } from "@/lib/capabilities";
import { useAcpHarnessIds, useHarnessLabels } from "@/lib/agentLabels";
import { nativeCodingAgentForAgentName } from "@/lib/nativeCodingAgents";
import { isAcpHarnessAgent } from "@/lib/agentGrouping";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateAgentDialog, CreateAgentForm } from "@/shell/CreateAgentDialog";
import { CreateAgentTeamDialog, type TeamMemberRole } from "@/shell/CreateAgentTeamDialog";
import { TeamCompositionCard, parseTeamRoles } from "@/components/TeamCompositionCard";
import { useSettingsRoute } from "@/shell/settingsNav";
import {
  useCustomAgents,
  useCustomAgent,
  useCustomAgentConfig,
  useSaveCustomAgent,
  useDeleteCustomAgent,
  type ManagedAgent,
} from "@/hooks/useCustomAgents";
import { CustomAgentConfigForm } from "./CustomAgentConfigForm";
import { BackButton } from "./HarnessCatalog";
import { ApiError } from "@/lib/sessionsApi";
import { cn } from "@/lib/utils";

const BASE = "/settings/custom-agents";
const agentPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
const date = (value: number | null) =>
  value === null
    ? "—"
    : new Date(value * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

export function SettingsCustomAgentsSection() {
  const info = useServerInfo();
  const enabled = customAgentsSettingsEnabled(info);
  const supported = enabled && info !== "loading" && info.agent_detail === true;
  const { agentId } = useSettingsRoute();
  const navigate = useNavigate();
  const servers = useCustomAgents("server", supported && !agentId);
  const yours = useCustomAgents("user", supported && !agentId);
  const save = useSaveCustomAgent();
  const labels = useHarnessLabels(supported);
  const acpHarnesses = useAcpHarnessIds(supported);
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<"teams" | "all" | "single">("teams");
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [cloneAgent, setCloneAgent] = useState<ManagedAgent | null>(null);

  const serverAgents = useMemo(
    () => servers.data?.pages.flatMap((page) => page.data) ?? [],
    [servers.data],
  );
  const userAgents = useMemo(
    () => yours.data?.pages.flatMap((page) => page.data) ?? [],
    [yours.data],
  );
  const detailId = agentId === "new" ? undefined : agentId;
  const detail = useCustomAgent(detailId, supported);

  const searchTerm = search.trim().toLowerCase();
  const { builtins, filtered } = useMemo(() => {
    const matches = (a: ManagedAgent) =>
      `${a.name} ${a.description ?? ""}`.toLowerCase().includes(searchTerm);
    return {
      builtins: serverAgents.filter(
        (a) =>
          !(
            a.builtin &&
            (nativeCodingAgentForAgentName(a.name) ||
              isAcpHarnessAgent({
                harness: a.harness,
                acpHarness: acpHarnesses.has(a.harness ?? "") || undefined,
              }))
          ) && matches(a),
      ),
      filtered: userAgents.filter(matches),
    };
  }, [serverAgents, userAgents, acpHarnesses, searchTerm]);

  const isTeam = (a: ManagedAgent) => {
    if (a.name === "agent-team") return true;
    if (a.name.toLowerCase().includes("team")) return true;
    if (a.instructions && (a.instructions.includes("## Team Members & Responsibilities") || a.instructions.includes("### Role 1:"))) return true;
    if (a.description?.toLowerCase().includes("multi-role agent team")) return true;
    if (Boolean(parseTeamRoles(a.instructions, a.description))) return true;
    return false;
  };

  const teamAgents = useMemo(() => {
    return [...filtered, ...builtins].filter(isTeam);
  }, [filtered, builtins]);

  const singleAgents = useMemo(() => {
    return [...filtered, ...builtins].filter((a) => !isTeam(a));
  }, [filtered, builtins]);

  if (!enabled) return null;
  if (!supported) return <UnsupportedServer />;
  const back = (
    <BackButton label="Agents & Teams" to={BASE} componentId="settings.custom_agents.back" />
  );
  if (agentId === "new") {
    return (
      <div className="@container">
        {back}
        <h1 className="mb-6 text-2xl font-semibold">Create custom agent</h1>
        <CreateAgentForm
          submitLabel="Save agent"
          notice="Saving an existing installed agent's name replaces its entire configuration. Sessions using that agent will receive the update. Use a new name to keep both agents."
          onCancel={() => navigate(BASE)}
          onCreate={async (input) => {
            const agent = await save.mutateAsync(input);
            navigate(agentPath(agent.id));
          }}
        />
      </div>
    );
  }
  if (detailId) {
    return (
      <div className="@container">
        {!detail.data && back}
        {detail.isError && detail.data && (
          <p role="alert" className="mb-4 text-ui">
            Could not refresh this agent.{" "}
            <Button variant="link" onClick={() => void detail.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {detail.isError && !detail.data ? (
          detail.error instanceof ApiError && [405, 501].includes(detail.error.status) ? (
            <UnsupportedServer />
          ) : (
            <p role="alert">
              Could not load this agent.{" "}
              <Button variant="link" onClick={() => void detail.refetch()}>
                Retry
              </Button>
            </p>
          )
        ) : detail.data ? (
          <AgentDetail
            key={detail.data.id}
            agent={detail.data}
            owned={detail.data.user_owned}
            editable={info.agent_config_edit === true}
            harness={labels[detail.data.harness ?? ""] ?? detail.data.harness ?? "Unknown"}
            onDeleted={() => navigate(BASE)}
          />
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-semibold">Custom agent</h1>
            <p className="text-ui text-muted-foreground">
              {detail.isPending
                ? "Loading agent…"
                : "Agent not found. It may have been removed or belong to another user."}
            </p>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="@container">
      <div className="flex items-center justify-between pb-6">
        <div>
          <h1 className="text-2xl font-semibold">Agents &amp; Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage single AI agents and multi-role orchestrated agent teams.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-2.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Search agents"
            placeholder="Search agents or teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-ui outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={`${BASE}/new`} componentId="settings.custom_agents.create">
            <PlusIcon className="size-4" />
            Create Agent
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setCloneAgent(null);
            setTeamDialogOpen(true);
          }}
          className="gap-1.5 font-medium"
        >
          <UsersIcon className="size-4" />
          Create Team
        </Button>
      </div>

      {/* Segmented View Switcher */}
      <div className="mb-6 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/60 p-0.5">
          <button
            type="button"
            onClick={() => setViewTab("teams")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              viewTab === "teams"
                ? "bg-muted text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UsersIcon className="size-3.5" />
            <span>Agent Teams ({teamAgents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              viewTab === "all"
                ? "bg-muted text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BotIcon className="size-3.5" />
            <span>All Agents ({filtered.length + builtins.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("single")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              viewTab === "single"
                ? "bg-muted text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CpuIcon className="size-3.5" />
            <span>Single Agents ({singleAgents.length})</span>
          </button>
        </div>
      </div>

      <CreateAgentTeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        initialName={cloneAgent ? `my-${cloneAgent.name}` : ""}
        initialDescription={cloneAgent?.description ? `Custom team based on ${cloneAgent.name}` : ""}
        initialRoles={cloneAgent ? (parseTeamRoles(cloneAgent.instructions, cloneAgent.description) ?? undefined) : undefined}
        initialHarness={cloneAgent?.harness || "codex"}
        onCreate={async (input) => {
          const agent = await save.mutateAsync(input);
          navigate(agentPath(agent.id));
        }}
      />

      {(yours.hasNextPage || servers.hasNextPage) && (
        <p className="mb-4 text-xs text-muted-foreground">
          Search filters loaded agents. Load more to include older agents.
        </p>
      )}

      {/* 1. AGENT TEAMS VIEW */}
      {viewTab === "teams" && (
        <section aria-label="Agent Teams" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamAgents.map((team) => {
              const roles = parseTeamRoles(team.instructions, team.description) ?? [];
              const isOwned = !team.builtin;

              return (
                <div
                  key={team.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-border-strong hover:shadow-xs gap-3.5"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                          <UsersIcon className="size-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{team.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                              Team
                            </span>
                            {isOwned && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                                Custom
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Harness: {team.harness || "codex"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {team.description || "Multi-role orchestrated agent team."}
                    </p>

                    {/* Roles preview chips */}
                    {roles.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {roles.map((r, i) => (
                          <div
                            key={r.id || i}
                            className="flex items-center gap-1 rounded bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-foreground"
                          >
                            <span className="text-muted-foreground font-mono font-bold">#{i + 1}</span>
                            <span>{r.roleName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <Link
                      to={agentPath(team.id)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      View Team Details &rarr;
                    </Link>

                    {!isOwned && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setCloneAgent(team);
                          setTeamDialogOpen(true);
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <CopyIcon className="size-3" />
                        Customize as My Team
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {teamAgents.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
              <UsersIcon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No agent teams found</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Create an autonomous multi-role squad to divide complex work into planning, coding, and review.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setCloneAgent(null);
                  setTeamDialogOpen(true);
                }}
                className="mt-4 gap-1.5 font-medium"
              >
                <PlusIcon className="size-3.5" />
                Create Your First Team
              </Button>
            </div>
          )}
        </section>
      )}

      {/* 2. ALL / SINGLE AGENTS VIEW */}
      {viewTab !== "teams" && (
        <>
          <section className="mb-8" aria-label="Built-in agents">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Built-in &amp; server agents
            </h2>
            <div className="grid gap-3 @lg:grid-cols-2">
              {(viewTab === "single" ? builtins.filter((a) => !isTeam(a)) : builtins).map((agent) => (
                <Link
                  key={agent.id}
                  to={agentPath(agent.id)}
                  componentId="settings.custom_agents.review_server"
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 hover:bg-muted/40 transition-colors"
                >
                  <span className="flex items-center gap-3 font-medium">
                    {isTeam(agent) ? (
                      <UsersIcon className="size-5 shrink-0" aria-hidden />
                    ) : (
                      <BotIcon className="size-5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{agent.name}</span>
                    {isTeam(agent) && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                        Team
                      </span>
                    )}
                  </span>
                  <span className="text-ui text-muted-foreground line-clamp-2">
                    {agent.description || "Server-provided agent"}
                  </span>
                </Link>
              ))}
            </div>
            <ListStatus
              query={servers}
              scope="server"
              empty={builtins.length === 0}
              emptyText={search ? "No matching server agents." : "No server agents."}
            />
          </section>

          <section aria-label="Your agents">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Yours
            </h2>
            {(viewTab === "single" ? filtered.filter((a) => !isTeam(a)) : filtered).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-ui">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="h-10 px-2 font-medium">
                        Name
                      </th>
                      <th scope="col" className="h-10 w-[130px] px-2 font-medium">
                        Agent SDK
                      </th>
                      <th scope="col" className="h-10 w-[120px] whitespace-nowrap px-2 font-medium">
                        Created
                      </th>
                      <th scope="col" className="h-10 w-[120px] whitespace-nowrap px-2 font-medium">
                        Last edited
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewTab === "single" ? filtered.filter((a) => !isTeam(a)) : filtered).map((agent) => (
                      <tr
                        key={agent.id}
                        className="relative border-b border-border transition-colors last:border-0 hover:bg-muted/40 focus-within:bg-muted/40"
                      >
                        <td className="max-w-0 p-2">
                          <Link
                            to={agentPath(agent.id)}
                            componentId="settings.custom_agents.review"
                            className="flex items-center gap-2.5 rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={agent.name}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                              {isTeam(agent) ? (
                                <UsersIcon className="size-[15px]" aria-hidden />
                              ) : (
                                <BotIcon className="size-[15px]" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 font-medium">
                                <span className="truncate">{agent.name}</span>
                                {isTeam(agent) && (
                                  <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded font-medium">
                                    Team
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {agent.description}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap p-2">
                          {labels[agent.harness ?? ""] ?? agent.harness ?? "Unknown"}
                        </td>
                        <td className="whitespace-nowrap p-2">{date(agent.created_at)}</td>
                        <td className="whitespace-nowrap p-2">{date(agent.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ListStatus
              query={yours}
              scope="user"
              empty={filtered.length === 0}
              emptyText={
                search
                  ? "No matching agents in the loaded results."
                  : "No custom agents yet. Create an agent to keep it available for new sessions."
              }
            />
          </section>
        </>
      )}
    </div>
  );
}

function UnsupportedServer() {
  return (
    <p role="alert" className="text-ui text-muted-foreground">
      This Omnigent server does not support custom agents.
    </p>
  );
}

function ListStatus({
  query,
  scope,
  empty,
  emptyText,
}: {
  query: ReturnType<typeof useCustomAgents>;
  scope: "server" | "user";
  empty: boolean;
  emptyText: string;
}) {
  return (
    <>
      {query.isPending ? (
        <p className="text-ui text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <p role="alert" className="text-ui">
          Could not load {scope === "user" ? "your agents" : "server agents"}.{" "}
          <Button variant="link" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      ) : empty ? (
        <p className="text-ui text-muted-foreground">{emptyText}</p>
      ) : null}
      {query.hasNextPage && (
        <Button
          className="mt-4"
          variant="outline"
          loading={query.isFetchingNextPage}
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          Load more {scope === "user" ? "agents" : "server agents"}
        </Button>
      )}
    </>
  );
}

function AgentDetail({
  agent,
  owned,
  editable,
  harness,
  onDeleted,
}: {
  agent: ManagedAgent;
  owned: boolean | undefined;
  editable: boolean;
  harness: string;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const save = useSaveCustomAgent();
  const remove = useDeleteCustomAgent();
  const [confirm, setConfirm] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneAgentOpen, setCloneAgentOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editAgentOpen, setEditAgentOpen] = useState(false);
  const [inUse, setInUse] = useState<string | null>(null);

  const configQuery = useCustomAgentConfig(agent.id);
  const instructions = configQuery.data?.config?.instructions ?? agent.instructions;
  const description = configQuery.data?.config?.description ?? agent.description;
  const currentModel = configQuery.data?.config?.model ?? (agent as any).model;
  const currentHarness = configQuery.data?.config?.harness ?? agent.harness ?? harness;

  const teamRoles = useMemo(() => {
    return parseTeamRoles(instructions, description);
  }, [instructions, description]);

  const isTeam = useMemo(() => {
    if (Boolean(teamRoles)) return true;
    if (agent.name === "agent-team") return true;
    if (agent.name.toLowerCase().includes("team")) return true;
    if (description && description.toLowerCase().includes("team")) return true;
    if (instructions && instructions.includes("## Team Members & Responsibilities")) return true;
    if (instructions && instructions.includes("### Role 1:")) return true;
    return false;
  }, [teamRoles, agent.name, description, instructions]);

  function confirmDelete() {
    remove.reset();
    setInUse(null);
    setConfirm(true);
  }
  const canEdit = owned === true && editable;
  async function onRemove() {
    try {
      const count = await remove.mutateAsync({ id: agent.id, force: inUse !== null });
      if (count === null) onDeleted();
      else setInUse(count);
    } catch {
      /* The mutation error is displayed in the dialog. */
    }
  }

  // Unified visual detail view for Single Agents and Teams
  return (
    <>
      <BackButton label="Agents & Teams" to={BASE} componentId="settings.custom_agents.back" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="min-w-0 break-words text-2xl font-semibold">{agent.name}</h1>
          <span className="text-xs bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded font-medium shrink-0">
            {isTeam ? "Team" : "Single Agent"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!canEdit && (
            <Button
              size="sm"
              onClick={() => (isTeam ? setCloneOpen(true) : setCloneAgentOpen(true))}
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
              onClick={() => (isTeam ? setEditTeamOpen(true) : setEditAgentOpen(true))}
              className="gap-1.5"
            >
              <PencilIcon className="size-3.5" />
              {isTeam ? "Edit Team Roles" : "Edit Agent"}
            </Button>
          )}
          {owned === true && (
            <Button variant="ghost" size="icon" aria-label="Delete agent" onClick={confirmDelete}>
              <TrashIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-3 text-ui text-muted-foreground">
        {description || (isTeam ? "Multi-role orchestrated agent team." : "No description.")}
      </p>

      {/* Visual Team Composition Card */}
      {isTeam && teamRoles && (
        <TeamCompositionCard
          agentName={agent.name}
          roles={teamRoles}
          canEdit={canEdit}
          onCustomize={() => setCloneOpen(true)}
          onEditRoles={canEdit ? () => setEditTeamOpen(true) : undefined}
        />
      )}

      {/* System Instructions for Single Agent */}
      {!isTeam && instructions && (
        <section className="mt-5 rounded-xl border border-border bg-card/40 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            System Instructions
          </h2>
          <div className="rounded-lg bg-background/60 p-3 border border-border/50 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto text-foreground/90">
            {instructions}
          </div>
        </section>
      )}

      <CreateAgentTeamDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        initialName={`my-${agent.name}`}
        initialDescription={description || `Custom team based on ${agent.name}`}
        initialRoles={teamRoles || undefined}
        initialHarness={currentHarness || "codex"}
        initialModel={currentModel || ""}
        onCreate={async (input) => {
          const newAgent = await save.mutateAsync(input);
          navigate(agentPath(newAgent.id));
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
        open={editAgentOpen}
        onOpenChange={setEditAgentOpen}
        isEditMode
        initialValues={{
          name: agent.name,
          description: description || "",
          instructions: instructions || "",
          harness: currentHarness,
          model: currentModel || "",
          hostId: (configQuery.data?.config as any)?.host_id,
        }}
        onCreate={async (input) => {
          await save.mutateAsync({ ...input, name: agent.name });
          await configQuery.refetch();
          setEditAgentOpen(false);
        }}
      />

      <CreateAgentDialog
        open={cloneAgentOpen}
        onOpenChange={setCloneAgentOpen}
        initialValues={{
          name: `my-${agent.name}`,
          description: description || `Custom agent based on ${agent.name}`,
          instructions: instructions || "",
          harness: currentHarness,
          model: currentModel || "",
          hostId: (configQuery.data?.config as any)?.host_id,
        }}
        onCreate={async (input) => {
          const newAgent = await save.mutateAsync(input);
          navigate(agentPath(newAgent.id));
        }}
      />

      <dl className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-ui rounded-xl border border-border bg-card/40 p-4">
        <div>
          <dt className="text-xs text-muted-foreground">{isTeam ? "Lead Harness" : "Harness"}</dt>
          <dd className="text-sm font-medium">{currentHarness}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{isTeam ? "Orchestrator Model" : "Model"}</dt>
          <dd className="text-sm font-medium">{currentModel || "Default"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Version</dt>
          <dd className="text-sm font-medium">{agent.version}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd className="text-sm font-medium">{date(agent.created_at)}</dd>
        </div>
      </dl>

      {!isTeam && (
        <>
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              MCP servers
            </h2>
            {agent.mcp_servers?.length ? (
              <ul className="space-y-2">
                {agent.mcp_servers.map((server) => (
                  <li key={server.name} className="rounded-xl border border-border p-3">
                    <p className="text-ui font-medium">{server.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.transport}
                      {server.description ? ` · ${server.description}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-muted-foreground">No MCP servers listed.</p>
            )}
          </section>

          <section className="mb-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Skills
            </h2>
            {agent.skills?.length ? (
              <ul className="space-y-2">
                {agent.skills.map((skill) => (
                  <li key={skill.name} className="rounded-xl border border-border p-3">
                    <p className="text-ui font-medium">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-muted-foreground">No skills listed.</p>
            )}
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {owned === true
          ? editable
            ? "Changes apply to sessions on their next turn."
            : "Update the server to enable configuration editing."
          : owned === false
            ? "Server-provided agents are read-only. Click 'Customize as My Team' to clone and modify."
            : "Update the server to enable agent deletion. Ownership information is unavailable."}
      </p>

      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirm(open);
        }}
      >
        <DialogContent>
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
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => void onRemove()}
            >
              {inUse === null ? "Delete" : "Delete agent and sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
