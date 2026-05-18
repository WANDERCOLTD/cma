#!/usr/bin/env bats
# test/init.bats — bin/init.sh + lib/detect-stack.sh contracts.

load helpers/setup

setup() {
  setup_repo
  export CLAUDE_PLUGIN_ROOT="$REPO_ROOT"
}

teardown() {
  teardown_repo
}

# ── detect_stack ───────────────────────────────────────────────

@test "detect_stack: empty repo → shell" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  run detect_stack "$TMP_REPO"
  [ "$status" -eq 0 ]
  [ "$output" = "shell" ]
}

@test "detect_stack: package.json present → node" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  echo '{"name":"x","scripts":{"test":"jest"}}' > "$TMP_REPO/package.json"
  run detect_stack "$TMP_REPO"
  [ "$output" = "node" ]
}

@test "detect_stack: pyproject.toml present → python" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  echo '[project]' > "$TMP_REPO/pyproject.toml"
  run detect_stack "$TMP_REPO"
  [ "$output" = "python" ]
}

@test "detect_stack: requirements.txt present → python" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  echo 'pytest' > "$TMP_REPO/requirements.txt"
  run detect_stack "$TMP_REPO"
  [ "$output" = "python" ]
}

@test "detect_stack: both package.json (no test) and pyproject.toml → python wins" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  echo '{"name":"jupyter-ext"}' > "$TMP_REPO/package.json"  # no scripts.test
  echo '[project]' > "$TMP_REPO/pyproject.toml"
  run detect_stack "$TMP_REPO"
  [ "$output" = "python" ]
}

@test "detect_stack: package.json with test script + pyproject.toml → node wins" {
  . "$REPO_ROOT/lib/detect-stack.sh"
  echo '{"name":"x","scripts":{"test":"vitest"}}' > "$TMP_REPO/package.json"
  echo '[project]' > "$TMP_REPO/pyproject.toml"
  run detect_stack "$TMP_REPO"
  [ "$output" = "node" ]
}

# ── /cma:init pre-flight ───────────────────────────────────────

@test "init: refuses on non-git directory" {
  local dir
  dir=$(mktemp -d)
  run bash "$REPO_ROOT/bin/init.sh" "$dir"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not a git repository"* ]]
  rm -rf "$dir"
}

@test "init: refuses unknown stack" {
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --stack=cobol
  [[ "$output" == *"not a known stack"* ]] || [[ "$output" == *"falling back to shell"* ]]
}

# ── dry-run + writes ──────────────────────────────────────────

@test "init: --dry-run writes nothing" {
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRY-RUN"* ]]
  [ ! -f "$TMP_REPO/.merge-agent.json" ]
  [ ! -f "$TMP_REPO/.ratchet.json" ]
  [ ! -f "$TMP_REPO/scripts/check-ratchet.sh" ]
}

@test "init: shell-stack repo writes 3 files" {
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO"
  [ "$status" -eq 0 ]
  [ -f "$TMP_REPO/.merge-agent.json" ]
  [ -f "$TMP_REPO/.ratchet.json" ]
  [ -f "$TMP_REPO/scripts/check-ratchet.sh" ]
  [ ! -f "$TMP_REPO/.github/workflows/cma-gate.yml" ]
}

@test "init: --with-gha also writes cma-gate.yml" {
  ( cd "$TMP_REPO" && git remote add origin git@github.com:foo/bar.git )
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --with-gha
  [ "$status" -eq 0 ]
  [ -f "$TMP_REPO/.github/workflows/cma-gate.yml" ]
}

@test "init: --with-gha on non-GitHub origin suppresses cma-gate.yml" {
  ( cd "$TMP_REPO" && git remote add origin git@gitlab.com:foo/bar.git )
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --with-gha
  [ "$status" -eq 0 ]
  [[ "$output" == *"not GitHub"* ]]
  [ ! -f "$TMP_REPO/.github/workflows/cma-gate.yml" ]
}

@test "init: refuses to overwrite without --force" {
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO"
  [ "$status" -eq 1 ]
  [[ "$output" == *"refusing to overwrite"* ]]
}

@test "init: --force overwrites" {
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  echo '{"gate":{"command":"custom"}}' > "$TMP_REPO/.merge-agent.json"
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --force
  [ "$status" -eq 0 ]
  # File was overwritten with the template content (no "custom")
  ! grep -q '"command":"custom"' "$TMP_REPO/.merge-agent.json"
}

@test "init: --merge preserves user fields in .merge-agent.json" {
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  # User adds a custom field after init
  jq '. + {"myCustom":"keepme"}' "$TMP_REPO/.merge-agent.json" > "$TMP_REPO/.merge-agent.json.tmp"
  mv "$TMP_REPO/.merge-agent.json.tmp" "$TMP_REPO/.merge-agent.json"
  # Re-run with --merge; custom field must survive
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --merge
  [ "$status" -eq 0 ]
  run jq -r '.myCustom' "$TMP_REPO/.merge-agent.json"
  [ "$output" = "keepme" ]
}

@test "init: appends .merge-agent.lock/ to .gitignore" {
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  grep -qxF '.merge-agent.lock/' "$TMP_REPO/.gitignore"
}

@test "init: does not duplicate .merge-agent.lock entry on re-run" {
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" --force >/dev/null
  local count
  count=$(grep -c '^\.merge-agent\.lock' "$TMP_REPO/.gitignore" || true)
  [ "$count" -eq 1 ]
}

@test "init: next steps include branch-protection URL for github origin" {
  ( cd "$TMP_REPO" && git remote add origin git@github.com:WANDERCOLTD/example.git )
  run bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO"
  [[ "$output" == *"github.com/WANDERCOLTD/example/settings/branches"* ]]
}

@test "init: detects node stack and emits npm test in .merge-agent.json" {
  echo '{"name":"x","scripts":{"test":"jest"}}' > "$TMP_REPO/package.json"
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  run jq -r '.gate.command' "$TMP_REPO/.merge-agent.json"
  [ "$output" = "npm test" ]
}

@test "init: detects python stack and emits pytest in .merge-agent.json" {
  echo '[project]' > "$TMP_REPO/pyproject.toml"
  bash "$REPO_ROOT/bin/init.sh" "$TMP_REPO" >/dev/null
  run jq -r '.gate.command' "$TMP_REPO/.merge-agent.json"
  [ "$output" = "pytest -q" ]
}
