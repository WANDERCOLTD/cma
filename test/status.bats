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
  [[ "$output" == *"no/invalid .merge-agent.json"* ]]
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
  [[ "$output" == *"STATE: DISABLED via .merge-agent.json"* ]]
}

@test "status with CMA_DISABLE=1 → env var wins (DISABLED via env)" {
  write_config '{ "disabled": false, "gate": { "command": "npm test" } }'
  run env CMA_DISABLE=1 bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"DISABLED via CMA_DISABLE=1"* ]]
}

@test "status shows gate.command from config" {
  write_config '{ "gate": { "command": "bash run-my-thing.sh" } }'
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [[ "$output" == *"bash run-my-thing.sh"* ]]
}

@test "status shows lock_state:{held:false} when no lock present" {
  write_config '{ "gate": { "command": "true" } }'
  run bash "$REPO_ROOT/bin/merge-status.sh" "$TMP_REPO"
  [[ "$output" == *'"held":false'* ]]
}
