# Agent guidance: IPLabs Agent Platform

Guidance for AI agents (Claude Code, Antigravity, Copilot, Cursor, etc.) working in this
repository.

---

## 🎯 Important: IPLabs Agent Platform Context

This repository is a customized fork of **Omnigent** for **PT Imani Prima (IPLabs)**.
- **Current Version**: `v0.22.0-iplabs.1` (Upgraded from upstream `v0.21.0` to `v0.22.0`).
- **Primary Branches**:
  - `upgrade/v0.22.0-with-custom-features` (Latest integration on v0.22.0).
  - `feat/multica-style-agents` / `main` (Custom feature development).
- **Remotes**:
  - `origin`: `https://github.com/pandaowi/omnigent.git` (Our fork).
  - `upstream`: `https://github.com/omnigent-ai/omnigent.git` (Official base).

### 🚀 Server Matrix & Deployment Playbook:
When instructed to deploy to server Development or Production, use these exact parameters:
- **Development Server**: `owi@192.168.7.70` (Port 8090, URL: `http://192.168.7.70:8090`)
- **Production Server**: `imani@192.168.7.101` (Port 8090, URL: `http://192.168.7.101:8090`)
- **Standard Deploy Command**:
  ```bash
  ssh <user>@<host_ip>
  cd ~/omnigent || cd ~/omnigent-repo
  git fetch origin && git checkout upgrade/v0.22.0-with-custom-features && git pull origin upgrade/v0.22.0-with-custom-features
  cd deploy/docker
  docker compose -p omnigent-labs up -d --build
  ```

### 🛡️ Critical Custom Layers (DO NOT BREAK / OVERWRITE):
1. **Multica-Style Custom Agents**: Runtime host selector in `CreateAgentDialog`, live model option probing from runner CLI, and native harnesses (**Codex Native**, **OpenCode Native >=1.18.0,<2.0.0**, **Antigravity AGY / Gemini 4 Argon**).
2. **Multi-Divisi & 3-Tier Enterprise RBAC**: Global Admin, Supervisor (isolated to own division), and Member (strictly jailed to `/home/coder/workspaces/{divisi}/{username}`).
3. **Agent Teams & Tasks Kanban**: Visual team builder, Remotion presets, Kanban board at `/tasks`, and browser screenshot zoom preview.
4. **IPLabs Rebranding**: Product name `IPLabs Agent Platform`, gold `#ffaa07` / dark `#061212` palette, Electron desktop without upstream auto-updater, and custom icons.
5. **Coder Runner Tooling**: Non-root `coder` execution, `scripts/setup-coder-runner.sh`, tmux daemon loop with auto-reconnect, and bubblewrap (`bwrap`) fallback.

### 🧪 Quality Assurance & Local Verification:
- **Frontend Typecheck**: `cd web && pnpm tsc --noEmit` (Must be 0 errors).
- **Frontend Build**: `cd web && pnpm build` (Must build in ~4-5s).
- **Backend RBAC Tests**: `.venv/bin/pytest tests/server/test_supervisor_rbac_and_workspace.py` (Must pass 100%).

### 📝 Mandatory Rule: Automatic VERSION_CHANGELOG.md Updates
Whenever any agent performs an upstream version upgrade, branch rebase/merge, or significant platform enhancement:
- The agent **MUST AUTOMATICALLY update `docs/VERSION_CHANGELOG.md`** (and `../VERSION_CHANGELOG.md`) without waiting for explicit user prompts.
- Ensure the version comparison matrix, list of Major/Minor/Fix changes, and QA verification results are thoroughly recorded.

For full architecture details and changelog, see `docs/ARCHITECTURE_AND_SETUP.md` and `docs/VERSION_CHANGELOG.md`.

---

## Reuse and design

- Search for and reuse existing helpers before adding code. Refactor an existing
  implementation if that avoids duplication.
- Use descriptive names; avoid unexplained abbreviations and single-letter names.

## Test changes

Before adding test setup, read [the test guide](tests/README.md) and
[primitive catalog](tests/_helpers/README.md), then inspect the nearest scenario.
Reuse sufficient coverage unchanged or extend a compatible scenario. Keep input
matrices at the lowest reliable layer; retain E2E for distinct process, transport
or browser boundaries. Reuse primitives with explicit caller inputs and keep
faults and assertions in the test. Explain new setup or a separate E2E in the
PR's Test Plan (Repro uses `evidence`; Resolve uses `test_audit`). Count helper changes in
test LOC; fewer lines alone do not establish adequate coverage.

