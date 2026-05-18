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
. "$PLUGIN_ROOT/lib/ghmq.sh"

# ── pre-flight ──────────────────────────────────────────────────────────────
cd "$ROOT" || { echo "4wd: cannot cd to $ROOT"; exit 1; }

# Env-var kill switch (takes precedence over config).
if [ "${FWD_DISABLE:-0}" = "1" ]; then
  echo "4wd: disabled via FWD_DISABLE=1 — use your normal push flow (e.g. /vm-cp, git push)"
  exit 0
fi

if ! config_load "$ROOT"; then
  exit 1
fi

# Config-level kill switch.
if [ "$CONFIG_DISABLED" = "true" ]; then
  echo "4wd: disabled via .4wd.json (\"disabled\": true) — use your normal push flow"
  exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "4wd: ERROR — could not determine current branch (detached HEAD?)"
  exit 1
fi
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "4wd: ERROR — refusing to merge $CURRENT_BRANCH into itself. Check out a feature branch first."
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
    echo "4wd: QUEUED — another merge is in progress."
    echo "  $state"
    echo "4wd: v0.1 has no auto-wait — try again when the lock releases. (Auto-queue lands in v0.2.)"
    exit 2
    ;;
  2)
    echo "4wd: reclaimed stale lock (previous owner dead or aged out)."
    ;;
esac

# Ensure lock is released on any exit path.
trap 'lock_release "$LOCK_DIR"' EXIT

# ── fetch + rebase ──────────────────────────────────────────────────────────
echo "4wd: fetching origin/main"
if ! git fetch origin main; then
  echo "4wd: FAIL — git fetch origin main failed"
  exit 1
fi

echo "4wd: rebasing $CURRENT_BRANCH onto origin/main"
if ! git rebase origin/main; then
  echo "4wd: REBASE CONFLICT — aborting rebase, releasing lock"
  git rebase --abort 2>/dev/null || true
  echo "4wd: resolve conflicts on $CURRENT_BRANCH and run /merge again"
  exit 1
fi

# ── gate ────────────────────────────────────────────────────────────────────
echo "4wd: running gate (timeout ${CONFIG_GATE_TIMEOUT}s): $CONFIG_GATE_COMMAND"
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
echo "4wd: gate finished in ${GATE_ELAPSED}s with exit code $gate_rc"

if [ "$gate_rc" -ne 0 ]; then
  if [ "$gate_rc" -eq 124 ]; then
    echo "4wd: TIMEOUT — gate exceeded ${CONFIG_GATE_TIMEOUT}s and was killed"
  fi
  echo "4wd: FAIL — gate exited $gate_rc, not pushing"
  exit 1
fi

# ── push or submit to merge queue ───────────────────────────────────────────
MERGED_SHA=""

case "$CONFIG_MERGE_MODE" in
  direct-push)
    echo "4wd: pushing $CURRENT_BRANCH to origin/main (mode=direct-push)"
    if ! git push origin "HEAD:main"; then
      echo "4wd: PUSH FAILED — non-fast-forward or branch protection rejected"
      echo "4wd: your branch is rebased locally; re-run /4wd:merge to retry"
      exit 1
    fi
    MERGED_SHA=$(git rev-parse HEAD)

    # Optional ratchet re-lock (direct-push only — see merge-queue notes below).
    ratchet_relock_if_changed "$ROOT" "$CONFIG_RATCHET_FILE" "$CONFIG_RATCHET_LOCK_COMMAND" "$CONFIG_RATCHET_COMMIT_MESSAGE"
    ;;

  merge-queue)
    if ! ghmq_preflight; then exit 1; fi

    echo "4wd: submitting $CURRENT_BRANCH via GitHub Merge Queue"
    if ! ghmq_push_feature_branch "$CURRENT_BRANCH"; then exit 1; fi

    pr_number=$(ghmq_open_or_reuse_pr "$CURRENT_BRANCH")
    if [ -z "$pr_number" ]; then
      echo "4wd: failed to open/find PR for $CURRENT_BRANCH" >&2
      exit 1
    fi
    echo "4wd: PR #$pr_number opened/reused"

    if ! ghmq_submit_to_queue "$pr_number"; then exit 1; fi

    if ! ghmq_poll_until_done "$pr_number" "$CONFIG_GHMQ_POLL_INTERVAL" "$CONFIG_GHMQ_TIMEOUT"; then
      exit 1
    fi

    # Fetch the post-merge SHA from origin.
    git fetch origin main >/dev/null 2>&1
    MERGED_SHA=$(git rev-parse origin/main)

    # Ratchet relock is INTENTIONALLY SKIPPED in merge-queue mode.
    # The GHA merge-queue workflow has its own ratchet step that opens a
    # follow-up PR rather than pushing direct to main (which would defeat
    # the queue). See examples/github-actions/merge-queue.yml.
    if [ -n "$CONFIG_RATCHET_LOCK_COMMAND" ]; then
      echo "4wd: ratchet relock skipped in merge-queue mode (GHA workflow owns it)"
    fi
    ;;
esac

# ── log + done ──────────────────────────────────────────────────────────────
LOG_DIR="${CLAUDE_PLUGIN_DATA:-$ROOT/.4wd-data}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/merge-log.jsonl"
printf '{"ts":"%s","branch":"%s","sha":"%s","gate_seconds":%s,"result":"MERGED"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CURRENT_BRANCH" "$MERGED_SHA" "$GATE_ELAPSED" >> "$LOG"

echo "4wd: MERGED  $MERGED_SHA  $CURRENT_BRANCH  (gate ${GATE_ELAPSED}s)"
exit 0
