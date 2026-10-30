/**
 * Admin members management page (``/settings/members``).
 * Full page view for Member Execution Settings (Runtime/Runner and Model assignments).
 * Matched strictly to the clean design where Runtime = [Harness] · [Machine] and Model = [Model Selection].
 */

import { useCallback, useEffect, useState } from "react";
import {
  CopyIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  Trash2Icon,
  UserPlusIcon,
  ServerIcon,
  CpuIcon,
  XIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  CheckIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type AccountListEntry,
  type InviteCreated,
  type PasswordReset,
  createInvite,
  deleteUser,
  listUsers,
  resetUserPassword,
} from "@/lib/accountsApi";
import {
  type HostItem,
  type AvailableRuntime,
  type ReadyHarnessGroup,
  type UserExecutionSetting,
  fetchHostsList,
  fetchExecutionOverview,
  updateUserExecution,
  fetchAllAvailableRuntimes,
  fetchRunnerReadyHarnesses,
} from "@/lib/runnersApi";
import { getCurrentIsAdmin, resolveIdentity } from "@/lib/identity";
import { useServerInfo } from "@/lib/CapabilitiesContext";
import { withBasePath } from "@/lib/basePath";
import { isSingleUserMode } from "@/lib/capabilities";

export function MembersPage() {
  const info = useServerInfo();
  const manageable = info !== "loading" && info.accounts_enabled;
  const isSingleUser = isSingleUserMode(info);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [users, setUsers] = useState<AccountListEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Execution overview, hosts & ready runtimes
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [allRuntimes, setAllRuntimes] = useState<AvailableRuntime[]>([]);
  const [executionMap, setExecutionMap] = useState<Record<string, UserExecutionSetting>>({});

  // Active Member for Dedicated Execution Page View
  const [selectedMember, setSelectedMember] = useState<AccountListEntry | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [detectedHarnesses, setDetectedHarnesses] = useState<ReadyHarnessGroup[]>([]);
  const [enabledHarnesses, setEnabledHarnesses] = useState<string[]>([]);
  const [defaultHarness, setDefaultHarness] = useState<string>("antigravity-native");
  const [harnessModelModes, setHarnessModelModes] = useState<Record<string, "all" | "custom">>({});
  const [harnessSelectedModels, setHarnessSelectedModels] = useState<Record<string, string[]>>({});
  const [defaultModel, setDefaultModel] = useState<string>("");

  // Dialogs
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteCreated | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [resettingUser, setResettingUser] = useState<AccountListEntry | null>(null);
  const [resetResult, setResetResult] = useState<PasswordReset | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AccountListEntry | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  // Load identities and admin role
  useEffect(() => {
    let unmounted = false;
    void resolveIdentity().then((id) => {
      if (unmounted) return;
      setMeId(id ?? null);
    });
    const admin = getCurrentIsAdmin();
    setMeIsAdmin(admin);
    return () => {
      unmounted = true;
    };
  }, []);

  // Refresh users and execution assignments
  const refreshUsers = useCallback(async () => {
    setLoadError(null);
    try {
      const [data, hostsData, execOverview] = await Promise.all([
        listUsers(),
        fetchHostsList(),
        fetchExecutionOverview(),
      ]);
      setUsers(data);
      setHosts(hostsData);
      setExecutionMap(execOverview);

      // Fetch all ready runtimes
      const runtimes = await fetchAllAvailableRuntimes(hostsData);
      setAllRuntimes(runtimes);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  // Open member execution settings page
  const openMemberExecution = async (u: AccountListEntry) => {
    setSelectedMember(u);
    const exec = executionMap[u.id];
    const hostId = exec?.host_id || (hosts.length > 0 ? hosts[0].host_id : "");
    setSelectedHostId(hostId);

    const targetHost = hosts.find((h) => h.host_id === hostId);
    let readyHarnesses: ReadyHarnessGroup[] = [];
    if (targetHost) {
      readyHarnesses = await fetchRunnerReadyHarnesses(targetHost);
    }
    setDetectedHarnesses(readyHarnesses);

    // Initial enabled harnesses
    let initialEnabled: string[] = [];
    if (exec?.allowed_harnesses && exec.allowed_harnesses.length > 0) {
      initialEnabled = exec.allowed_harnesses;
    } else if (exec?.harness) {
      initialEnabled = [exec.harness];
    } else {
      // Default: enable all ready harnesses on this host
      initialEnabled = readyHarnesses.map((rh) =>
        rh.harnessKey === "antigravity"
          ? "antigravity-native"
          : rh.harnessKey === "codex"
          ? "codex-native"
          : `${rh.harnessKey}-native`
      );
    }
    setEnabledHarnesses(initialEnabled);

    // Default harness
    const dHarness = exec?.harness || initialEnabled[0] || "antigravity-native";
    setDefaultHarness(dHarness);

    // Model modes and selected models per harness
    const modes: Record<string, "all" | "custom"> = {};
    const selected: Record<string, string[]> = {};

    for (const rh of readyHarnesses) {
      const hKey = rh.harnessKey;
      const hNative =
        hKey === "antigravity"
          ? "antigravity-native"
          : hKey === "codex"
          ? "codex-native"
          : `${hKey}-native`;

      if (exec?.allowed_models && exec.allowed_models.length > 0) {
        const matching = exec.allowed_models.filter((m) => rh.models.includes(m));
        if (matching.length > 0) {
          modes[hNative] = "custom";
          selected[hNative] = matching;
        } else {
          modes[hNative] = initialEnabled.includes(hNative) ? "all" : "custom";
          selected[hNative] = [];
        }
      } else {
        modes[hNative] = "all";
        selected[hNative] = [];
      }
    }

    setHarnessModelModes(modes);
    setHarnessSelectedModels(selected);
    setDefaultModel(exec?.default_model || "");
  };

  // Handle Host Change
  const handleHostChange = async (newHostId: string) => {
    setSelectedHostId(newHostId);
    const targetHost = hosts.find((h) => h.host_id === newHostId);
    let readyHarnesses: ReadyHarnessGroup[] = [];
    if (targetHost) {
      readyHarnesses = await fetchRunnerReadyHarnesses(targetHost);
    }
    setDetectedHarnesses(readyHarnesses);
    const enabled = readyHarnesses.map((rh) =>
      rh.harnessKey === "antigravity"
        ? "antigravity-native"
        : rh.harnessKey === "codex"
        ? "codex-native"
        : `${rh.harnessKey}-native`
    );
    setEnabledHarnesses(enabled);
    setDefaultHarness(enabled[0] || "antigravity-native");

    const modes: Record<string, "all" | "custom"> = {};
    const selected: Record<string, string[]> = {};
    for (const rh of readyHarnesses) {
      const hNative =
        rh.harnessKey === "antigravity"
          ? "antigravity-native"
          : rh.harnessKey === "codex"
          ? "codex-native"
          : `${rh.harnessKey}-native`;
      modes[hNative] = "all";
      selected[hNative] = [];
    }
    setHarnessModelModes(modes);
    setHarnessSelectedModels(selected);
    setDefaultModel(readyHarnesses[0]?.models[0] || "");
  };

  // Toggle harness on/off
  const toggleHarness = (harnessNative: string) => {
    setEnabledHarnesses((prev) => {
      const exists = prev.includes(harnessNative);
      const next = exists ? prev.filter((h) => h !== harnessNative) : [...prev, harnessNative];
      if (defaultHarness === harnessNative && exists) {
        setDefaultHarness(next[0] || "");
      } else if (!exists && prev.length === 0) {
        setDefaultHarness(harnessNative);
      }
      return next;
    });
  };

  // Set model mode for a harness
  const setHarnessMode = (harnessNative: string, mode: "all" | "custom", defaultModelList: string[]) => {
    setHarnessModelModes((prev) => ({ ...prev, [harnessNative]: mode }));
    if (mode === "custom") {
      setHarnessSelectedModels((prev) => {
        if (!prev[harnessNative] || prev[harnessNative].length === 0) {
          return { ...prev, [harnessNative]: defaultModelList.slice(0, 2) };
        }
        return prev;
      });
    }
  };

  // Toggle model checkbox for a harness
  const toggleModelForHarness = (harnessNative: string, modelId: string) => {
    setHarnessSelectedModels((prev) => {
      const current = prev[harnessNative] || [];
      const next = current.includes(modelId)
        ? current.filter((m) => m !== modelId)
        : [...current, modelId];
      return { ...prev, [harnessNative]: next };
    });
  };

  // Select all models for a harness
  const selectAllModelsForHarness = (harnessNative: string, allModels: string[]) => {
    setHarnessSelectedModels((prev) => ({ ...prev, [harnessNative]: [...allModels] }));
  };

  // Clear all models for a harness
  const clearAllModelsForHarness = (harnessNative: string) => {
    setHarnessSelectedModels((prev) => ({ ...prev, [harnessNative]: [] }));
  };

  // Save Execution Settings
  const handleSaveExecution = async () => {
    if (!selectedMember) return;

    // Case 1: Admin selected "None (No Runner Assigned)" -> Revoke/Unassign access
    if (!selectedHostId) {
      setPendingAction(true);
      const ok = await updateUserExecution(selectedMember.id, null, null, null, null, null);
      setPendingAction(false);
      if (ok) {
        toast.success(`Runner and model access revoked for ${selectedMember.id}`);
        setExecutionMap((prev) => {
          const next = { ...prev };
          delete next[selectedMember.id];
          return next;
        });
        setSelectedMember(null);
        void refreshUsers();
      } else {
        toast.error(`Failed to revoke execution access for ${selectedMember.id}`);
      }
      return;
    }

    // Case 2: Runner selected -> Must enable at least one harness
    if (enabledHarnesses.length === 0) {
      toast.error("Please enable at least one harness for this runner, or choose 'None' to revoke access.");
      return;
    }

    setPendingAction(true);

    let finalAllowedModels: string[] | null = null;
    let anyCustom = false;
    const combinedModels: string[] = [];

    for (const hNative of enabledHarnesses) {
      const mode = harnessModelModes[hNative] || "all";
      if (mode === "custom") {
        anyCustom = true;
        const sel = harnessSelectedModels[hNative] || [];
        combinedModels.push(...sel);
      } else {
        const rh = detectedHarnesses.find(
          (r) =>
            r.harnessKey === hNative ||
            `${r.harnessKey}-native` === hNative ||
            (hNative.startsWith("antigravity") && r.harnessKey === "antigravity") ||
            (hNative.startsWith("codex") && r.harnessKey === "codex")
        );
        if (rh) {
          combinedModels.push(...rh.models);
        }
      }
    }

    if (anyCustom) {
      finalAllowedModels = combinedModels.length > 0 ? Array.from(new Set(combinedModels)) : [];
    } else {
      finalAllowedModels = null;
    }

    const finalDefaultHarness = enabledHarnesses.includes(defaultHarness)
      ? defaultHarness
      : enabledHarnesses[0];

    let finalDefaultModel = defaultModel;
    if (!finalDefaultModel || (finalAllowedModels && !finalAllowedModels.includes(finalDefaultModel))) {
      finalDefaultModel = finalAllowedModels && finalAllowedModels.length > 0 ? finalAllowedModels[0] : null;
      if (!finalDefaultModel) {
        const rh = detectedHarnesses.find(
          (r) => r.harnessKey === finalDefaultHarness || `${r.harnessKey}-native` === finalDefaultHarness
        );
        finalDefaultModel = rh && rh.models.length > 0 ? rh.models[0] : "gemini-3.8-flash-high";
      }
    }

    const ok = await updateUserExecution(
      selectedMember.id,
      selectedHostId,
      finalAllowedModels,
      finalDefaultHarness,
      finalDefaultModel,
      enabledHarnesses
    );
    setPendingAction(false);

    if (ok) {
      toast.success(`Execution settings saved for ${selectedMember.id}`);
      setExecutionMap((prev) => ({
        ...prev,
        [selectedMember.id]: {
          host_id: selectedHostId,
          level: 1,
          harness: finalDefaultHarness,
          allowed_harnesses: enabledHarnesses,
          default_model: finalDefaultModel,
          allowed_models: finalAllowedModels,
        },
      }));
      setSelectedMember(null);
      void refreshUsers();
    } else {
      toast.error(`Failed to save execution settings for ${selectedMember.id}`);
    }
  };

  // Invite creation
  const handleCreateInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim();
    const isAdmin = formData.get("is_admin") === "on";

    if (!username) {
      toast.error("Please enter a username");
      return;
    }

    setPendingAction(true);
    try {
      const result = await createInvite(username, isAdmin);
      setInviteResult(result);
      form.reset();
      void refreshUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(false);
    }
  };

  // Reset password
  const handleConfirmReset = async () => {
    if (!resettingUser) return;
    setPendingAction(true);
    try {
      const result = await resetUserPassword(resettingUser.id);
      setResetResult(result);
      toast.success(`Password reset for ${resettingUser.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(false);
    }
  };

  // Delete user
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setPendingAction(true);
    try {
      await deleteUser(deletingUser.id);
      toast.success(`User ${deletingUser.id} deleted`);
      setDeletingUser(null);
      void refreshUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(false);
    }
  };

  const formatEpoch = (epoch: number | null | undefined): string => {
    if (!epoch) return "Never";
    return new Date(epoch * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 1: DEDICATED MEMBER EXECUTION SETTINGS PAGE
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedMember) {
    return (
      <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        {/* Navigation Breadcrumb & Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="hover:text-foreground hover:underline flex items-center gap-1 font-medium"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" /> Members
              </button>
              <span>/</span>
              <span className="text-primary font-semibold font-mono">{selectedMember.id}</span>
              <span>/</span>
              <span>Execution</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20 shadow-sm">
                {selectedMember.id.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <span className="font-mono">{selectedMember.id}</span>
                  {selectedMember.is_admin ? (
                    <Badge className="text-xs">Admin</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Member</Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium ml-1">
                    ● Active
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Last login: {formatEpoch(selectedMember.last_login_at)}
                </p>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => setSelectedMember(null)}>
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" /> Back to Members
          </Button>
        </div>

        {/* Dedicated Form Card */}
        <Card className="border border-border/80 shadow-md bg-card">
          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Section: Profile */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Profile
              </h3>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5 md:gap-4 items-start md:items-center">
                  <label className="text-xs font-semibold text-muted-foreground">Member Username</label>
                  <div className="md:col-span-3">
                    <Input value={selectedMember.id} readOnly className="h-9 text-sm font-mono bg-muted/40 cursor-default" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5 md:gap-4 items-start md:items-center">
                  <label className="text-xs font-semibold text-muted-foreground">Role Privileges</label>
                  <div className="md:col-span-3 text-xs text-muted-foreground">
                    {selectedMember.is_admin
                      ? "Full Administrator privileges (can manage all sessions, runners, and members)."
                      : "Standard Member (restricted strictly to assigned sessions, runners, and allowed models)."}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Execution (Matched strictly to clean Image 1 design) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-2 gap-1">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CpuIcon className="h-4 w-4 text-primary" />
                    Execution
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Configures runtime environment and allowed AI model access
                </span>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:p-5 space-y-4">
                {/* Row 1: Select Runner / Host */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-start md:items-center">
                  <div>
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ServerIcon className="h-3.5 w-3.5 text-primary" />
                      Runtime Runner
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Remote execution machine or compute runner
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <div className="relative">
                      <select
                        value={selectedHostId}
                        onChange={(e) => void handleHostChange(e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-input bg-background/80 px-3.5 py-2 text-sm shadow-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary appearance-none cursor-pointer"
                      >
                        <option value="">None (No Runner Assigned)</option>
                        {hosts.map((h) => (
                          <option key={h.host_id} value={h.host_id}>
                            {h.status === "online" ? "●" : "○"} {h.name} {h.status === "online" ? "— ONLINE" : "— OFFLINE"}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-muted-foreground">
                        <ChevronDownIcon className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Detected Harnesses & Model Permissions */}
                {selectedHostId && detectedHarnesses.length > 0 && (
                  <div className="space-y-4 pt-3 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Execution Harnesses & Model Permissions
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Select one or more harnesses and assign allowed models for each harness
                      </span>
                    </div>

                    <div className="space-y-3">
                      {detectedHarnesses.map((rh) => {
                        const hNative =
                          rh.harnessKey === "antigravity"
                            ? "antigravity-native"
                            : rh.harnessKey === "codex"
                            ? "codex-native"
                            : `${rh.harnessKey}-native`;
                        const isEnabled = enabledHarnesses.includes(hNative);
                        const isDefault = defaultHarness === hNative;
                        const currentMode = harnessModelModes[hNative] || "all";
                        const selectedModels = harnessSelectedModels[hNative] || [];

                        return (
                          <div
                            key={hNative}
                            className={`rounded-xl border transition-all ${
                              isEnabled
                                ? "border-primary/40 bg-card shadow-sm"
                                : "border-border/40 bg-muted/10 opacity-60"
                            }`}
                          >
                            {/* Harness Card Header */}
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => toggleHarness(hNative)}
                                    className="h-4 w-4 rounded border-input text-primary accent-primary cursor-pointer"
                                  />
                                  <span className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                                    {rh.harnessKey === "antigravity" ? "▲" : "⌨"} {rh.harnessName}
                                  </span>
                                </label>
                                <Badge variant="outline" className="text-[10px] py-0 px-2 font-mono text-emerald-500 border-emerald-500/30">
                                  Ready on Runner
                                </Badge>
                              </div>

                              {isEnabled && (
                                <div className="flex items-center gap-2">
                                  {isDefault ? (
                                    <Badge className="text-xs py-0.5 px-2.5 bg-primary/20 text-primary border-primary/30 flex items-center gap-1">
                                      ★ Default Starting Harness
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDefaultHarness(hNative)}
                                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Set as Default
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Harness Card Body (Model permissions) */}
                            {isEnabled && (
                              <div className="p-4 space-y-3.5 bg-muted/20">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <SparklesIcon className="h-3.5 w-3.5 text-primary" />
                                    Model Access for {rh.harnessName}
                                  </span>

                                  {/* Mode Selector Buttons */}
                                  <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-background/80 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => setHarnessMode(hNative, "all", rh.models)}
                                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                                        currentMode === "all"
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      All Models (Full Access)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setHarnessMode(hNative, "custom", rh.models)}
                                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                                        currentMode === "custom"
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      Specific Models ({selectedModels.length})
                                    </button>
                                  </div>
                                </div>

                                {/* Custom Model Checkbox Grid */}
                                {currentMode === "custom" && (
                                  <div className="space-y-2 pt-2 border-t border-border/30">
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span>Check the models allowed for this harness:</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => selectAllModelsForHarness(hNative, rh.models)}
                                          className="hover:text-primary hover:underline"
                                        >
                                          Select All
                                        </button>
                                        <span>·</span>
                                        <button
                                          type="button"
                                          onClick={() => clearAllModelsForHarness(hNative)}
                                          className="hover:text-primary hover:underline"
                                        >
                                          Clear All
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
                                      {rh.models.map((m) => {
                                        const checked = selectedModels.includes(m);
                                        const isModelDefault = defaultModel === m;
                                        return (
                                          <div
                                            key={m}
                                            className={`flex items-center justify-between p-2 rounded-md border text-xs transition-all ${
                                              checked
                                                ? "bg-primary/10 border-primary/50 text-foreground font-semibold"
                                                : "bg-card/40 border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                            }`}
                                          >
                                            <label className="flex items-center gap-2 cursor-pointer select-none truncate">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleModelForHarness(hNative, m)}
                                                className="rounded border-input h-3.5 w-3.5 text-primary accent-primary"
                                              />
                                              <span className="font-mono truncate">{m}</span>
                                            </label>
                                            {checked && (
                                              <button
                                                type="button"
                                                onClick={() => setDefaultModel(m)}
                                                title="Set as default model"
                                                className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
                                                  isModelDefault
                                                    ? "bg-primary text-primary-foreground font-bold"
                                                    : "text-muted-foreground hover:bg-muted"
                                                }`}
                                              >
                                                {isModelDefault ? "Default" : "Make Default"}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedMember(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveExecution} disabled={pendingAction} className="w-full sm:w-auto px-6 shadow">
                Save Execution Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageScroll>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 2: MEMBERS LIST OVERVIEW (DEFAULT PAGE)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <PageScroll maxWidthClassName="max-w-6xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="settings-page-title text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, assign remote compute runtimes, and restrict model access per member.
          </p>
        </div>

        {manageable && (
          <Button size="sm" onClick={() => setShowCreateInvite(true)} disabled={pendingAction}>
            <UserPlusIcon className="mr-1.5 h-3.5 w-3.5" /> Invite Member
          </Button>
        )}
      </div>

      {loadError && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex items-center justify-between">
          <span>Failed to load members: {loadError}</span>
          <Button variant="ghost" size="sm" onClick={() => void refreshUsers()}>
            <RefreshCwIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-xl border border-border shadow-sm overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Member</th>
              <th className="px-3 py-3 text-left font-semibold">Role</th>
              <th className="px-3 py-3 text-left font-semibold">Runtime / Runner</th>
              <th className="px-3 py-3 text-left font-semibold">Model Policy</th>
              <th className="px-3 py-3 text-left font-semibold">Last Login</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users && users.length > 0 ? (
              users.map((u) => {
                const exec = executionMap[u.id];
                const assignedHost = hosts.find((h) => h.host_id === exec?.host_id);
                
                // Identify runtime display
                let runtimeBadgeLabel = assignedHost?.name || "Assigned";
                if (assignedHost) {
                  const allowedH = exec?.allowed_harnesses || (exec?.harness ? [exec.harness] : []);
                  const hasAgy =
                    allowedH.some((h) => h.includes("antigravity")) ||
                    (exec?.allowed_models && exec.allowed_models.some((m) => m.startsWith("gemini-")));
                  const hasCodex =
                    allowedH.some((h) => h.includes("codex")) ||
                    (exec?.allowed_models && exec.allowed_models.some((m) => m.startsWith("gpt-")));

                  if (hasAgy && hasCodex) {
                    runtimeBadgeLabel = `▲ Antigravity + ⌨ Codex · ${assignedHost.name}`;
                  } else if (hasAgy) {
                    runtimeBadgeLabel = `▲ Antigravity · ${assignedHost.name}`;
                  } else if (hasCodex) {
                    runtimeBadgeLabel = `⌨ Codex · ${assignedHost.name}`;
                  } else {
                    runtimeBadgeLabel = `${assignedHost.name}`;
                  }
                }

                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    {/* User Identity */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {u.id.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => openMemberExecution(u)}
                            className="font-semibold text-foreground text-sm hover:underline text-left font-mono"
                          >
                            {u.id}
                          </button>
                          {u.id === meId && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                          )}
                          {!u.has_password && (
                            <Badge variant="outline" className="ml-1.5 text-[10px] py-0">
                              External
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-3 py-3 align-middle">
                      {u.is_admin ? (
                        <Badge className="text-xs">Admin</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Member</Badge>
                      )}
                    </td>

                    {/* Runtime / Runner Column */}
                    <td className="px-3 py-3 align-middle">
                      {assignedHost ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-medium flex items-center gap-1.5 w-fit py-1 px-2.5"
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              assignedHost.status === "online" ? "bg-emerald-500" : "bg-muted-foreground"
                            }`}
                          />
                          <span>{runtimeBadgeLabel}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None assigned</span>
                      )}
                    </td>

                    {/* Allowed Models Column */}
                    <td className="px-3 py-3 align-middle">
                      {exec?.allowed_models && exec.allowed_models.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {exec.allowed_models.slice(0, 2).map((m) => (
                            <Badge key={m} variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                              {m}
                            </Badge>
                          ))}
                          {exec.allowed_models.length > 2 && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                              +{exec.allowed_models.length - 2} more
                            </Badge>
                          )}
                        </div>
                      ) : assignedHost ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          All Models
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>

                    {/* Last login */}
                    <td className="px-3 py-3 align-middle text-xs text-muted-foreground">
                      {formatEpoch(u.last_login_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 font-medium"
                          onClick={() => openMemberExecution(u)}
                        >
                          <CpuIcon className="mr-1 h-3.5 w-3.5 text-primary" />
                          Execution
                        </Button>

                        {manageable && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setResettingUser(u)}
                              title="Reset Password"
                            >
                              <KeyRoundIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {u.id !== meId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingUser(u)}
                                title="Delete User"
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  {users === null ? "Loading members..." : "No members found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invite Dialog */}
      <Dialog open={showCreateInvite} onOpenChange={setShowCreateInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Create an invite link for a new member to join this instance.
            </DialogDescription>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-md space-y-1">
                <span className="text-xs text-muted-foreground">Invite Link:</span>
                <div className="font-mono text-xs break-all select-all bg-background p-2 rounded border">
                  {withBasePath(inviteResult.invite_url)}
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(withBasePath(inviteResult.invite_url));
                    setInviteCopied(true);
                    toast.success("Invite link copied to clipboard");
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                >
                  <CopyIcon className="h-4 w-4 mr-1.5" />
                  {inviteCopied ? "Copied!" : "Copy Link"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input name="username" placeholder="e.g. alice" required />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_admin" name="is_admin" className="rounded border-input" />
                <label htmlFor="is_admin" className="text-sm cursor-pointer select-none">
                  Grant Administrator privileges
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateInvite(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pendingAction}>
                  Create Invite
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!resettingUser} onOpenChange={() => { setResettingUser(null); setResetResult(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Generate a temporary password reset link for {resettingUser?.id}.
            </DialogDescription>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-md space-y-1">
                <span className="text-xs text-muted-foreground">Password Reset Link:</span>
                <div className="font-mono text-xs break-all select-all bg-background p-2 rounded border">
                  {withBasePath(resetResult.reset_url)}
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(withBasePath(resetResult.reset_url));
                    setResetCopied(true);
                    toast.success("Reset link copied to clipboard");
                    setTimeout(() => setResetCopied(false), 2000);
                  }}
                >
                  <CopyIcon className="h-4 w-4 mr-1.5" />
                  {resetCopied ? "Copied!" : "Copy Reset Link"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                This will invalidate any existing password and generate a one-time link.
              </p>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setResettingUser(null)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmReset} disabled={pendingAction}>
                  Generate Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user <strong>{deletingUser?.id}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={pendingAction}>
              Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
