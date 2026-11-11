/**
 * The sign-in page for the ``accounts`` auth provider.
 *
 * Reached when:
 *
 * - An unauthed user lands on any SPA route → ``resolveIdentity()``
 *   in ``identity.ts`` hits ``GET /v1/me``, the server returns 401
 *   with ``login_url: "/login"``, the browser navigates here.
 * - The user clicks "Sign out" anywhere in the chrome.
 * - The magic-redeem URL fails or expires — accounts_auth.py's
 *   ``/auth/magic/redeem`` handler 302s here with
 *   ``?magic=expired``.
 *
 * On successful login the cookie is set by the server's
 * ``POST /auth/login`` Set-Cookie header; we just navigate the
 * browser back to the ``return_to`` path (or ``/``) and let
 * ``resolveIdentity()`` re-run.
 *
 * Username defaults to whatever the last successful sign-in used on
 * this browser (cached in localStorage). On a fresh browser / private
 * window the field is empty — we don't hardcode "admin" because the
 * bootstrap admin's name now follows the host OS user
 * (``getpass.getuser()``), not a fixed string. Surfacing it via an
 * unauth endpoint would leak the admin's username to anyone who can
 * reach the deploy.
 */

import { useEffect, useState, type FormEvent } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Cpu,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSearchParams } from "@/lib/routing";
import { useAppName } from "@/lib/branding";
import { withBasePath } from "@/lib/basePath";
import { useLoginV2 } from "@/lib/useLoginV2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMe, login as loginRequest } from "@/lib/accountsApi";
import omnigentLogo from "@/assets/omnigent-logo.png";

const DEFAULT_RETURN_TO = "/";
const LAST_USERNAME_KEY = "omnigent.lastLoginUsername";

function readLastUsername(): string {
  try {
    return window.localStorage.getItem(LAST_USERNAME_KEY) ?? "";
  } catch {
    // localStorage can throw in sandboxed iframes / blocked-cookies mode.
    return "";
  }
}

function rememberUsername(value: string): void {
  try {
    window.localStorage.setItem(LAST_USERNAME_KEY, value);
  } catch {
    // Best-effort — see readLastUsername.
  }
}

