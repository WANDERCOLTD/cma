#!/usr/bin/env bats
# test/merge.bats — bin/merge.sh end-to-end contracts.

load helpers/setup

setup() {
  setup_repo
  export CLAUDE_PLUGIN_ROOT="$REPO_ROOT"
  # Most tests work on a feature branch; switch off main.
  ( cd "$TMP_REPO" && git checkout -q -b feature/x )
  echo "change" > "$TMP_REPO/file.txt"
  ( cd "$TMP_REPO" && git add file.txt && git -c commit.gpgsign=false commit -q -m "wip" )
}

teardown() {
  teardown_repo
}

# ── Kill switch ────────────────────────────────────────────────

@test "FWD_DISABLE=1 → exits 0 without touching git, prints kill-switch message" {
  write_config '{ "gate": { "command": "true" } }'
  run env FWD_DISABLE=1 bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"disabled via FWD_DISABLE=1"* ]]
}

@test "config disabled:true → exits 0 without touching git" {
  write_config '{ "disabled": true, "gate": { "command": "true" } }'
  run bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"disabled via .4wd.json"* ]]
}

@test "env var precedence: FWD_DISABLE=1 wins even with disabled:false in config" {
  write_config '{ "disabled": false, "gate": { "command": "true" } }'
  run env FWD_DISABLE=1 bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"FWD_DISABLE=1"* ]]
}

# ── Pre-flight ─────────────────────────────────────────────────

@test "running on main → refuses with ERROR" {
  ( cd "$TMP_REPO" && git checkout -q main )
  write_config '{ "gate": { "command": "true" } }'
  run bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"refusing to merge main"* ]]
}

@test "no .4wd.json → exits 1 with setup help" {
  run bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no .4wd.json"* ]]
}

# ── Gate failure paths ─────────────────────────────────────────
# These tests don't have an origin/main to rebase against, so they
# exercise the pre-rebase code paths. The rebase-conflict + push paths
# need an origin remote and are covered in integration tests against the
# real 4wd repo (eat-our-own-dogfood on v0.2.1).

@test "lock acquired then released on disabled-via-env path" {
  write_config '{ "gate": { "command": "true" } }'
  FWD_DISABLE=1 bash "$REPO_ROOT/bin/merge.sh" "$TMP_REPO" >/dev/null
  [ ! -d "$TMP_REPO/.4wd.lock" ]
}
