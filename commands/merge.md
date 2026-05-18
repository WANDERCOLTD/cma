---
name: merge
description: Rebase current branch onto origin/main, run the project's canonical gate, push to main on green. Reads .merge-agent.json at the repo root.
---

# /cma:merge

Run the serialised merge flow for the current feature branch.

## What I will do

1. Read `.merge-agent.json` at the repo root. If missing, print setup instructions and stop.
2. Refuse if the current branch is `main` (you can't merge main into itself).
3. Acquire the file-based merge lock. If another `/cma:merge` is already in progress, print the lock holder + age and stop with `QUEUED — try again when the lock releases` (Phase 1 has no auto-wait; that lands in v0.2).
4. `git fetch origin main && git rebase origin/main`. On conflict: release lock, print the conflicting files, abort.
5. Run the configured `gate.command` with a `timeoutSeconds` deadline. Stream output as it runs.
6. On green:
   - `git push origin main`
   - If `ratchet.lockCommand` is configured and `ratchet.file` changes, commit the update and push.
7. Release the lock. Print `MERGED: <sha> <branch>` or `FAIL: <reason>`.

## How to execute

Run the bundled script from the plugin root, passing the repo root as `$1`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/merge.sh" "$(git rev-parse --show-toplevel)"
```

Stream output verbatim. The script exits 0 on `MERGED`, non-zero on any failure path. Do not interpret the output — just relay it.

## Pre-flight

Before invoking the script, verify:
- The current working directory is inside a git repo (`git rev-parse --show-toplevel` succeeds).
- The user is on a non-default branch.

If either fails, explain to the user and don't run the script.
