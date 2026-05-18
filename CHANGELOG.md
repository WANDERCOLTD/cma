# Changelog

All notable changes to 4wd are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **v0.4.x** — Rust, Go, Ruby stack templates for `/4wd:init` as point releases.
- **v0.5** — remote gate runner (`runOn: "ssh"`, `"gcloud-iap"`).
- **v0.6** — long-lived queue subagent (parked on Claude Code platform fixes).

---

## [1.1.0] — 2026-05-17

### Added

- **Profile slideout** in the dashboard — opens from the top-right avatar dropdown. Right-side `Sheet` with four sections:
  - **Identity** — large avatar with brand-gradient glow ring, display name, `@login`, bio, and an "Open on GitHub" icon link.
  - **Repos using 4WD** — discovered via GitHub code-search (`filename:.4wd.json user:<login>`), sorted by most recently pushed. Each card switches the dashboard scope on click. Cached for 5 min through TanStack Query.
  - **This week** — 2×2 stat grid (merges this week, mean gate duration, gate pass-rate, repos tracked) with brand-tinted glass tiles. Per-repo trend chips (`improving` / `stable` / `regressing`) computed from a commits-vs-prior-week heuristic. `TODO(v1.2)` to replace the heuristic with proper ratchet history.
  - **Personal settings** — theme toggle (synced with `useTheme`), default-repo dropdown, queue + recent-merges polling sliders. Persisted to `localStorage` via a new `PersonalSettingsProvider` context.
- `useConfiguredRepos` and `useAggregateStats` hooks, both rate-limit-aware (code-search has a 30/min bucket; aggregate-stats fetches at concurrency 5 with a per-repo check-runs cap of 10).
- `ConfiguredRepo` type added to `web/src/types.ts`.

### Changed

- `useSignedInUser` now also surfaces `bio` and `htmlUrl` (extended via `SignedInUserExtended`), so the Profile slideout can render them without a second fetch.
- Top-bar dropdown's "Profile" item is now wired (previously a no-op).
- App rehydration prefers the user's personal-default repo when no session slug is stashed.

---

## [1.0.0] — 2026-05-18

### Changed

- **Project renamed `cma` → `4wd`** (Claude Merge Agent → 4WD). Tagline: *Drift control for your main branch.*
- GitHub repo: `WANDERCOLTD/cma` → `WANDERCOLTD/4wd` (the old URL is a permanent GitHub redirect).
- Plugin manifest `name`: `cma` → `4wd`.
- Slash commands: `/cma:merge`, `/cma:status`, `/cma:dashboard`, `/cma:init` → `/4wd:*`.
- Config file: `.merge-agent.json` → `.4wd.json`.
- Lock directory: `.merge-agent.lock/` → `.4wd.lock/`.
- Env-var kill switch: `CMA_DISABLE` → `FWD_DISABLE`.
- Schema file: `schema/merge-agent-config.schema.json` → `schema/4wd-config.schema.json`.
- GHA template: `examples/*/cma-gate.yml` → `examples/*/4wd-gate.yml`.
- Vercel project: `cma-dashboard` → `4wd-dashboard`. Canonical alias: **`4wd-dashboard.vercel.app`**.

### Added

- **`web/vercel.json`** locks production deploys to manual-only — pushes to `main` no longer auto-trigger Vercel builds. Production lands via `vercel --prod` from `web/`.

### Notes

- No external users at the time of rename, no marketplace listing yet. Clean break.
- Existing `.merge-agent.json` files in adopter repos must be renamed manually: `git mv .merge-agent.json .4wd.json && commit`.

---

## [0.4.0] — 2026-05-18

### Added

- **`/4wd:init`** slash command — bootstrap 4wd into any project in one step.
  - Detects stack from marker files: Node (`package.json` with a `scripts.test`), Python (`pyproject.toml` / `requirements.txt`), shell/generic fallback. Override with `--stack`.
  - Emits 3 files: stack-specific `.4wd.json`, starter `.ratchet.json` (null baselines), and `scripts/check-ratchet.sh` tailored per stack (tsc/jest for Node, mypy/pytest for Python, shellcheck/bats for shell).
  - `--with-gha` adds `.github/workflows/4wd-gate.yml`. Off by default to avoid clobbering existing CI. Suppressed for non-GitHub origins.
  - `--dry-run` previews changes. `--force` overwrites. `--merge` deep-merges into existing `.4wd.json` (preserves user fields).
  - `.gitignore` auto-updates with `.4wd.lock/` (dedupe-safe).
  - Refuses on non-git directories; prints actionable next-steps with the branch-protection URL for the current repo.
