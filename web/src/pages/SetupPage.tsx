/**
 * First-run "Create admin" page (shown when ``/v1/info`` reports
 * ``needs_setup``).
 *
 * On a fresh accounts deploy no admin exists yet. The first visitor
 * claims it here by choosing a username + password; the server's
 * ``POST /auth/setup`` creates the admin (hard-gated to the
 * zero-admin state), sets the session cookie, and we navigate to
 * ``/`` signed in. This is the remote-deploy path (Docker / Render /
 * Railway) where there's no terminal to read a password from — and
 * locally the server auto-opens the browser straight here.
 *
 * Once an admin exists the server 409s ``/auth/setup`` and
 * ``needs_setup`` flips false, so App routes to LoginPage instead and
 * this page is never reachable.
 *
 * Mounted outside the AppShell (like Login/Register) — the chrome
 * needs an authenticated identity.
 *
 * Username constraints mirror the server regex
 * (``^[a-z0-9][a-z0-9._-]{0,63}(@[a-z0-9.-]+\.[a-z]{2,})?$``); the
 * form lowercases on input so a mixed-case value can't be rejected.
 */

import { useEffect, useState, type FormEvent } from "react";
import { User, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setup as setupRequest } from "@/lib/accountsApi";
import { withBasePath } from "@/lib/basePath";
import { useAppName } from "@/lib/branding";
import omnigentLogo from "@/assets/omnigent-logo.png";

const MIN_PASSWORD_LENGTH = 8;

export function SetupPage() {
  const appName = useAppName();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = document.getElementById("setup-username");
    if (el instanceof HTMLInputElement) el.focus();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    const result = await setupRequest({ username, password });
    if (result.ok) {
      // Hard-navigate so identity.ts re-runs against the new session.
      window.location.href = withBasePath("/");
      return;
    }
    setSubmitting(false);
    // A 409 means someone else just claimed the admin — send them to login.
    if (result.status === 409) {
      window.location.href = withBasePath("/login");
      return;
    }
    setError(result.error);
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 size-[600px] rounded-full bg-[#09747e]/15 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 size-[600px] rounded-full bg-[#ffaa07]/10 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        {/* Header with Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[#09747e] shadow-lg shadow-[#09747e]/30">
            <img
              src={omnigentLogo}
              alt={appName}
              className="size-12 object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Create the admin account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            First run setup for {appName}. Choose your administrator credentials to claim this instance.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="setup-username" className="text-ui font-medium leading-none text-foreground">
              Username
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="size-4" />
              </div>
              <Input
                id="setup-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                disabled={submitting}
                required
                pattern="[a-z0-9][a-z0-9._\-]{0,63}(@[a-z0-9.\-]+\.[a-z]{2,})?"
                title="Lowercase letters, digits, dots, hyphens, underscores (or a lowercase email)"
                placeholder="admin"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, dots, hyphens, underscores — or email.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="setup-password" className="text-ui font-medium leading-none text-foreground">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Lock className="size-4" />
              </div>
              <Input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="••••••••••••"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="setup-confirm" className="text-ui font-medium leading-none text-foreground">
              Confirm password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <ShieldCheck className="size-4" />
              </div>
              <Input
                id="setup-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                required
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="••••••••••••"
                className="pl-9"
              />
            </div>
          </div>

          {error !== null && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#ffaa07] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 transition-all hover:bg-[#ffb424] hover:shadow-lg hover:shadow-[#ffaa07]/30"
            disabled={submitting || password.length < MIN_PASSWORD_LENGTH || username.length === 0}
          >
            {submitting ? "Creating…" : "Create admin"}
          </Button>
        </form>
      </div>
    </div>
  );
}
