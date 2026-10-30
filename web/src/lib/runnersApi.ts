/**
 * Client API for Runners, Organizations, and Member Execution Management.
 */

import { withBasePath } from "./basePath";

export interface HostItem {
  host_id: string;
  name: string;
  owner: string;
  status: "online" | "offline";
  configured_harnesses?: Record<string, any>;
}

export interface HostAssignments {
  users: Array<{
    user_id: string;
    level: number;
    assigned_by: string;
    created_at: number;
    allowed_models?: string[] | null;
  }>;
  organizations: Array<{
    organization_id: string;
    name: string;
    created_at: number;
    allowed_models?: string[] | null;
  }>;
}

export interface OrganizationItem {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: number;
  member_count: number;
}

export interface ReadyHarnessGroup {
  harnessKey: string;
  harnessName: string;
  models: string[];
}

export interface AvailableRuntime {
  id: string;
  hostId: string;
  hostName: string;
  harnessKey: string;
  harnessName: string;
  isOnline: boolean;
  models: string[];
}

export async function fetchHostsList(): Promise<HostItem[]> {
  try {
    const res = await fetch(withBasePath("/v1/hosts"), { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.hosts || [];
  } catch {
    return [];
  }
}

export async function fetchHostAssignments(hostId: string): Promise<HostAssignments | null> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/assignments`), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Dynamically detects ONLY the ready and installed harnesses on the given runner,
 * and fetches the actual models available for each ready harness.
 */
export async function fetchRunnerReadyHarnesses(host: HostItem): Promise<ReadyHarnessGroup[]> {
  const groups: ReadyHarnessGroup[] = [];
  const conf = host.configured_harnesses || {};

  // Check which distinct harness families are strictly ready (status === true)
  const isCodexReady = conf["codex-native"] === true || conf["codex"] === true || conf["native-codex"] === true;
  const isAgyReady =
    conf["antigravity-native"] === true ||
    conf["antigravity"] === true ||
    conf["native-antigravity"] === true ||
    conf["native-agy"] === true ||
    conf["agy-native"] === true;
  const isClaudeReady = conf["claude-native"] === true || conf["claude"] === true || conf["native-claude"] === true;
  const isOpenCodeReady =
    conf["opencode-native"] === true || conf["opencode"] === true || conf["native-opencode"] === true;

  // 1. Probed Codex models if ready
  if (isCodexReady) {
    let models: string[] = [];
    try {
      const res = await fetch(withBasePath(`/v1/hosts/${host.host_id}/harnesses/codex-native/model-options`), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        models = (data.models || []).map((m: any) => m.id || m.model).filter(Boolean);
      }
    } catch {}
    if (models.length === 0) {
      models = [
        "gpt-6.1-sol",
        "gpt-6-astra",
        "gpt-6.1-terra",
        "gpt-6-sol",
        "gpt-6-luna",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
      ];
    }
    groups.push({
      harnessKey: "codex",
      harnessName: "Codex",
      models,
    });
  }

  // 2. Antigravity / Gemini models if ready
  if (isAgyReady) {
    let models: string[] = [];
    try {
      const res = await fetch(withBasePath(`/v1/hosts/${host.host_id}/harnesses/antigravity-native/model-options`), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        models = (data.models || []).map((m: any) => m.id || m.model).filter(Boolean);
      }
    } catch {}
    if (models.length === 0) {
      models = [
        "gemini-4-argon-high",
        "gemini-4-argon-medium",
        "gemini-4-argon-low",
        "gemini-3.8-flash-high",
        "gemini-3.8-flash-medium",
        "gemini-3.8-flash-low",
        "claude-opus-5-5-high",
        "claude-opus-5-5-medium",
        "claude-opus-5-5-low",
        "claude-sonnet-5-5-high",
        "claude-sonnet-5-5-medium",
        "claude-sonnet-5-5-low",
        "gpt-oss-120b-medium",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
      ];
    }
    groups.push({
      harnessKey: "antigravity",
      harnessName: "Antigravity",
      models,
    });
  }

  // 3. Claude Code models if strictly ready (not needs-auth)
  if (isClaudeReady) {
    try {
      const res = await fetch(withBasePath(`/v1/hosts/${host.host_id}/harnesses/claude-native/model-options`), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.id || m.model).filter(Boolean);
        if (models.length > 0) {
          groups.push({
            harnessKey: "claude",
            harnessName: "Claude",
            models,
          });
        }
      }
    } catch {}
  }

  // 4. OpenCode models if ready
  if (isOpenCodeReady) {
    let models: string[] = [];
    try {
      const res = await fetch(withBasePath(`/v1/hosts/${host.host_id}/harnesses/opencode-native/model-options`), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        models = (data.models || []).map((m: any) => m.id || m.model).filter(Boolean);
      }
    } catch {}
    groups.push({
      harnessKey: "opencode",
      harnessName: "OpenCode",
      models,
    });
  }

  return groups;
}

export async function fetchAllAvailableRuntimes(hosts: HostItem[]): Promise<AvailableRuntime[]> {
  const list: AvailableRuntime[] = [];
  for (const h of hosts) {
    const readyHarnesses = await fetchRunnerReadyHarnesses(h);
    for (const rh of readyHarnesses) {
      list.push({
        id: `${h.host_id}:${rh.harnessKey}`,
        hostId: h.host_id,
        hostName: h.name,
        harnessKey: rh.harnessKey,
        harnessName: rh.harnessName,
        isOnline: h.status === "online",
        models: rh.models,
      });
    }
  }
  return list;
}

export interface UserExecutionSetting {
  user_id?: string;
  host_id: string | null;
  level?: number;
  harness?: string | null;
  allowed_harnesses?: string[] | null;
  default_model?: string | null;
  allowed_models: string[] | null;
}

export async function fetchExecutionOverview(): Promise<Record<string, UserExecutionSetting>> {
  try {
    const res = await fetch(withBasePath("/v1/users/execution-overview"), { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return data.overview || data.users || {};
  } catch {
    return {};
  }
}

export async function fetchMyExecution(): Promise<UserExecutionSetting | null> {
  try {
    const res = await fetch(withBasePath("/v1/users/me/execution"), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.execution || null;
  } catch {
    return null;
  }
}

export async function updateUserExecution(
  targetUserId: string,
  hostId: string | null,
  allowedModels: string[] | null = null,
  harness: string | null = null,
  defaultModel: string | null = null,
  allowedHarnesses: string[] | null = null,
): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/users/${encodeURIComponent(targetUserId)}/execution`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host_id: hostId,
        allowed_models: allowedModels && allowedModels.length > 0 ? allowedModels : null,
        harness: harness || null,
        default_model: defaultModel || null,
        allowed_harnesses: allowedHarnesses && allowedHarnesses.length > 0 ? allowedHarnesses : null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assignUserToHost(
  hostId: string,
  username: string,
  level = 1,
  allowedModels?: string[] | null,
): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/assignments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        level,
        allowed_models: allowedModels && allowedModels.length > 0 ? allowedModels : null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unassignUserFromHost(hostId: string, username: string): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/assignments/users/${encodeURIComponent(username)}`), {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assignOrgToHost(
  hostId: string,
  organizationId: string,
  allowedModels?: string[] | null,
): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/assignments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        allowed_models: allowedModels && allowedModels.length > 0 ? allowedModels : null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unassignOrgFromHost(hostId: string, organizationId: string): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/assignments/organizations/${encodeURIComponent(organizationId)}`), {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchOrganizations(): Promise<OrganizationItem[]> {
  try {
    const res = await fetch(withBasePath("/v1/organizations"), { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.organizations || [];
  } catch {
    return [];
  }
}

export async function createOrganization(name: string, description?: string): Promise<OrganizationItem | null> {
  try {
    const res = await fetch(withBasePath("/v1/organizations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteOrganization(orgId: string): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/organizations/${orgId}`), {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function addMemberToOrganization(orgId: string, username: string, role = "member"): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/organizations/${orgId}/members`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeMemberFromOrganization(orgId: string, username: string): Promise<boolean> {
  try {
    const res = await fetch(withBasePath(`/v1/organizations/${orgId}/members/${encodeURIComponent(username)}`), {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Backward-compatible exports
export const POPULAR_PROVIDER_MODELS: Record<string, string[]> = {
  "Codex Built-in": [
    "gpt-6.1-sol", "gpt-6-astra", "gpt-6.1-terra", "gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"
  ],
  "Antigravity": [
    "gemini-4-argon-high", "gemini-4-argon-medium", "gemini-4-argon-low",
    "gemini-3.8-flash-high", "gemini-3.8-flash-medium", "gemini-3.8-flash-low",
    "claude-opus-5-5-high", "claude-opus-5-5-medium", "claude-opus-5-5-low",
    "claude-sonnet-5-5-high", "claude-sonnet-5-5-medium", "claude-sonnet-5-5-low",
    "gpt-oss-120b-medium", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"
  ]
};

export async function fetchHostModelOptions(hostId: string): Promise<{
  detected: string[];
  allByProvider: Record<string, string[]>;
}> {
  try {
    const res = await fetch(withBasePath(`/v1/hosts/${hostId}/harnesses/codex-native/model-options`), { cache: "no-store" });
    const data = res.ok ? await res.json() : {};
    const detected = (data.models || []).map((m: any) => m.id || m.model).filter(Boolean);
    return {
      detected,
      allByProvider: {
        "Codex": detected.length > 0 ? detected : POPULAR_PROVIDER_MODELS["Codex Built-in"],
        "Antigravity": POPULAR_PROVIDER_MODELS["Antigravity"],
      }
    };
  } catch {
    return {
      detected: [],
      allByProvider: POPULAR_PROVIDER_MODELS,
    };
  }
}
