#!/usr/bin/env bash
# lib/ratchet.sh — optionally re-lock a ratchet file after a green gate.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/ratchet.sh"
#   ratchet_relock_if_changed "$repo_root" "$ratchet_file" "$lock_command" "$commit_message"
#
# Returns 0 on success (whether or not a change was committed). Logs progress.

set -u

ratchet_relock_if_changed() {
  local root="$1" file="$2" cmd="$3" msg="$4"

  if [ -z "$file" ] || [ -z "$cmd" ]; then
    return 0  # ratchet not configured
  fi

  if [ ! -f "$root/$file" ]; then
    echo "merge-agent: ratchet file not found at $file — skipping re-lock"
    return 0
  fi

  echo "merge-agent: running ratchet lock command: $cmd"
  ( cd "$root" && bash -c "$cmd" )
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "merge-agent: ratchet lock command exited $rc — non-blocking, continuing"
    return 0
  fi

  # Did the ratchet file change?
  if git -C "$root" diff --quiet -- "$file"; then
    echo "merge-agent: ratchet unchanged — no commit"
    return 0
  fi

  echo "merge-agent: ratchet improved — committing"
  git -C "$root" add -- "$file"
  git -C "$root" commit -m "$msg" >/dev/null || {
    echo "merge-agent: ratchet commit failed (non-blocking)"
    return 0
  }
  git -C "$root" push origin HEAD:main || {
    echo "merge-agent: ratchet push failed (non-blocking) — manual push may be needed"
    return 0
  }
  echo "merge-agent: ratchet update pushed"
  return 0
}