export function LoginPage() {
  const appName = useAppName();
  // Call useLoginV2 to keep sticky query param handling active.
  useLoginV2();
  const [params] = useSearchParams();
  // `return_to` is set by both identity.ts (on 401 redirect) and the
  // server-side magic-redeem 302 fallback. Trust only same-origin
  // paths — never a fully-qualified URL — to prevent open-redirect.
  const returnTo = sanitizeReturnTo(params.get("return_to"));
  const magicError = params.get("magic"); // "expired" | "missing" | null
  // Forced re-authentication: the device-grant consent page bounces here with
  // ?reauth=1 to require a FRESH password submit before approving a delegated
  // login, even for an already-signed-in user. When set, suppress the
  // "already authenticated → bounce back" shortcut below — otherwise the
  // stale session would auto-return to consent, which would just bounce here
  // again (a loop). The user must re-enter their password; a successful submit
  // mints a new session whose iat clears the consent page's freshness check.
  const forceReauth = params.get("reauth") === "1";

  const [username, setUsername] = useState(readLastUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    magicError === "expired"
      ? "That sign-in link has expired. Enter your password to sign in."
      : magicError === "missing"
        ? "That sign-in link is no longer valid. Enter your password to sign in."
        : null,
  );

  // Already signed in? Don't show a login form to an authenticated
  // user — bounce them to where they were headed (or home). Covers
  // someone hitting /login directly, a bookmarked /login, or a
  // back-button after auth. Hard-navigate so identity.ts re-runs.
  //
  // EXCEPT under forced re-auth (?reauth=1, from device-grant consent): there
  // the whole point is to re-prove the password, so an existing session must
  // NOT short-circuit — show the form and require a fresh submit.
  useEffect(() => {
    if (forceReauth) return;
    void (async () => {
      const account = await getMe();
      if (account !== null) {
        window.location.href = returnTo;
      }
    })();
    // returnTo is derived from the URL once; re-checking on change isn't
    // meaningful for a one-shot "am I already authed?" probe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the empty field on mount: username when no remembered value,
  // password when the username is pre-filled from localStorage.
  useEffect(() => {
    const targetId = username ? "login-password" : "login-username";
    const el = document.getElementById(targetId);
    if (el instanceof HTMLInputElement) {
      el.focus();
    }
    // Run only on mount — re-running on `username` changes would
    // steal focus while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const result = await loginRequest({ username, password });
    if (result.ok) {
      rememberUsername(username);
      // Hard-navigate so identity.ts re-runs and every cached
      // query is rebuilt against the new session.
      window.location.href = returnTo;
      return;
    }
    setSubmitting(false);
    setError(result.error);
  }

  return (
    <div
      className="auth-page relative flex h-dvh min-h-dvh w-full items-center justify-center overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-6"
      style={{
        paddingTop: "max(1rem, var(--omnigent-safe-top))",
        paddingBottom: "max(1rem, var(--omnigent-safe-bottom))",
      }}
    >
      {/* Decorative ambient background glows clipped to viewport */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 size-[450px] rounded-full bg-[#09747e]/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-[450px] rounded-full bg-[#ffaa07]/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl ring-1 ring-foreground/5 lg:grid-cols-12">
        {/* Left Brand Showcase Hero (visible on large screens) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#064e55] via-[#09747e] to-[#043438] p-6 text-white lg:col-span-5 lg:flex xl:p-8">
          {/* Subtle ambient light orb */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#ffaa07]/20 blur-2xl"
            aria-hidden="true"
          />

          {/* Center Logo & Identity */}
          <div className="my-auto py-2">
            <div className="relative mb-4 inline-block">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#ffaa07] to-[#00d2d3] opacity-40 blur-lg transition duration-500" />
              <img
                src={omnigentLogo}
                alt={appName}
                className="relative size-16 rounded-2xl border border-white/25 bg-[#09747e] object-contain shadow-2xl"
              />
            </div>
            <h2 className="mb-2 text-xl font-bold tracking-tight text-white">
              Intelligent Multi-Agent Platform
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-white/80 sm:text-sm">
              Orchestrate autonomous agent swarms, isolated runner workspaces, and persistent coding
              environments seamlessly.
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Cpu className="size-3 text-[#ffaa07]" />
                </div>
                <span>Multi-Runner Workspaces (Coder, Docker, Cloud)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Sparkles className="size-3 text-[#ffaa07]" />
                </div>
                <span>Autonomous Coding & Tool-Calling Agents</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <ShieldCheck className="size-3 text-[#ffaa07]" />
                </div>
                <span>Role-Based Security & Isolated Sandboxes</span>
              </div>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="flex items-center justify-between border-t border-white/15 pt-3.5 text-xs text-white/70">
            <span>Powered by IP Labs</span>
            <span className="font-mono">v0.21.0</span>
          </div>
        </div>

        {/* Right Sign-in Form Panel */}
        <div className="flex flex-col justify-center bg-card p-6 text-card-foreground sm:p-8 lg:col-span-7">
          {/* Mobile / Tablet Header with Logo */}
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <img
              src={omnigentLogo}
              alt={appName}
              className="size-11 rounded-xl border border-border/60 bg-[#09747e] object-contain shadow-md"
            />
            <div>
              <h2 className="text-base font-bold leading-tight text-foreground">{appName}</h2>
              <p className="text-xs text-muted-foreground">Autonomous Agent Platform</p>
            </div>
          </div>

          <div className="mb-5 space-y-1 text-left">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Sign in</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Welcome to {appName}. Enter your account credentials to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="text-ui font-medium leading-none text-foreground"
              >
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="size-4" />
                </div>
                <Input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  placeholder="Username or machine login"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  required
                  className="h-10 pl-9 focus-visible:border-[#09747e] focus-visible:ring-[#09747e]/30"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-ui font-medium leading-none text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="size-4" />
                </div>
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                  className="h-10 pl-9 pr-10 focus-visible:border-[#09747e] focus-visible:ring-[#09747e]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  aria-label="Toggle visibility"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error !== null && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-ui text-destructive animate-in fade-in-50"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit CTA Button */}
            <Button
              type="submit"
              className="h-10 w-full cursor-pointer bg-gradient-to-r from-[#09747e] to-[#0c8a96] font-medium text-white shadow-md shadow-[#09747e]/25 transition-all duration-200 hover:from-[#08636b] hover:to-[#09747e] hover:shadow-lg hover:shadow-[#09747e]/35 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting || password.length === 0}
              componentId="login.sign_in"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </form>

          {/* About IPLabs Agent Platform Info Accordion */}
          <div className="mt-4 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="group flex w-full cursor-pointer items-center justify-between py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#09747e]" />
                About IPLabs Agent Platform & Access
              </span>
              {showHelp ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showHelp && (
              <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground animate-in fade-in-50 duration-200">
                <p>
                  <strong className="text-foreground">IPLabs Agent Platform</strong> is an enterprise AI orchestration environment powering autonomous coding agents, secure execution sandboxes, and multi-runner workspaces.
                </p>
                <p>
                  Access to this platform is restricted to authorized organization members. If you need an account, role elevation, or assistance signing in, please contact your workspace administrator or the <span className="font-medium text-foreground">IPLabs team</span>.
                </p>
              </div>
            )}
          </div>

          {/* Footer Security Badge */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-muted-foreground/70" />
            <span>End-to-end authenticated session & CSRF protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reject anything that isn't a relative path on the same origin.
 *
 * Defense against an open-redirect via crafted ``?return_to=`` —
 * an attacker who can get a victim to click a link to
 * ``/login?return_to=https://evil.com`` would otherwise have us
 * land them on the attacker's page after auth.
 *
 * Prefix checks alone are not enough: the value reaches us already
 * URL-decoded, so ``%2F%5Cevil.com`` becomes ``/\evil.com`` — which
 * passes a naive ``startsWith("/")`` + ``!startsWith("//")`` pair but
 * resolves to ``https://evil.com/`` because WHATWG URL parsing treats
 * backslashes as path separators for special schemes. So we require a
 * leading ``/`` (not ``//`` or ``/\``) and then resolve against the
 * current origin and confirm the result stays same-origin before
 * trusting it.
 */
function sanitizeReturnTo(raw: string | null): string {
  // The default lands the user at the app root under the active base path
  // (e.g. `/proxy/6767/` behind a subpath proxy), not the origin root.
  const fallback = withBasePath(DEFAULT_RETURN_TO);
  if (raw === null || raw === "") return fallback;
  // Must be an absolute path, not protocol-relative (`//host`) or a
  // backslash variant (`/\host`) the URL parser rewrites to one.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
    // Re-serialize so the sink gets the parser's normalized path, never
    // the raw backslash-laden input. `withBasePath` is idempotent, so a
    // caller-supplied return_to that's already base-prefixed (e.g. one
    // captured from the current page's own URL) is left unchanged, while
    // one that isn't (e.g. a server-issued redirect) gets prefixed here.
    return withBasePath(resolved.pathname + resolved.search + resolved.hash);
  } catch {
    // `new URL` throws on malformed input — treat anything unparseable
    // as untrusted and fall back to the safe default.
    return fallback;
  }
}
