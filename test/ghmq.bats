#!/usr/bin/env bats
# test/ghmq.bats — lib/ghmq.sh preflight + helpers (no real GitHub calls).

load helpers/setup

setup() {
  setup_repo
  # shellcheck source=../lib/ghmq.sh
  . "$REPO_ROOT/lib/ghmq.sh"
  STUB_DIR="$(mktemp -d)"
  export PATH="$STUB_DIR:$PATH"
}

teardown() {
  teardown_repo
  rm -rf "$STUB_DIR"
}

# Helper: write a `gh` shim that prints $1 for --version and matches $2 for `auth status`.
stub_gh() {
  local version="$1" auth_status_rc="$2"
  cat > "$STUB_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$1" in
  --version) echo "gh version $version"; echo "https://github.com/cli/cli/releases/tag/v$version" ;;
  auth)      [ "\$2" = "status" ] && exit $auth_status_rc ;;
  *)         exit 0 ;;
esac
EOF
  chmod +x "$STUB_DIR/gh"
}

# Helper: remove gh shim → simulates gh not installed.
unstub_gh() {
  rm -f "$STUB_DIR/gh"
}

@test "ghmq_preflight without gh on PATH → exits 1 with install hint" {
  unstub_gh
  # Also block the real gh by clearing PATH back to a minimal sane set.
  run env -i PATH="$STUB_DIR:/usr/bin:/bin" bash -c ". $REPO_ROOT/lib/ghmq.sh && ghmq_preflight"
  [ "$status" -eq 1 ]
  [[ "$output" == *"gh CLI is required"* ]]
}

@test "ghmq_preflight with un-authenticated gh → exits 1 with login hint" {
  stub_gh "2.50.0" 1
  run ghmq_preflight
  [ "$status" -eq 1 ]
  [[ "$output" == *"not authenticated"* ]]
}

@test "ghmq_preflight with gh older than 2.46 → exits 1 with upgrade hint" {
  stub_gh "2.40.0" 0
  run ghmq_preflight
  [ "$status" -eq 1 ]
  [[ "$output" == *"too old for --merge-queue"* ]]
}

@test "ghmq_preflight with gh 2.46.0 → exits 0 (boundary version OK)" {
  stub_gh "2.46.0" 0
  run ghmq_preflight
  [ "$status" -eq 0 ]
}

@test "ghmq_preflight with gh 2.50.0 → exits 0" {
  stub_gh "2.50.0" 0
  run ghmq_preflight
  [ "$status" -eq 0 ]
}

@test "config_load with merge.mode merge-queue → exports CONFIG_MERGE_MODE" {
  . "$REPO_ROOT/lib/config.sh"
  write_config '{
    "gate": { "command": "true" },
    "merge": { "mode": "merge-queue" }
  }'
  config_load "$TMP_REPO"
  [ "$CONFIG_MERGE_MODE" = "merge-queue" ]
  [ "$CONFIG_GHMQ_POLL_INTERVAL" = "30" ]
  [ "$CONFIG_GHMQ_TIMEOUT" = "1800" ]
}

@test "config_load with merge.mode unknown → exits 1" {
  . "$REPO_ROOT/lib/config.sh"
  write_config '{ "gate": { "command": "true" }, "merge": { "mode": "fly-me-to-the-moon" } }'
  run config_load "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"unknown"* ]]
}

@test "config_load default merge.mode → direct-push" {
  . "$REPO_ROOT/lib/config.sh"
  write_config '{ "gate": { "command": "true" } }'
  config_load "$TMP_REPO"
  [ "$CONFIG_MERGE_MODE" = "direct-push" ]
}
