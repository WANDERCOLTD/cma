#!/usr/bin/env bash
# lib/lock.sh — atomic mkdir-based merge lock with PID stamping + stale recovery.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/lock.sh"
#   lock_acquire "$lock_dir" "$branch" "$ttl_seconds"   # exits non-zero if held (and not stale)
#   lock_release "$lock_dir"
#   lock_state   "$lock_dir"                            # echoes JSON describing state
#
# Atomicity: mkdir is POSIX-atomic on local filesystems.
# Stale detection: kill -0 <pid> + age >= ttl.

set -u

# --- lock_acquire <lock_dir> <branch> <ttl_seconds> -------------------------
# Exit 0 on acquire, 1 if held by a live owner, 2 if held by stale owner that
# we reclaimed (caller may want to warn).
lock_acquire() {
  local dir="$1" branch="$2" ttl="$3"
  local stamp_file="$dir/lock.json"

  if mkdir "$dir" 2>/dev/null; then
    _lock_write_stamp "$stamp_file" "$branch"
    return 0
  fi

  # Lock dir exists. Inspect.
  if [ ! -f "$stamp_file" ]; then
    # Half-initialised — treat as stale.
    rm -rf "$dir"
    mkdir "$dir" || return 1
    _lock_write_stamp "$stamp_file" "$branch"
    return 2
  fi

  local owner_pid owner_at now age
  owner_pid=$(_lock_field "$stamp_file" pid)
  owner_at=$(_lock_field "$stamp_file" acquired_at)
  now=$(date +%s)
  age=$(( now - owner_at ))

  # Live owner?
  if [ -n "$owner_pid" ] && kill -0 "$owner_pid" 2>/dev/null; then
    if [ "$age" -lt "$ttl" ]; then
      return 1
    fi
  fi

  # Stale — reclaim.
  rm -rf "$dir"
  mkdir "$dir" || return 1
  _lock_write_stamp "$stamp_file" "$branch"
  return 2
}

lock_release() {
  local dir="$1"
  rm -rf "$dir"
}

# Echo JSON: { held: bool, pid, branch, acquired_at, age_seconds }
lock_state() {
  local dir="$1"
  local stamp_file="$dir/lock.json"
  if [ ! -d "$dir" ]; then
    printf '{"held":false}\n'
    return
  fi
  if [ ! -f "$stamp_file" ]; then
    printf '{"held":true,"corrupt":true}\n'
    return
  fi
  local pid branch acquired_at now age live
  pid=$(_lock_field "$stamp_file" pid)
  branch=$(_lock_field "$stamp_file" branch)
  acquired_at=$(_lock_field "$stamp_file" acquired_at)
  now=$(date +%s)
  age=$(( now - acquired_at ))
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then live="true"; else live="false"; fi
  printf '{"held":true,"pid":%s,"branch":"%s","acquired_at":%s,"age_seconds":%s,"pid_alive":%s}\n' \
    "${pid:-0}" "$branch" "${acquired_at:-0}" "$age" "$live"
}

# --- helpers ----------------------------------------------------------------

_lock_write_stamp() {
  local stamp_file="$1" branch="$2"
  printf '{"pid":%s,"branch":"%s","acquired_at":%s}\n' \
    "$$" "$branch" "$(date +%s)" > "$stamp_file"
}

_lock_field() {
  # Read a single field from a tiny well-known JSON shape.
  # Avoids depending on jq for the lock itself.
  local file="$1" key="$2"
  sed -n "s/.*\"$key\":\([^,}]*\).*/\1/p" "$file" | tr -d '" '
}
