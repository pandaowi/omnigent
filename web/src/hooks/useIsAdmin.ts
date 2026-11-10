import { useQuery } from "@tanstack/react-query";
import { getCurrentIsAdmin, getCurrentIsSupervisor, resolveIdentity } from "@/lib/identity";

// Mode-agnostic admin gate, sourced from the `/v1/me` identity probe
// (the shared `users.is_admin` column). Unlike `useMe`, which reads the
// accounts-only `/auth/me` endpoint, this works in EVERY auth mode —
// header, accounts, AND OIDC/SSO — so admin chrome (the Members /
// Policies settings sections) can surface under OIDC where `/auth/me`
// doesn't exist.
const QUERY_KEY = ["identity-is-admin"];

/**
 * Whether the current user is an admin, per `GET /v1/me`. Returns false
 * until identity resolves. Cached briefly so gating is instant across
 * consumers without re-probing on every navigation. Server enforces the
 * flag on every admin route regardless — this is chrome only.
 */
export function useIsAdmin(): boolean {
  const { data } = useQuery<boolean>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      await resolveIdentity();
      return getCurrentIsAdmin();
    },
    staleTime: 30_000,
    // Seed from the already-resolved cache so first paint is correct when
    // identity resolved during boot (the common case).
    initialData: getCurrentIsAdmin,
  });
  return data;
}

/** Whether the current user is a division supervisor. */
export function useIsSupervisor(): boolean {
  const { data } = useQuery<boolean>({
    queryKey: ["identity-is-supervisor"],
    queryFn: async () => {
      await resolveIdentity();
      return getCurrentIsSupervisor();
    },
    staleTime: 30_000,
    initialData: getCurrentIsSupervisor,
  });
  return data;
}
