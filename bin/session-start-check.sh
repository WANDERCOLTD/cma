#!/usr/bin/env bash
# bin/session-start-check.sh — SessionStart hook.
#
# If .4wd.json is present at the repo root and branchProtection is
# "warn" or "error", check whether origin/main has branch protection enabled
# via gh. Emit a warning (or block, per config). Otherwise silent.

set -u

# Find repo root from $PWD (hooks run with $PWD = workspace).
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
CFG="$ROOT/.4wd.json"
[ -f "$CFG" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

mode=$(jq -r '.branchProtection // "warn"' "$CFG" 2>/dev/null)
[ "$mode" = "off" ] && exit 0

command -v gh >/dev/null 2>&1 || exit 0
gh auth status >/dev/null 2>&1 || exit 0

remote=$(git -C "$ROOT" remote get-url origin 2>/dev/null) || exit 0
if [[ ! "$remote" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  exit 0
fi
owner="${BASH_REMATCH[1]}"
repo="${BASH_REMATCH[2]}"

if gh api "repos/$owner/$repo/branches/main/protection" >/dev/null 2>&1; then
  exit 0
fi

if [ "$mode" = "error" ]; then
  echo "4wd: ERROR — main has no branch protection. Direct pushes are possible." >&2
  echo "  Configure branch protection at: https://github.com/$owner/$repo/settings/branches" >&2
  exit 2
fi

echo "4wd: WARN — main has no branch protection. Direct pushes are possible." >&2
echo "  Configure at: https://github.com/$owner/$repo/settings/branches" >&2
exit 0