- Add a unit test for non-trivial functions, methods, and exported APIs. Add
  coverage when changed behavior needs it.
- Standalone local tests are optional, not a prerequisite for every commit or
  push. When a behavior change needs an additional local check, use only the
  smallest directly relevant non-browser test. Follow the proportional rules
  below for styling changes and document unrelated failures in the PR.

## Stay focused and keep verification proportional

- Complete the requested change directly. Do not add unsolicited cleanup,
  unrelated refactors, documentation edits, audits, or adjacent behavior work.
- For small, reversible UI styling changes (colors, opacity, blur, radius,
  spacing, and shadows), do not automatically add or run tests, type checks,
  builds, linters, browser checks, or other proactive verification.
- For behavior changes that need verification, use the smallest directly
  relevant local check. Do not expand into broad suites, viewport/scroll
  investigations, or unrelated regression checks without a concrete need.
- Do not repeat checks for successive styling tweaks after the shared
  implementation has already been validated.
- Follow explicit requests to stop or skip checks immediately. Required commit
  and push hooks still run when committing or pushing; never bypass them.
- During authorized PR fixes, commit and push each completed fix promptly after
  the required hooks pass. Do not hold fixes locally while waiting for other CI
  results or run extra local tests solely as a prerequisite to pushing.

## Dependency changes

When raising a dependency floor or adding a dependency, keep it installable from
package mirrors that embargo new releases (see the dependency notes in
`CONTRIBUTING.md`) and run `just check-internal-mirror` when you can reach the
Databricks PyPI proxy. If a mirror lacks the version you need, keep the floor
below it and pin the newer release only in `uv.lock`; do not work around the
mirror with a local or temporary index. Never add the `dependency-floor-approved`
label yourself; a human maintainer adds it after checking the mirror.

## Committing

New text and filenames must follow the reference policy in
`dev/lint/lint_reference_policy.py`. Use generic names and reserved example
domains, including in tests and fixtures; do not add deployment-specific
identifiers or access instructions. The local `reference-policy` hook checks
staged changes and pushed commits; CI checks the branch diff. Push checks require
a complete revision range and fail if it is unavailable. Do not add suppressions
or expand exemptions to make a change pass.

The `pre-commit` hooks are the local gate, and CI runs the same checks. They
run on `git commit` and again on `git push` only after they are installed:
`just ensure` does that (or `just hooks` on its own), once per clone. Worktrees
share the clone's `.git`, so one install covers them all.

- Never pass `--no-verify`. A hook failure is a finding to fix, not a gate to
  skip; the push hook will fail on the same commits anyway.
- Files written through shell heredocs or scripts are unformatted until a hook
  or `just lint` touches them. Let the required formatting hooks validate them;
  a duplicate standalone Prettier run is not required before pushing. If a
  manual check is needed, read its exit code rather than grepping hook output.
- To check by hand, `just lint` runs the hooks over staged files and
  `just lint-all` over the whole tree. Fix what they report, re-stage, commit.

## Local development shortcuts

Use `just` for common tasks; run `just --list` for grouped recipes.

- `just ensure` — install/check prerequisites, including the git hooks
- `just run-ios` / `just run-android` — build/run mobile apps
- `just dev` / `just dev-mobile` — start the omnigent dev pod
- `just electron-dev` / `just electron-build` — Electron desktop shell
- `just lint` / `just lint-all` — run pre-commit; `just hooks` — install the git hooks
- `just normalize-locks` — rewrite lockfile registries to PyPI/npmjs.org

### Local development database

- Always use the shared `~/.omnigent/chat.db` when starting or reusing a local
  Omnigent development backend, unless the user explicitly requests isolated data.
- Reuse a healthy backend using that database when available. Otherwise pass
  `--database-uri "sqlite:///$HOME/.omnigent/chat.db"` explicitly to
  `uv run --no-sync omnigent server`; do not let worktree-specific state or the
  default `omnidev` pod select a separate database.
- For `server --background`, set
  `OMNIGENT_DATABASE_URI="sqlite:///$HOME/.omnigent/chat.db"` in the environment;
  the background launcher does not forward the `--database-uri` option.
- Point the frontend and host at the same backend, and verify the backend's
  resolved database URI before reporting that the development servers are ready.
- Automated tests retain their isolated databases.

### No proactive browser-based verification

- Do not run browser-based verification: no manual browser interaction,
  Playwright or other browser E2E runs, browser screenshots, or recordings.
  Only an explicit user request for browser verification in the current task
  authorizes an exception. This prohibition takes precedence over browser-drive
  guidance in feature maps and other repository documentation.
