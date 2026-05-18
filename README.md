# cma — Claude Merge Agent

Serialised merge-to-main for Claude Code, with a project-configurable canonical gate. Pairs cleanly with GitHub Merge Queue — this plugin is the developer-experience layer on top.

## Why

Heavy parallel Claude Code use produces specific pain:

- Multiple agents / sessions push directly to `main`, causing mid-rebase drift.
- Quality-gate ratchet baselines (TSC errors, lint warnings, test counts) drift under parallel commits, blocking deploys.
- Mac ↔ Linux platform skew means local pre-flight isn't authoritative — the canonical gate must run on the canonical platform.

`cma` makes `/cma:merge` the one place a Claude Code session goes when work is ready for `main`. It rebases onto current `origin/main`, runs your project's configured gate, pushes only on green, and (optionally) re-locks any per-project ratchet downward.

## Install

```bash
claude plugin marketplace add WANDERCOLTD/cma
claude plugin install cma
```

Requires `jq`, `git`, and `gh` >= 2.46.0 on PATH. `gh` is optional for the branch-protection check; required when `merge.mode: "merge-queue"`.

## Configure

Drop a `.merge-agent.json` at your repo root. Minimum (5 tokens):

```json
{ "gate": { "command": "npm test" } }
```

Full schema:

```json
{
  "gate": {
    "command": "bash scripts/deploy-gate.sh dev",
    "runOn": "local",
    "timeoutSeconds": 900
  },
  "merge": {
    "mode": "direct-push",
    "ghmq": {
      "pollIntervalSeconds": 30,
      "timeoutSeconds": 1800
    }
  },
  "ratchet": {
    "file": ".ratchet.json",
    "lockCommand": "bash scripts/check-ratchet.sh lock",
    "commitMessage": "chore: ratchet update after merge"
  },
  "branchProtection": "warn",
  "lockFile": ".merge-agent.lock",
  "lockTtlSeconds": 1800
}
```

### Merge modes

| `merge.mode` | Behaviour |
|--------------|-----------|
| `direct-push` (default) | After a green gate, `git push origin HEAD:main`. Optionally re-locks the ratchet inline. |
| `merge-queue` | After a green gate, pushes the feature branch with `--force-with-lease`, opens (or reuses) a PR via `gh pr create`, submits with `gh pr merge --merge-queue`, polls until merged. Ratchet relock is **skipped** — let the GHA merge-queue workflow handle it via a follow-up PR (see [`examples/github-actions/`](./examples/github-actions/)). |

Use `merge-queue` when branch protection on `main` requires PRs. Concurrent `/cma:merge` calls in `merge-queue` mode are safe — GHMQ handles serialisation on the GitHub side; the local file lock is irrelevant in that mode.

See `examples/minimal/.merge-agent.json` and `examples/hf/.merge-agent.json`.

## Use

From a feature branch:

```
/cma:merge
```

Flow:
1. Reads `.merge-agent.json`.
2. Acquires the file lock (or refuses + tells you who holds it).
3. `git fetch origin main && git rebase origin/main` — fails fast on conflict.
4. Runs the gate command, streaming output. Killed at `timeoutSeconds`.
5. On green: `git push origin main`. If a ratchet command is configured and the file changed, commits + pushes the update.
6. Releases the lock. Prints `MERGED: <sha> <branch>` or `FAIL: <reason>`.

To inspect state:

```
/cma:status
```

Colorised output with config, lock state, branch-protection status, and a sparkline-style history of recent merges (gate duration bar + ✓/✗ result chip).

To open the live web dashboard scoped to the current repo:

```
/cma:dashboard
```

Opens **https://cma-dashboard-eight.vercel.app** in your default browser with `?repo=<owner>/<name>` set so it immediately scopes to the project you're in. Override the URL via `dashboard.url` in `.merge-agent.json` if you self-host the dashboard.

## Pair with GitHub Merge Queue

This plugin handles the developer-experience layer (the `/cma:merge` invocation, lock state, gate streaming). For repos with two or more parallel contributors, the real serialisation primitive is **GitHub Merge Queue + branch protection** — the plugin doesn't try to replace it.

See [`examples/github-actions/`](./examples/github-actions/) for a working GHA template that uses GHMQ + a remote-VM gate runner. Use both together for the strongest setup.

## Releases

| Version | What | Status |
|---------|------|--------|
| **v0.1.0** | `/cma:merge` + `/cma:status` slash commands. File-based PID-stamped lock (atomic `mkdir`). Local gate runner. Optional ratchet re-lock on green. `SessionStart` hook. | ✅ Shipped |
| **v0.1.1** | Kill switch (`"disabled": true` in config, `CMA_DISABLE=1` env var). | ✅ Shipped |
| **v0.2.0** | BATS test suite (42 tests, Mac + Ubuntu CI matrix). Shellcheck + ratchet gate. Single-concern commit-msg hook. | ✅ Shipped |
| **v0.2.1** | GHMQ submit-mode (`merge.mode: "merge-queue"`). `gh` ≥ 2.46 preflight. Ratchet relock intentionally skipped in queue mode. | ✅ Shipped |
| **v0.3.0** | Web dashboard (Vite + React + shadcn/ui). `/cma:dashboard` slash command. Live GitHub data via Octokit + sessionStorage PAT. Hosted at cma-dashboard-eight.vercel.app. | ✅ Shipped |
| **v0.4** | Remote gate runner (`runOn: "ssh"` + `"gcloud-iap"`). | 📋 Planned |
| **v0.5** | Long-lived queue subagent (waiting on Claude Code durable cross-session messaging). | ⏸️ Parked |

## Kill switch

`cma` is always opt-in by invocation — `/vm-cp`, `git push`, and other workflows keep working untouched whether the plugin is installed or not. For when you want the slash commands themselves to no-op without uninstalling the plugin:

- **Per-repo:** set `"disabled": true` in `.merge-agent.json`. `/cma:merge` exits 0 with `cma: disabled via config — use your normal push flow` and never touches git.
- **Per-invocation:** `CMA_DISABLE=1` env var. Overrides the config field. Useful when you want to temporarily bypass without editing the file.

`/cma:status` always works and shows the current state at the top (`STATE: ENABLED` or `STATE: DISABLED via …`).

## Distribution

Today: install via the GitHub marketplace path —

```bash
claude plugin marketplace add WANDERCOLTD/cma
claude plugin install cma
```

Submission to the official `claude.com/plugins` listing is open at https://platform.claude.com/plugins/submit. The repo is ready: manifest at `.claude-plugin/plugin.json`, MIT license, semver tags (v0.3.0 latest), CI green on `ubuntu-latest` + `macos-latest`, 42 BATS tests, README + CONTRIBUTING.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). TL;DR: one concern per commit, ratchet locks the win, tests come with features, CI is canonical.

## License

MIT. See [LICENSE](./LICENSE).
