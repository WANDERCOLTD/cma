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

Requires `jq`, `git`, and `gh` (for the optional branch-protection check) on PATH.

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

## Pair with GitHub Merge Queue

This plugin handles the developer-experience layer (the `/cma:merge` invocation, lock state, gate streaming). For repos with two or more parallel contributors, the real serialisation primitive is **GitHub Merge Queue + branch protection** — the plugin doesn't try to replace it.

See [`examples/github-actions/`](./examples/github-actions/) for a working GHA template that uses GHMQ + a remote-VM gate runner. Use both together for the strongest setup.

## What's in v0.1

- `/cma:merge` and `/cma:status` slash commands.
- File-based PID-stamped lock (atomic `mkdir`).
- Local gate runner.
- Optional ratchet re-lock on green.
- `SessionStart` hook that warns if `main` has no branch protection.

Deferred (post-v0.1):
- Remote/VM gate runner (`runOn: "ssh"`).
- Long-lived queue subagent (waiting on Claude Code platform fixes for durable cross-session messaging).

## License

MIT. See [LICENSE](./LICENSE).
