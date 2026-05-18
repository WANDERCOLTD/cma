#!/usr/bin/env bash
# lib/config.sh — read + validate .merge-agent.json.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"
#   config_load "$repo_root"     # sets CONFIG_* env vars, exits non-zero on error
#
# Required: jq on PATH.

set -u

# Defaults
CONFIG_GATE_COMMAND=""
CONFIG_GATE_RUN_ON="local"
CONFIG_GATE_TIMEOUT="900"
CONFIG_RATCHET_FILE=""
CONFIG_RATCHET_LOCK_COMMAND=""
CONFIG_RATCHET_COMMIT_MESSAGE="chore: ratchet update after merge"
CONFIG_BRANCH_PROTECTION="warn"
CONFIG_LOCK_FILE=".merge-agent.lock"
CONFIG_LOCK_TTL="1800"

config_load() {
  local root="$1"
  local cfg="$root/.merge-agent.json"

  if [ ! -f "$cfg" ]; then
    echo "merge-agent: no .merge-agent.json at repo root ($cfg)" >&2
    echo "Create one — minimum:" >&2
    echo '  { "gate": { "command": "npm test" } }' >&2
    return 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "merge-agent: jq is required but not on PATH. Install jq and retry." >&2
    return 1
  fi

  if ! jq empty "$cfg" 2>/dev/null; then
    echo "merge-agent: $cfg is not valid JSON" >&2
    return 1
  fi

  CONFIG_GATE_COMMAND=$(jq -r '.gate.command // ""' "$cfg")
  if [ -z "$CONFIG_GATE_COMMAND" ]; then
    echo "merge-agent: .gate.command is required in $cfg" >&2
    return 1
  fi

  CONFIG_GATE_RUN_ON=$(jq -r '.gate.runOn // "local"' "$cfg")
  CONFIG_GATE_TIMEOUT=$(jq -r '.gate.timeoutSeconds // 900' "$cfg")

  CONFIG_RATCHET_FILE=$(jq -r '.ratchet.file // ""' "$cfg")
  CONFIG_RATCHET_LOCK_COMMAND=$(jq -r '.ratchet.lockCommand // ""' "$cfg")
  CONFIG_RATCHET_COMMIT_MESSAGE=$(jq -r '.ratchet.commitMessage // "chore: ratchet update after merge"' "$cfg")

  CONFIG_BRANCH_PROTECTION=$(jq -r '.branchProtection // "warn"' "$cfg")
  CONFIG_LOCK_FILE=$(jq -r '.lockFile // ".merge-agent.lock"' "$cfg")
  CONFIG_LOCK_TTL=$(jq -r '.lockTtlSeconds // 1800' "$cfg")

  # v0.1 only supports local. Reject ssh/container loudly so adopters know what's deferred.
  case "$CONFIG_GATE_RUN_ON" in
    local) ;;
    ssh|container|vm)
      echo "merge-agent: gate.runOn=\"$CONFIG_GATE_RUN_ON\" is not supported in v0.1 — only \"local\" is implemented." >&2
      echo "Remote/VM gate runner lands in v0.2 — see README." >&2
      return 1
      ;;
    *)
      echo "merge-agent: gate.runOn=\"$CONFIG_GATE_RUN_ON\" is not a known runner." >&2
      return 1
      ;;
  esac

  return 0
}
