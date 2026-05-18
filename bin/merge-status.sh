#!/usr/bin/env bash
# bin/merge-status.sh — print lock state + recent merges + config summary.

set -u
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="${1:?repo root required as \$1}"

. "$PLUGIN_ROOT/lib/lock.sh"
. "$PLUGIN_ROOT/lib/config.sh"

cd "$ROOT" || { echo "merge-agent: cannot cd to $ROOT"; exit 1; }

# ── ANSI colours (respect NO_COLOR + non-TTY) ──────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET='\033[0m'
  C_DIM='\033[2m'
  C_BOLD='\033[1m'
  C_GREEN='\033[32m'
  C_AMBER='\033[33m'
  C_ROSE='\033[31m'
  C_BLUE='\033[34m'
  C_PURPLE='\033[35m'
else
  C_RESET=''; C_DIM=''; C_BOLD=''; C_GREEN=''; C_AMBER=''; C_ROSE=''; C_BLUE=''; C_PURPLE=''
fi

# Helper: print a banner heading.
banner() {
  printf '\n%b%b%s%b\n' "$C_BOLD" "$C_PURPLE" "── $1 " "$C_RESET"
  printf '%b%s%b\n' "$C_DIM" "$(printf '─%.0s' $(seq 1 50))" "$C_RESET"
}

# Helper: print a key/value row.
row() {
  printf '  %b%-22s%b %s\n' "$C_DIM" "$1" "$C_RESET" "$2"
}

if ! config_load "$ROOT" 2>/dev/null; then
  echo "cma: no/invalid .merge-agent.json — run /cma:merge to see setup help"
  exit 1
fi

LOCK_DIR="$ROOT/$CONFIG_LOCK_FILE"

# ── Header + state banner ──────────────────────────────────────────────────
printf '\n%b%b cma %b — Claude Merge Agent\n' "$C_BOLD" "$C_PURPLE" "$C_RESET"

if [ "${CMA_DISABLE:-0}" = "1" ]; then
  printf '  %bSTATE: DISABLED%b via CMA_DISABLE=1 env var %b(env var wins over config)%b\n' \
    "$C_ROSE" "$C_RESET" "$C_DIM" "$C_RESET"
elif [ "$CONFIG_DISABLED" = "true" ]; then
  printf '  %bSTATE: DISABLED%b via .merge-agent.json %b("disabled": true)%b\n' \
    "$C_ROSE" "$C_RESET" "$C_DIM" "$C_RESET"
else
  printf '  %bSTATE: ENABLED%b\n' "$C_GREEN" "$C_RESET"
fi

# ── Config ─────────────────────────────────────────────────────────────────
banner "config"
row "gate.command:"        "$CONFIG_GATE_COMMAND"
row "gate.runOn:"          "$CONFIG_GATE_RUN_ON"
row "gate.timeoutSeconds:" "$CONFIG_GATE_TIMEOUT"
row "merge.mode:"          "$CONFIG_MERGE_MODE"
row "ratchet.file:"        "${CONFIG_RATCHET_FILE:-<none>}"
row "branchProtection:"    "$CONFIG_BRANCH_PROTECTION"

# ── Lock state ─────────────────────────────────────────────────────────────
banner "lock state"
state=$(lock_state "$LOCK_DIR")
if echo "$state" | grep -q '"held":false'; then
  printf '  %bIDLE%b\n' "$C_GREEN" "$C_RESET"
else
  branch=$(echo "$state" | sed -n 's/.*"branch":"\([^"]*\)".*/\1/p')
  pid=$(echo "$state" | sed -n 's/.*"pid":\([0-9]*\).*/\1/p')
  age=$(echo "$state" | sed -n 's/.*"age_seconds":\([0-9]*\).*/\1/p')
  pid_alive=$(echo "$state" | sed -n 's/.*"pid_alive":\([a-z]*\).*/\1/p')

  if [ "${age:-0}" -gt "${CONFIG_LOCK_TTL:-1800}" ]; then
    printf '  %bHELD%b by %s (pid %s, age %ss) %b— STALE (TTL %ss exceeded)%b\n' \
      "$C_AMBER" "$C_RESET" "$branch" "$pid" "$age" "$C_AMBER" "$CONFIG_LOCK_TTL" "$C_RESET"
  elif [ "$pid_alive" = "false" ]; then
    printf '  %bHELD%b by %s (pid %s — dead) %b— will be reclaimed on next merge%b\n' \
      "$C_AMBER" "$C_RESET" "$branch" "$pid" "$C_AMBER" "$C_RESET"
  else
    printf '  %bHELD%b by %s (pid %s, age %ss)\n' \
      "$C_BLUE" "$C_RESET" "$branch" "$pid" "$age"
  fi
fi

# ── Branch protection ──────────────────────────────────────────────────────
banner "branch protection on main"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  remote=$(git remote get-url origin 2>/dev/null || true)
  if [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    if gh api "repos/$owner/$repo/branches/main/protection" >/dev/null 2>&1; then
      printf '  %bENABLED%b on %s/%s\n' "$C_GREEN" "$C_RESET" "$owner" "$repo"
    else
      printf '  %bNOT ENABLED%b on %s/%s %b— direct pushes possible%b\n' \
        "$C_AMBER" "$C_RESET" "$owner" "$repo" "$C_DIM" "$C_RESET"
    fi
  fi
else
  printf '  %bskipped%b — gh not available or not authenticated\n' "$C_DIM" "$C_RESET"
fi

# ── Recent merges + bar chart ──────────────────────────────────────────────
banner "recent merges"
LOG_DIR="${CLAUDE_PLUGIN_DATA:-$ROOT/.merge-agent-data}"
LOG="$LOG_DIR/merge-log.jsonl"

if [ ! -f "$LOG" ]; then
  printf '  %b<none logged yet — your next /cma:merge will be the first>%b\n' "$C_DIM" "$C_RESET"
else
  # Pull last 10 entries, extract { ts, branch, sha, gate_seconds, result }.
  tail -n 10 "$LOG" | while IFS= read -r line; do
    [ -z "$line" ] && continue
    ts=$(echo "$line"     | sed -n 's/.*"ts":"\([^"]*\)".*/\1/p')
    branch=$(echo "$line" | sed -n 's/.*"branch":"\([^"]*\)".*/\1/p')
    sha=$(echo "$line"    | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p')
    secs=$(echo "$line"   | sed -n 's/.*"gate_seconds":\([0-9]*\).*/\1/p')
    res=$(echo "$line"    | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')

    # Bar chart: 1 block per 30s, capped at 30 blocks (= 15 min).
    blocks=$(( ${secs:-0} / 30 ))
    [ "$blocks" -gt 30 ] && blocks=30
    bar=$(printf '█%.0s' $(seq 1 "$blocks" 2>/dev/null) 2>/dev/null)

    case "$res" in
      MERGED) sym=$(printf '%b✓%b' "$C_GREEN" "$C_RESET") ;;
      FAILED) sym=$(printf '%b✗%b' "$C_ROSE"  "$C_RESET") ;;
      *)      sym=$(printf '%b·%b' "$C_DIM"   "$C_RESET") ;;
    esac

    short_sha="${sha:0:8}"
    short_ts="${ts:5:11}"   # "MM-DDTHH:MM"
    printf '  %s %s %b%-30s%b %b%4ss%b %b%s%b\n' \
      "$sym" "$short_ts" "$C_BOLD" "$branch" "$C_RESET" "$C_BLUE" "$secs" "$C_RESET" \
      "$C_DIM" "$bar $short_sha" "$C_RESET"
  done
fi

echo
