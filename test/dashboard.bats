#!/usr/bin/env bats
# test/dashboard.bats — bin/dashboard.sh URL composition + remote parsing.

load helpers/setup

setup() {
  setup_repo
  STUB_DIR="$(mktemp -d)"
  export PATH="$STUB_DIR:$PATH"
  # Stub `open` / `xdg-open` so the test doesn't actually launch a browser.
  cat > "$STUB_DIR/open" <<'SH'
#!/usr/bin/env bash
echo "OPEN $*"
SH
  chmod +x "$STUB_DIR/open"
}

teardown() {
  teardown_repo
  rm -rf "$STUB_DIR"
}

@test "dashboard.sh refuses when no origin remote" {
  run bash "$REPO_ROOT/bin/dashboard.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no 'origin' remote"* ]]
}

@test "dashboard.sh refuses non-GitHub origin" {
  ( cd "$TMP_REPO" && git remote add origin git@gitlab.com:user/repo.git )
  run bash "$REPO_ROOT/bin/dashboard.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not a github.com URL"* ]]
}

@test "dashboard.sh composes URL from SSH origin" {
  ( cd "$TMP_REPO" && git remote add origin git@github.com:WANDERCOLTD/4wd.git )
  run bash "$REPO_ROOT/bin/dashboard.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"?repo=WANDERCOLTD/4wd"* ]]
}

@test "dashboard.sh composes URL from HTTPS origin" {
  ( cd "$TMP_REPO" && git remote add origin https://github.com/foo/bar.git )
  run bash "$REPO_ROOT/bin/dashboard.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"?repo=foo/bar"* ]]
}

@test "dashboard.sh honours dashboard.url override in .4wd.json" {
  ( cd "$TMP_REPO" && git remote add origin git@github.com:foo/bar.git )
  write_config '{ "gate": { "command": "true" }, "dashboard": { "url": "https://my-4wd.example.com" } }'
  run bash "$REPO_ROOT/bin/dashboard.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [[ "$output" == *"https://my-4wd.example.com/?repo=foo/bar"* ]]
}
