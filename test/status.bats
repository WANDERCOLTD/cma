#!/usr/bin/env bats
# test/status.bats — bin/merge-status.sh output contract.

load helpers/setup

setup() {
  setup_repo
  export CLAUDE_PLUGIN_ROOT="$REPO_ROOT"
}

teardown() {
  teardown_repo
}

@test "status with no config → exits 1 with setup hint" {
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no/invalid .4wd.json"* ]]
}

@test "status with enabled config → STATE: ENABLED" {
  write_config '{ "gate": { "command": "npm test" } }'
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"STATE: ENABLED"* ]]
}

@test "status with disabled:true → STATE: DISABLED via config" {
  write_config '{ "disabled": true, "gate": { "command": "npm test" } }'
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"STATE: DISABLED via .4wd.json"* ]]
}

@test "status with FWD_DISABLE=1 → env var wins (DISABLED via env)" {
  write_config '{ "disabled": false, "gate": { "command": "npm test" } }'
  run env FWD_DISABLE=1 bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"DISABLED via FWD_DISABLE=1"* ]]
}

@test "status shows gate.command from config" {
  write_config '{ "gate": { "command": "bash run-my-thing.sh" } }'
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [[ "$output" == *"bash run-my-thing.sh"* ]]
}

@test "status shows IDLE when no lock present" {
  write_config '{ "gate": { "command": "true" } }'
  run env NO_COLOR=1 bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [[ "$output" == *"IDLE"* ]]
}

@test "status shows held banner when lock present" {
  . "$REPO_ROOT/lib/lock.sh"
  write_config '{ "gate": { "command": "true" } }'
  seed_lock "$TMP_REPO/.4wd.lock" "$$" "feat/x" "$(now_epoch)"
  run env NO_COLOR=1 bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [[ "$output" == *"HELD"* ]]
  [[ "$output" == *"feat/x"* ]]
}
