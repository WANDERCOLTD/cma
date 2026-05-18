#!/usr/bin/env bash
# bin/merge.sh — Phase 1 entry point.
# Args: $1 = repo root (typically $(git rev-parse --show-toplevel))
#
# Flow: read config → acquire lock → fetch+rebase → run gate → push → optional
# ratchet re-lock → release lock. Exits 0 on MERGED, non-zero otherwise.

set -u
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="${1:?repo root required as \$1}"

. "$PLUGIN_ROOT/lib/lock.sh"
. "$PLUGIN_ROOT/lib/config.sh"
. "$PLUGIN_ROOT/lib/ratchet.sh"

# ── pre-flight ──────────────────────────────────────────────────────────────
cd "$ROOT" || { echo "merge-agent: cannot cd to $ROOT"; exit 1; }

# Env-var kill switch (takes precedence over config).
if [ "${CMA_DISABLE:-0}" = "1" ]; then
  echo "cma: disabled via CMA_DISABLE=1 — use your normal push flow (e.g. /vm-cp, git push)"
  exit 0
fi

if ! config_load "$ROOT"; then
  exit 1
fi

# Config-level kill switch.
if [ "$CONFIG_DISABLED" = "true" ]; then
  echo "cma: disabled via .merge-agent.json (\"disabled\": true) — use your normal push flow"
  exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "merge-agent: ERROR — could not determine current branch (detached HEAD?)"
  exit 1
fi
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "merge-agent: ERROR — refusing to merge $CURRENT_BRANCH into itself. Check out a feature branch first."
  exit 1
fi

LOCK_DIR="$ROOT/$CONFIG_LOCK_FILE"

# ── acquire lock ────────────────────────────────────────────────────────────
lock_acquire "$LOCK_DIR" "$CURRENT_BRANCH" "$CONFIG_LOCK_TTL"
lock_rc=$?
case "$lock_rc" in
  0) ;;
  1)
    state=$(lock_state "$LOCK_DIR")
    echo "merge-agent: QUEUED — another merge is in progress."
    echo "  $state"
    echo "merge-agent: v0.1 has no auto-wait — try again when the lock releases. (Auto-queue lands in v0.2.)"
    exit 2
    ;;
  2)
    echo "merge-agent: reclaimed stale lock (previous owner dead or aged out)."
    ;;
esac

# Ensure lock is released on any exit path.
trap 'lock_release "$LOCK_DIR"' EXIT

# ── fetch + rebase ──────────────────────────────────────────────────────────
echo "merge-agent: fetching origin/main"
if ! git fetch origin main; then
  echo "merge-agent: FAIL — git fetch origin main failed"
  exit 1
fi

echo "merge-agent: rebasing $CURRENT_BRANCH onto origin/main"
if ! git rebase origin/main; then
  echo "merge-agent: REBASE CONFLICT — aborting rebase, releasing lock"
  git rebase --abort 2>/dev/null || true
  echo "merge-agent: resolve conflicts on $CURRENT_BRANCH and run /merge again"
  exit 1
fi

# ── gate ────────────────────────────────────────────────────────────────────
echo "merge-agent: running gate (timeout ${CONFIG_GATE_TIMEOUT}s): $CONFIG_GATE_COMMAND"
echo "─────────────────────────────────────────────────────────────"

if command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN=gtimeout
elif command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN=timeout
else
  TIMEOUT_BIN=""
fi

GATE_START=$(date +%s)
if [ -n "$TIMEOUT_BIN" ]; then
  $TIMEOUT_BIN --foreground "$CONFIG_GATE_TIMEOUT" bash -c "$CONFIG_GATE_COMMAND"
  gate_rc=$?
else
  bash -c "$CONFIG_GATE_COMMAND"
  gate_rc=$?
fi
GATE_END=$(date +%s)
GATE_ELAPSED=$(( GATE_END - GATE_START ))

echo "─────────────────────────────────────────────────────────────"
echo "merge-agent: gate finished in ${GATE_ELAPSED}s with exit code $gate_rc"

if [ "$gate_rc" -ne 0 ]; then
  if [ "$gate_rc" -eq 124 ]; then
    echo "merge-agent: TIMEOUT — gate exceeded ${CONFIG_GATE_TIMEOUT}s and was killed"
  fi
  echo "merge-agent: FAIL — gate exited $gate_rc, not pushing"
  exit 1
fi

# ── push ────────────────────────────────────────────────────────────────────
echo "merge-agent: pushing $CURRENT_BRANCH to origin/main"
if ! git push origin "HEAD:main"; then
  echo "merge-agent: PUSH FAILED — non-fast-forward or branch protection rejected"
  echo "merge-agent: your branch is rebased locally; re-run /merge to retry"
  exit 1
fi

MERGED_SHA=$(git rev-parse HEAD)

# ── optional ratchet re-lock ────────────────────────────────────────────────
ratchet_relock_if_changed "$ROOT" "$CONFIG_RATCHET_FILE" "$CONFIG_RATCHET_LOCK_COMMAND" "$CONFIG_RATCHET_COMMIT_MESSAGE"

# ── log + done ──────────────────────────────────────────────────────────────
LOG_DIR="${CLAUDE_PLUGIN_DATA:-$ROOT/.merge-agent-data}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/merge-log.jsonl"
printf '{"ts":"%s","branch":"%s","sha":"%s","gate_seconds":%s,"result":"MERGED"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CURRENT_BRANCH" "$MERGED_SHA" "$GATE_ELAPSED" >> "$LOG"

echo "merge-agent: MERGED  $MERGED_SHA  $CURRENT_BRANCH  (gate ${GATE_ELAPSED}s)"
exit 0
