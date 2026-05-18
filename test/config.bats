#!/usr/bin/env bats
# test/config.bats — lib/config.sh contract.

load helpers/setup

setup() {
  setup_repo
  # shellcheck source=../lib/config.sh
  . "$REPO_ROOT/lib/config.sh"
}

teardown() {
  teardown_repo
}

@test "config_load without .merge-agent.json → exits 1 with setup help" {
  run config_load "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no .merge-agent.json"* ]]
}

@test "config_load with invalid JSON → exits 1" {
  echo "{ not json" > "$TMP_REPO/.merge-agent.json"
  run config_load "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not valid JSON"* ]]
}

@test "config_load missing gate.command → exits 1" {
  write_config '{ "gate": {} }'
  run config_load "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"gate.command is required"* ]]
}

@test "config_load minimal valid config → exits 0, exports CONFIG_GATE_COMMAND" {
  write_config '{ "gate": { "command": "true" } }'
  config_load "$TMP_REPO"
  [ "$CONFIG_GATE_COMMAND" = "true" ]
  [ "$CONFIG_GATE_RUN_ON" = "local" ]
  [ "$CONFIG_GATE_TIMEOUT" = "900" ]
  [ "$CONFIG_BRANCH_PROTECTION" = "warn" ]
}

@test "config_load with runOn:ssh → exits 1 (deferred to v0.2)" {
  write_config '{ "gate": { "command": "true", "runOn": "ssh" } }'
  run config_load "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not supported in v0.1"* ]]
}

@test "config_load with disabled:true → exits 0, exports CONFIG_DISABLED=true" {
  write_config '{ "disabled": true, "gate": { "command": "true" } }'
  config_load "$TMP_REPO"
  [ "$CONFIG_DISABLED" = "true" ]
}

@test "config_load with ratchet block → exports CONFIG_RATCHET_FILE + LOCK_COMMAND" {
  write_config '{
    "gate": { "command": "true" },
    "ratchet": { "file": ".x.json", "lockCommand": "echo lock" }
  }'
  config_load "$TMP_REPO"
  [ "$CONFIG_RATCHET_FILE" = ".x.json" ]
  [ "$CONFIG_RATCHET_LOCK_COMMAND" = "echo lock" ]
}
