#!/usr/bin/env bash
# lib/config.sh — read + validate .4wd.json.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"
#   config_load "$repo_root"     # sets CONFIG_* env vars, exits non-zero on error
#
# Required: jq on PATH.
#
# All CONFIG_* variables are read by sourcing callers (bin/merge.sh,
# bin/merge-status.sh). The file-level disable below silences SC2034 for the
# whole module since shellcheck only sees the assignments here, not the reads.

# shellcheck disable=SC2034

set -u

# Defaults — overridden by config_load.
CONFIG_DISABLED="false"
CONFIG_GATE_COMMAND=""
CONFIG_GATE_RUN_ON="local"
CONFIG_GATE_TIMEOUT="900"
CONFIG_RATCHET_FILE=""
CONFIG_RATCHET_LOCK_COMMAND=""
CONFIG_RATCHET_COMMIT_MESSAGE="chore: ratchet update after merge"
CONFIG_BRANCH_PROTECTION="warn"
CONFIG_LOCK_FILE=".4wd.lock"
CONFIG_LOCK_TTL="1800"
CONFIG_MERGE_MODE="direct-push"
CONFIG_GHMQ_POLL_INTERVAL="30"
CONFIG_GHMQ_TIMEOUT="1800"

config_load() {
  local root="$1"
  local cfg="$root/.4wd.json"

  if [ ! -f "$cfg" ]; then
    echo "4wd: no .4wd.json at repo root ($cfg)" >&2
    echo "Create one — minimum:" >&2
    echo '  { "gate": { "command": "npm test" } }' >&2
    return 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "4wd: jq is required but not on PATH. Install jq and retry." >&2
    return 1
  fi

  if ! jq empty "$cfg" 2>/dev/null; then
    echo "4wd: $cfg is not valid JSON" >&2
    return 1
  fi

  CONFIG_DISABLED=$(jq -r '.disabled // false' "$cfg")

  CONFIG_GATE_COMMAND=$(jq -r '.gate.command // ""' "$cfg")
  if [ -z "$CONFIG_GATE_COMMAND" ]; then
    echo "4wd: .gate.command is required in $cfg" >&2
    return 1
  fi

  CONFIG_GATE_RUN_ON=$(jq -r '.gate.runOn // "local"' "$cfg")
  CONFIG_GATE_TIMEOUT=$(jq -r '.gate.timeoutSeconds // 900' "$cfg")

  CONFIG_RATCHET_FILE=$(jq -r '.ratchet.file // ""' "$cfg")
  CONFIG_RATCHET_LOCK_COMMAND=$(jq -r '.ratchet.lockCommand // ""' "$cfg")
  CONFIG_RATCHET_COMMIT_MESSAGE=$(jq -r '.ratchet.commitMessage // "chore: ratchet update after merge"' "$cfg")

  CONFIG_BRANCH_PROTECTION=$(jq -r '.branchProtection // "warn"' "$cfg")
  CONFIG_LOCK_FILE=$(jq -r '.lockFile // ".4wd.lock"' "$cfg")
  CONFIG_LOCK_TTL=$(jq -r '.lockTtlSeconds // 1800' "$cfg")

  CONFIG_MERGE_MODE=$(jq -r '.merge.mode // "direct-push"' "$cfg")
  CONFIG_GHMQ_POLL_INTERVAL=$(jq -r '.merge.ghmq.pollIntervalSeconds // 30' "$cfg")
  CONFIG_GHMQ_TIMEOUT=$(jq -r '.merge.ghmq.timeoutSeconds // 1800' "$cfg")

  case "$CONFIG_MERGE_MODE" in
    direct-push|merge-queue) ;;
    *)
      echo "4wd: merge.mode=\"$CONFIG_MERGE_MODE\" is unknown — use \"direct-push\" or \"merge-queue\"." >&2
      return 1
      ;;
  esac

  # v0.2 still only supports local gate execution. Remote runners land in v0.3.
  case "$CONFIG_GATE_RUN_ON" in
    local) ;;
    ssh|container|vm|gcloud-iap)
      echo "4wd: gate.runOn=\"$CONFIG_GATE_RUN_ON\" is not supported in v0.2 — only \"local\" is implemented." >&2
      echo "Remote/VM gate runner lands in v0.3 — see README." >&2
      return 1
      ;;
    *)
      echo "4wd: gate.runOn=\"$CONFIG_GATE_RUN_ON\" is not a known runner." >&2
      return 1
      ;;
  esac

  return 0
}
