---
name: dashboard
description: Open the 4wd web dashboard for the current repo in the default browser. Shows live queue, recent merges, and config.
---

# /4wd:dashboard

Open the 4wd web dashboard pointed at the current repo.

## How to execute

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/dashboard.sh" "$(git rev-parse --show-toplevel)"
```

The script detects the GitHub `owner/repo` from `origin` and opens the dashboard with `?repo=<owner>/<repo>` set, so the dashboard immediately scopes to this project.

## Pre-flight

- The current dir must be inside a git repo.
- `origin` must point at a GitHub URL (SSH or HTTPS).

If either fails, the script prints a clear error and exits non-zero.
