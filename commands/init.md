---
name: init
description: Bootstrap cma gate + ratchet + (optional) GitHub Actions into the current project. Detects the stack (Node, Python, shell) and drops the right starter files.
---

# /cma:init

Set up cma for a fresh project — detects the stack, copies the right templates, and tells you what to do next.

## What I will do

1. Verify the current directory is a git repo (refuse otherwise).
2. Detect the project's stack from marker files:
   - `pyproject.toml` or `requirements.txt` → Python
   - `package.json` (with or without a `"scripts".test`) → Node
   - Otherwise → shell/generic
   You can override with `--stack node|python|shell`.
3. Emit three files (more with `--with-gha`):
   - `.merge-agent.json` with the stack's default `gate.command`.
   - `.ratchet.json` with `null` baselines (locked manually before your first commit).
   - `scripts/check-ratchet.sh` — stack-tailored ratchet script.
   - `.github/workflows/cma-gate.yml` — only with `--with-gha`. Suppressed when `origin` isn't GitHub.
4. Touch `.gitignore` to add `.merge-agent.lock/`.
5. Print next steps including the branch-protection URL for your repo.

## Flags

| Flag | Effect |
|------|--------|
| `--stack <name>` | Force a stack (`node`, `python`, `shell`). Skips detection. |
| `--force` | Overwrite existing files. |
| `--merge` | Deep-merge into existing `.merge-agent.json` (preserves your fields). |
| `--dry-run` | Show what would happen without writing anything. |
| `--with-gha` | Also emit `.github/workflows/cma-gate.yml`. Off by default to avoid clobbering existing CI. |

## How to execute

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/init.sh" "$(git rev-parse --show-toplevel)" "$@"
```

Stream output verbatim. The script exits:
- 0 on success (or dry-run completed)
- 1 on file collision (the user should re-run with `--force` or `--merge`)
- 2 on invocation error / not a git repo / unknown stack

## Pre-flight

- The current dir must be inside a git repo. The script will refuse and print the fix.
- jq is required (already a cma dependency).