- New `lib/detect-stack.sh` helper.
- New templates under `examples/<stack>/`: `check-ratchet.sh` + `4wd-gate.yml` for Node, Python, and shell/minimal.
- 20 new BATS tests for stack detection + init contracts (62 total).
- Closes [#2](https://github.com/WANDERCOLTD/4wd/issues/2).

---

## [0.3.1] — 2026-05-18

### Added

- **Repo picker** on the setup screen — searchable `Command` list of the user's recently-pushed repos with Recent / Owned / Organisations tabs. Avatars from GitHub. Public-mode users get a manual `owner/name` paste field.
- `useUserRepos` hook fetches `GET /user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator,organization_member` with TanStack Query caching.
- `sessionStorage.4wd:selectedRepo` persists the choice across reloads in the same tab.
- shadcn `Command` (cmdk) and `Tabs` (Radix Tabs) primitives added to `web/src/components/ui/`.

### Changed

- Setup screen no longer shows the "No repository configured" amber box — the picker handles that flow.
- App routing: `setup → picker → dashboard` with sessionStorage rehydrate.

---

## [0.3.0] — 2026-05-18

### Added

- **Web dashboard** at https://4wd-dashboard.vercel.app. Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui (Radix primitives) + Framer Motion + TanStack Query + Octokit.
- **`/4wd:dashboard`** slash command. Opens the dashboard scoped to the current repo (`?repo=<owner>/<name>`) with a discovered token if available (URL hash, scrubbed after load). Cross-platform browser-open (macOS `open`, Linux `xdg-open`, Windows `start`).
- **Live data via Octokit + sessionStorage PAT.** Recent merges (60s poll), queue state (15s poll), repo config, signed-in viewer. Public-mode fallback for unauthenticated browsing (rate-limited 60/hr).
- **Setup screen** with PAT paste, scope hints, link to GitHub token settings, rate-limit banner.
- **Slideouts** for merge detail, settings, nav (shadcn `Sheet`). Avatars throughout. Status chips emerald/sky/amber/rose.
- **Colorised `/4wd:status`** with ANSI banners and a sparkline-style recent-merges chart (gate-duration bars + ✓/✗ result chips).
- **`/4wd:dashboard` token discovery in `bin/dashboard.sh`** — checks `gh auth token`, `GITHUB_TOKEN`, `GH_TOKEN` and appends `#token=…` so the dashboard lands authenticated.
- 5 new BATS tests covering `/4wd:dashboard` URL composition + remote parsing + override (47 total).

### Deferred (TODO markers in source)

- `ratchetDelta` + `gateLog` on merge cards — browser has no FS access to `${CLAUDE_PLUGIN_DATA}/merge-log.jsonl`. Defer to v0.3.2.
- Kill-switch write-back from the dashboard (read-only stub today).
- GitHub OAuth device flow — PAT paste is the v0.3 contract.

---

## [0.2.1] — 2026-05-18

### Added

- **`merge.mode: "merge-queue"`** — `/4wd:merge` can submit through GitHub Merge Queue instead of pushing direct. Pushes feature branch with `--force-with-lease`, opens (or reuses) a PR via `gh pr create`, submits with `gh pr merge --merge-queue`, polls until merged.
- **`gh` ≥ 2.46 preflight** with clear upgrade hint.
- 8 new BATS tests for ghmq preflight + config schema (42 total).

### Changed

- **Ratchet relock is intentionally skipped** in merge-queue mode. The GHA workflow at `examples/github-actions/merge-queue.yml` owns the follow-up ratchet PR — pushing direct from `/4wd:merge` would defeat the queue.
- Updated config schema to validate `merge.mode` + `merge.ghmq.pollIntervalSeconds` + `merge.ghmq.timeoutSeconds`.
- README documents both modes and clarifies that concurrent `/4wd:merge` calls in merge-queue mode are safe (GHMQ handles serialisation).

### Fixed

- `config_load` rejects unknown `merge.mode` with a clear error.

---

## [0.2.0] — 2026-05-18

### Added

- **BATS test suite** (28 tests across 4 files) covering lock concurrency, stale lock reclaim, kill-switch precedence, gate failure, config validation, status output. Matrix CI on `ubuntu-latest` + `macos-latest`.
- **Ratchet pattern** (`.ratchet.json` + `scripts/check-ratchet.sh`) ported from `WANDERCOLTD/HF`. Three metrics: `shellcheck_warnings` (up-bad), `bats_tests` (down-bad), `todo_fixme_count` (up-bad). Locks downward-only.
- **Single-concern commit-msg hook** at `.githooks/commit-msg`. Rejects subjects that span 3+ subsystems. Activate via `git config core.hooksPath .githooks`.
- **GitHub Actions CI**: shellcheck across `bin/`, `lib/`, `scripts/`; BATS matrix; ratchet gate.
- **CONTRIBUTING.md** documenting the four engineering rules (one concern per commit, ratchet locks the win, tests with features, CI is canonical).

### Notes

- No functional changes to `/4wd:merge` or `/4wd:status` from v0.1.

---

## [0.1.1] — 2026-05-17

### Added

- **Kill switch.** Set `"disabled": true` in `.4wd.json` or `FWD_DISABLE=1` in the env. `/4wd:merge` exits 0 immediately with a clear message; `/4wd:status` shows `STATE: DISABLED` loudly. Env var beats config when both set.
- Schema field `disabled` documented.

---

## [0.1.0] — 2026-05-17

### Added

- **`/4wd:merge`** slash command. Rebase current branch onto `origin/main`, run a project-configurable gate, push on green, optionally re-lock a ratchet.
- **`/4wd:status`** slash command. Lock state, config, branch-protection state, recent merges.
- **File-based merge lock** with PID stamping + stale recovery (atomic `mkdir`).
- **Local gate runner** with configurable `timeoutSeconds`.
- **Optional ratchet re-lock** on green via `ratchet.file` + `ratchet.lockCommand`.
- **`SessionStart` hook** that warns when `main` has no branch protection.
- **`.4wd.json` schema** at `schema/4wd-config.schema.json`. Five-token minimum config:
  ```json
  { "gate": { "command": "npm test" } }
  ```
- **Examples**: `examples/minimal/`, `examples/hf/`, `examples/github-actions/` (GHMQ + remote-VM gate templates).
- MIT licence.

[Unreleased]: https://github.com/WANDERCOLTD/4wd/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/WANDERCOLTD/4wd/releases/tag/v0.3.0
[0.2.1]: https://github.com/WANDERCOLTD/4wd/releases/tag/v0.2.1
[0.2.0]: https://github.com/WANDERCOLTD/4wd/releases/tag/v0.2.0
[0.1.1]: https://github.com/WANDERCOLTD/4wd/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/WANDERCOLTD/4wd/commits/v0.2.0
