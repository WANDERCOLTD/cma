#!/usr/bin/env bash
# bin/merge-status.sh — print lock state + recent merges + config summary.

set -u
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="${1:?repo root required as \$1}"

. "$PLUGIN_ROOT/lib/lock.sh"
. "$PLUGIN_ROOT/lib/config.sh"

cd "$ROOT" || { echo "merge-agent: cannot cd to $ROOT"; exit 1; }

if ! config_load "$ROOT" 2>/dev/null; then
  echo "merge-agent: no/invalid .merge-agent.json — run /merge to see setup help"
  exit 1
fi

LOCK_DIR="$ROOT/$CONFIG_LOCK_FILE"

echo "merge-agent — status"
echo "──────────────────────"
echo "config:"
echo "  gate.command:        $CONFIG_GATE_COMMAND"
echo "  gate.runOn:          $CONFIG_GATE_RUN_ON"
echo "  gate.timeoutSeconds: $CONFIG_GATE_TIMEOUT"
echo "  ratchet.file:        ${CONFIG_RATCHET_FILE:-<none>}"
echo "  branchProtection:    $CONFIG_BRANCH_PROTECTION"
echo

state=$(lock_state "$LOCK_DIR")
echo "lock state:"
echo "  $state"
echo

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  remote=$(git remote get-url origin 2>/dev/null)
  if [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    if gh api "repos/$owner/$repo/branches/main/protection" >/dev/null 2>&1; then
      echo "branch protection: ENABLED on main"
    else
      echo "branch protection: NOT enabled on main (direct pushes possible)"
    fi
  fi
else
  echo "branch protection: skipped (gh not available or not authenticated)"
fi
echo

LOG_DIR="${CLAUDE_PLUGIN_DATA:-$ROOT/.merge-agent-data}"
LOG="$LOG_DIR/merge-log.jsonl"
if [ -f "$LOG" ]; then
  echo "recent merges (last 5):"
  tail -n 5 "$LOG" | sed 's/^/  /'
else
  echo "recent merges: <none logged yet>"
fi
