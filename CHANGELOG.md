# Changelog

All notable changes to cma are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **v0.4.x** — Rust, Go, Ruby stack templates for `/cma:init` as point releases.
- **v0.5** — remote gate runner (`runOn: "ssh"`, `"gcloud-iap"`).
- **v0.6** — long-lived queue subagent (parked on Claude Code platform fixes).

---

## [0.4.0] — 2026-05-18

### Added

- **`/cma:init`** slash command — bootstrap cma into any project in one step.
  - Detects stack from marker files: Node (`package.json` with a `scripts.test`), Python (`pyproject.toml` / `requirements.txt`), shell/generic fallback. Override with `--stack`.
  - Emits 3 files: stack-specific `.merge-agent.json`, starter `.ratchet.json` (null baselines), and `scripts/check-ratchet.sh` tailored per stack (tsc/jest for Node, mypy/pytest for Python, shellcheck/bats for shell).
  - `--with-gha` adds `.github/workflows/cma-gate.yml`. Off by default to avoid clobbering existing CI. Suppressed for non-GitHub origins.
  - `--dry-run` previews changes. `--force` overwrites. `--merge` deep-merges into existing `.merge-agent.json` (preserves user fields).
  - `.gitignore` auto-updates with `.merge-agent.lock/` (dedupe-safe).
  - Refuses on non-git directories; prints actionable next-steps with the branch-protection URL for the current repo.
- New `lib/detect-stack.sh` helper.
- New templates under `examples/<stack>/`: `check-ratchet.sh` + `cma-gate.yml` for Node, Python, and shell/minimal.
- 20 new BATS tests for stack detection + init contracts (62 total).
- Closes [#2](https://github.com/WANDERCOLTD/cma/issues/2).

---

## [0.3.1] — 2026-05-18

### Added

- **Repo picker** on the setup screen — searchable `Command` list of the user's recently-pushed repos with Recent / Owned / Organisations tabs. Avatars from GitHub. Public-mode users get a manual `owner/name` paste field.
- `useUserRepos` hook fetches `GET /user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator,organization_member` with TanStack Query caching.
- `sessionStorage.cma:selectedRepo` persists the choice across reloads in the same tab.
- shadcn `Command` (cmdk) and `Tabs` (Radix Tabs) primitives added to `web/src/components/ui/`.

### Changed

- Setup screen no longer shows the "No repository configured" amber box — the picker handles that flow.
- App routing: `setup → picker → dashboard` with sessionStorage rehydrate.

---

## [0.3.0] — 2026-05-18

### Added

- **Web dashboard** at https://cma-dashboard-eight.vercel.app. Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui (Radix primitives) + Framer Motion + TanStack Query + Octokit.
- **`/cma:dashboard`** slash command. Opens the dashboard scoped to the current repo (`?repo=<owner>/<name>`) with a discovered token if available (URL hash, scrubbed after load). Cross-platform browser-open (macOS `open`, Linux `xdg-open`, Windows `start`).
- **Live data via Octokit + sessionStorage PAT.** Recent merges (60s poll), queue state (15s poll), repo config, signed-in viewer. Public-mode fallback for unauthenticated browsing (rate-limited 60/hr).
- **Setup screen** with PAT paste, scope hints, link to GitHub token settings, rate-limit banner.
- **Slideouts** for merge detail, settings, nav (shadcn `Sheet`). Avatars throughout. Status chips emerald/sky/amber/rose.
- **Colorised `/cma:status`** with ANSI banners and a sparkline-style recent-merges chart (gate-duration bars + ✓/✗ result chips).
- **`/cma:dashboard` token discovery in `bin/dashboard.sh`** — checks `gh auth token`, `GITHUB_TOKEN`, `GH_TOKEN` and appends `#token=…` so the dashboard lands authenticated.
- 5 new BATS tests covering `/cma:dashboard` URL composition + remote parsing + override (47 total).

### Deferred (TODO markers in source)

- `ratchetDelta` + `gateLog` on merge cards — browser has no FS access to `${CLAUDE_PLUGIN_DATA}/merge-log.jsonl`. Defer to v0.3.2.
- Kill-switch write-back from the dashboard (read-only stub today).
- GitHub OAuth device flow — PAT paste is the v0.3 contract.

---

## [0.2.1] — 2026-05-18

### Added

- **`merge.mode: "merge-queue"`** — `/cma:merge` can submit through GitHub Merge Queue instead of pushing direct. Pushes feature branch with `--force-with-lease`, opens (or reuses) a PR via `gh pr create`, submits with `gh pr merge --merge-queue`, polls until merged.
- **`gh` ≥ 2.46 preflight** with clear upgrade hint.
- 8 new BATS tests for ghmq preflight + config schema (42 total).

### Changed

- **Ratchet relock is intentionally skipped** in merge-queue mode. The GHA workflow at `examples/github-actions/merge-queue.yml` owns the follow-up ratchet PR — pushing direct from `/cma:merge` would defeat the queue.
- Updated config schema to validate `merge.mode` + `merge.ghmq.pollIntervalSeconds` + `merge.ghmq.timeoutSeconds`.
- README documents both modes and clarifies that concurrent `/cma:merge` calls in merge-queue mode are safe (GHMQ handles serialisation).

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

- No functional changes to `/cma:merge` or `/cma:status` from v0.1.

---

## [0.1.1] — 2026-05-17

### Added

- **Kill switch.** Set `"disabled": true` in `.merge-agent.json` or `CMA_DISABLE=1` in the env. `/cma:merge` exits 0 immediately with a clear message; `/cma:status` shows `STATE: DISABLED` loudly. Env var beats config when both set.
- Schema field `disabled` documented.

---

## [0.1.0] — 2026-05-17

### Added

- **`/cma:merge`** slash command. Rebase current branch onto `origin/main`, run a project-configurable gate, push on green, optionally re-lock a ratchet.
- **`/cma:status`** slash command. Lock state, config, branch-protection state, recent merges.
- **File-based merge lock** with PID stamping + stale recovery (atomic `mkdir`).
- **Local gate runner** with configurable `timeoutSeconds`.
- **Optional ratchet re-lock** on green via `ratchet.file` + `ratchet.lockCommand`.
- **`SessionStart` hook** that warns when `main` has no branch protection.
- **`.merge-agent.json` schema** at `schema/merge-agent-config.schema.json`. Five-token minimum config:
  ```json
  { "gate": { "command": "npm test" } }
  ```
- **Examples**: `examples/minimal/`, `examples/hf/`, `examples/github-actions/` (GHMQ + remote-VM gate templates).
- MIT licence.

[Unreleased]: https://github.com/WANDERCOLTD/cma/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/WANDERCOLTD/cma/releases/tag/v0.3.0
[0.2.1]: https://github.com/WANDERCOLTD/cma/releases/tag/v0.2.1
[0.2.0]: https://github.com/WANDERCOLTD/cma/releases/tag/v0.2.0
[0.1.1]: https://github.com/WANDERCOLTD/cma/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/WANDERCOLTD/cma/commits/v0.2.0
