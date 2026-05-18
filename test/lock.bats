#!/usr/bin/env bats
# test/lock.bats — lib/lock.sh contract.

load helpers/setup

setup() {
  setup_repo
  # shellcheck source=../lib/lock.sh
  . "$REPO_ROOT/lib/lock.sh"
  LOCK="$TMP_REPO/.4wd.lock"
}

teardown() {
  teardown_repo
}

@test "lock_acquire on empty dir → exits 0, creates stamp file" {
  run lock_acquire "$LOCK" "feature/x" 1800
  [ "$status" -eq 0 ]
  [ -d "$LOCK" ]
  [ -f "$LOCK/lock.json" ]
  run grep '"branch":"feature/x"' "$LOCK/lock.json"
  [ "$status" -eq 0 ]
}

@test "lock_acquire when live owner holds → exits 1" {
  # Stamp with our own PID so kill -0 succeeds and lock is "live".
  seed_lock "$LOCK" "$$" "feature/other" "$(now_epoch)"
  run lock_acquire "$LOCK" "feature/x" 1800
  [ "$status" -eq 1 ]
}

@test "lock_acquire reclaims stale lock (TTL exceeded) → exits 2" {
  # Use our PID so kill -0 succeeds but age is well past TTL.
  local stale_at
  stale_at=$(( $(now_epoch) - 7200 ))
  seed_lock "$LOCK" "$$" "feature/dead" "$stale_at"
  run lock_acquire "$LOCK" "feature/new" 1800
  [ "$status" -eq 2 ]
  run grep '"branch":"feature/new"' "$LOCK/lock.json"
  [ "$status" -eq 0 ]
}

@test "lock_acquire reclaims dead-PID lock regardless of age → exits 2" {
  # PID 1 exists on every Unix (init/launchd) so we use a guaranteed-dead PID.
  # Pick a very large PID that almost certainly isn't alive.
  seed_lock "$LOCK" "9999999" "feature/dead-owner" "$(now_epoch)"
  run lock_acquire "$LOCK" "feature/new" 1800
  [ "$status" -eq 2 ]
}

@test "lock_release removes dir" {
  lock_acquire "$LOCK" "feature/x" 1800
  [ -d "$LOCK" ]
  lock_release "$LOCK"
  [ ! -d "$LOCK" ]
}

@test "lock_state on empty → held=false" {
  run lock_state "$LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"held":false'* ]]
}

@test "lock_state on held → held=true with pid/branch" {
  lock_acquire "$LOCK" "feature/x" 1800
  run lock_state "$LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"held":true'* ]]
  [[ "$output" == *'"branch":"feature/x"'* ]]
}

@test "lock_state on half-initialised dir (no stamp file) → corrupt:true" {
  mkdir "$LOCK"
  run lock_state "$LOCK"
  [[ "$output" == *'"corrupt":true'* ]]
}

@test "lock_acquire on half-initialised dir → reclaims, exits 2" {
  mkdir "$LOCK"
  run lock_acquire "$LOCK" "feature/x" 1800
  [ "$status" -eq 2 ]
  [ -f "$LOCK/lock.json" ]
}