- Standalone local tests, type checks, builds, and linters are optional. Prefer
  required Git hooks and GitHub CI; use a focused non-browser local check only
  when it is needed to diagnose or validate the requested change.
- Reading CI logs and artifacts or updating existing browser-test source does
  not authorize launching a local browser or rerunning browser tests locally.

## Pull requests

When you open a pull request, fill in the repo's PR template at
`.github/pull_request_template.md` (case-sensitive on Linux — note the lowercase
filename). Keep every section and checkbox row so reviewers can skim them,
except the optional Changelog section as described below.

- **Summary** — what changed and why.
- **Test Plan** — how you verified it.
- **Demo** — a **video or images** showing the change. Expected on contributor
  PRs for UI / frontend changes (check the "UI / frontend change" box under
  *Type of change*) so reviewers can see the new behaviour without checking out
  the branch. Use `N/A` for non-visual changes.
- **Type of change** / **Test coverage** — check all that apply (at least one
  each).
- **Coverage notes** — required if you checked "Manual verification completed"
  or "Not applicable".
- **Release notes** — choose exactly one Yes/No checkbox and keep both rows.
  Choose Yes only for outstanding user-facing features, bug fixes, UX changes,
  and breaking changes. Breaking changes must choose Yes. Features behind a
  feature flag are eligible only once the flag is enabled for users. Choose No
  for small fixes or improvements, features behind disabled flags, and internal
  changes with no user impact. This is the author's recommendation for
  maintainers curating the release notes.
- **Changelog** — if Release notes is Yes, write one line describing the change
  for users, including compatibility impact for breaking changes. If No, delete
  this section; the complete changelog still credits the PR using its title.

Generate the description from the actual diff and this session's context — lead
with the motivation, then the change. Don't pass a `--body` that skips these
sections.

### Demo media

Do not commit screenshots or recordings created only as PR or issue evidence.
Upload them as GitHub attachments and embed the attachment URLs in the PR's
Demo section or issue comments. Keep local captures outside the tracked tree,
and redact private data before uploading.

Commit media only when it serves maintained documentation, product assets, or
test baselines, not merely to obtain a public demo URL. If attachment upload is
unavailable, explain the limitation and ask for help instead of committing the
files as a workaround.

## Finishing a task

When you finish a task, print instructions to the user on how to test it: the
commands to run, the inputs to provide, or the steps to reproduce so they can
verify the result themselves. Prefer verification that is best performed by a
human, such as concrete manual behavior checks, rather than only listing unit
test commands. Don't leave the user guessing how to confirm the work — tell
them exactly what to do.

Use `feature-map/README.md` and the relevant maps as references for user-facing
behavior, following the local-code-only verification preference above.

## Deprecating features

When deprecating a feature, note the version in which it is expected to be
removed so we can clean it up when that version ships. Call out the deprecation
version in code (e.g. a `@deprecated` tag or comment naming the target release)
and in the PR/commit description, so there's a clear marker to act on later.

## Code comments

Keep comments short and focused on the code, not on the change history.

- **Keep them brief** — prefer one or two lines. Avoid comments longer than
  three lines; if you need more, the code likely needs refactoring or a doc
  string, not a wall of inline commentary.
- **Describe the scenario, not the PR** — explain *what* the code handles or
  *why* it exists, in terms a future reader needs. Don't reference PR numbers,
  issue numbers, or ticket IDs (e.g. `#1646`, `fixes JIRA-123`); the scenario
  should be clear without chasing external links.

## Database query names

Application stores use `make_named_managed_session_maker` and give every
session a stable semantic operation name. The session-level name must describe
the caller's intent rather than repeat SQL syntax; use a nested
`query_name_scope` only when one transaction needs distinct names for important
subqueries. Because the named session covers implicit flush and commit, don't
add an explicit `flush()` only to make a query name observable.

## Framework-owned instructions

Keep runtime lifecycle and metadata instructions separate from portable agent
instructions:

- Agent-spec and per-request instructions are user-authored. Framework-owned
  instructions are additive runtime behavior and are appended after them in
  `omnigent/runtime/prompt.py`.
- Keep the canonical instruction text and lifecycle gate in the owning framework
  module. Harness adapters should only transport the composed instructions; do
  not duplicate policy across adapters or add lifecycle metadata to `AgentSpec`.
- If framework instructions grow beyond a small ordered list, introduce a
  structured `FrameworkInstructions` value at the prompt-composition boundary.
