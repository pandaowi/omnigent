import { useMemo, useState } from "react";
import {
  BotIcon,
  CopyIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
  CpuIcon,
} from "lucide-react";
import { Link, useNavigate } from "@/lib/routing";
import { useServerInfo } from "@/lib/CapabilitiesContext";
import { customAgentsSettingsEnabled } from "@/lib/capabilities";
import { useAcpHarnessIds, useHarnessLabels } from "@/lib/agentLabels";
import { nativeCodingAgentForAgentName } from "@/lib/nativeCodingAgents";
import { isAcpHarnessAgent } from "@/lib/agentGrouping";
import { Button } from "@/components/ui/button";
import { CreateAgentTeamDialog } from "@/shell/CreateAgentTeamDialog";
import { parseTeamRoles } from "@/components/TeamCompositionCard";
import { useSettingsRoute } from "@/shell/settingsNav";
import {
  useCustomAgents,
  useCustomAgent,
  useSaveCustomAgent,
  type ManagedAgent,
} from "@/hooks/useCustomAgents";
import {
  CUSTOM_AGENT_CREATE_ENTRY,
  CUSTOM_AGENT_DETAIL_ENTRY,
  CUSTOM_AGENTS_LIST_ENTRY,
} from "@/pages/settings/search/catalog/customAgents";
import { SettingsItem } from "@/pages/settings/search/SettingsItem";
import { settingsControlProps } from "@/pages/settings/search/settingsControl";
import { BackButton } from "./HarnessCatalog";
import { CreateAgentWizard } from "./CreateAgentWizard";
import { AgentDetailView } from "./AgentDetailView";
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
    if (parseTeamRoles(a.instructions, a.description)) return true;
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
      <SettingsItem entry={CUSTOM_AGENT_CREATE_ENTRY} className="@container flex-1 flex flex-col">
        <CreateAgentWizard
          onCancel={() => navigate(BASE)}
          onCreate={async (input) => {
            const agent = await save.mutateAsync(input);
            return { id: agent.id, name: agent.name };
          }}
          onOpenAgent={(id) => navigate(agentPath(id))}
        />
      </SettingsItem>
    );
  }
  if (detailId) {
    return (
      <SettingsItem entry={CUSTOM_AGENT_DETAIL_ENTRY} className="@container px-6 md:px-8 py-6">
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
          <AgentDetailView
            key={detail.data.id}
            agent={detail.data}
            owned={detail.data.user_owned}
            editable={info.agent_config_edit === true}
            harnessLabel={labels[detail.data.harness ?? ""] ?? detail.data.harness ?? "Unknown"}
            onDeleted={() => navigate(BASE)}
            onNavigateAgent={(id) => navigate(agentPath(id))}
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
      </SettingsItem>
    );
  }
  return (
    <SettingsItem entry={CUSTOM_AGENTS_LIST_ENTRY} className="@container px-6 md:px-8 py-6">
      <div className="flex items-center justify-between pb-6">
        <div>
          <h1 className="settings-page-title text-2xl font-medium">Agents &amp; Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage single AI agents and multi-role orchestrated agent teams.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-2.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            {...settingsControlProps(CUSTOM_AGENTS_LIST_ENTRY, "search")}
            type="search"
            aria-label="Search agents"
            placeholder="Search agents or teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-ui outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <Button asChild size="sm" variant="outline">
          <Link
            {...settingsControlProps(CUSTOM_AGENTS_LIST_ENTRY, "create")}
            to={`${BASE}/new`}
            componentId="settings.custom_agents.create"
          >
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
        <div className="space-y-6">
          <section aria-label="Your agents">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium text-muted-foreground">Custom Agents</h2>
            </div>
            {(viewTab === "single" ? filtered.filter((a) => !isTeam(a)) : filtered).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border bg-card/30">
                <table className="w-full min-w-[42rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th scope="col" className="h-9 px-3 font-medium">
                        Agent
                      </th>
                      <th scope="col" className="h-9 w-[100px] px-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="h-9 w-[140px] px-3 font-medium">
                        Runtime
                      </th>
                      <th scope="col" className="h-9 w-[110px] whitespace-nowrap px-3 font-medium">
                        Created
                      </th>
                      <th scope="col" className="h-9 w-[110px] whitespace-nowrap px-3 font-medium">
                        Last edited
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(viewTab === "single" ? filtered.filter((a) => !isTeam(a)) : filtered).map(
                      (agent) => (
                        <tr
                          key={agent.id}
                          className="relative transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
                        >
                          <td className="max-w-0 px-3 py-2.5">
                            <Link
                              to={agentPath(agent.id)}
                              componentId="settings.custom_agents.review"
                              className="flex items-center gap-2.5 rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={agent.name}
                            >
                              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                                {isTeam(agent) ? (
                                  <UsersIcon className="size-3.5" aria-hidden />
                                ) : (
                                  <BotIcon className="size-3.5" aria-hidden />
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                              </span>
                              <span className="min-w-0 flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {agent.name}
                                </span>
                                {isTeam(agent) && (
                                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                                    Team
                                  </span>
                                )}
                                {agent.description && (
                                  <span className="truncate text-muted-foreground hidden sm:inline">
                                    {agent.description}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                            {labels[agent.harness ?? ""] ?? agent.harness ?? "Unknown"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground tabular-nums">
                            {date(agent.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground tabular-nums">
                            {date(agent.updated_at)}
                          </td>
                        </tr>
                      ),
                    )}
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

          <section aria-label="Built-in agents">
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">
              Built-in &amp; server agents
            </h2>
            {(viewTab === "single" ? builtins.filter((a) => !isTeam(a)) : builtins).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border bg-card/30">
                <table className="w-full min-w-[42rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th scope="col" className="h-9 px-3 font-medium">
                        Agent
                      </th>
                      <th scope="col" className="h-9 w-[100px] px-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="h-9 w-[140px] px-3 font-medium">
                        Runtime
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(viewTab === "single" ? builtins.filter((a) => !isTeam(a)) : builtins).map(
                      (agent) => (
                        <tr
                          key={agent.id}
                          className="relative transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
                        >
                          <td className="max-w-0 px-3 py-2.5">
                            <Link
                              to={agentPath(agent.id)}
                              componentId="settings.custom_agents.review_server"
                              className="flex items-center gap-2.5 rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={agent.name}
                            >
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                                {isTeam(agent) ? (
                                  <UsersIcon className="size-3.5" aria-hidden />
                                ) : (
                                  <BotIcon className="size-3.5" aria-hidden />
                                )}
                              </span>
                              <span className="min-w-0 flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {agent.name}
                                </span>
                                {isTeam(agent) && (
                                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                                    Team
                                  </span>
                                )}
                                <span className="truncate text-muted-foreground hidden sm:inline">
                                  {agent.description || "Server-provided agent"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                            {labels[agent.harness ?? ""] ?? agent.harness ?? "Default"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <ListStatus
              query={servers}
              scope="server"
              empty={builtins.length === 0}
              emptyText={search ? "No matching server agents." : "No server agents."}
            />
          </section>
        </div>
      )}
    </SettingsItem>
  );
}

function UnsupportedServer() {
  return (
    <p role="alert" className="text-ui text-muted-foreground">
      This IPLabs Agent Platform server does not support custom agents.
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
          {...settingsControlProps(
            CUSTOM_AGENTS_LIST_ENTRY,
            scope === "user" ? "loadMoreYours" : "loadMoreServer",
          )}
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

