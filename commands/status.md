---
name: status
description: Show current merge lock state, recent merge log, and config summary for this repo.
---

# /4wd:status

Inspect the 4wd state for this repo.

## What I will print

- Lock state: `IDLE`, or `HELD by <branch> @ <pid> for <age>` (with stale warning if older than `lockTtlSeconds`).
- Config summary: gate command, runner, ratchet file (if any), branch-protection mode.
- Last 5 merge results from the log.
- Whether `main` currently has branch protection enabled (via `gh api`, if `gh` is authenticated).

## How to execute

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/merge-status.sh" "$(git rev-parse --show-toplevel)"
```

Relay output verbatim.
