# test/helpers/setup.bash — shared test setup.
# Sourced by every *.bats file via `load`.

# Resolve repo root from the test file's location.
TEST_DIR="$(cd "$(dirname "${BATS_TEST_FILENAME}")" && pwd)"
REPO_ROOT="$(cd "$TEST_DIR/.." && pwd)"
export REPO_ROOT

# Load bats-assert + bats-support if available (CI installs them).
if [ -d "$REPO_ROOT/test/bats-support" ]; then
  load "$REPO_ROOT/test/bats-support/load.bash"
fi
if [ -d "$REPO_ROOT/test/bats-assert" ]; then
  load "$REPO_ROOT/test/bats-assert/load.bash"
fi

# Allocate a private tmp repo per test so they can run in parallel.
setup_repo() {
  TMP_REPO="$(mktemp -d -t cma-test-XXXXXX)"
  export TMP_REPO
  ( cd "$TMP_REPO" && \
    git init -q -b main && \
    git config user.email "test@cma" && \
    git config user.name  "cma test" && \
    echo "init" > README.md && \
    git add README.md && \
    git -c commit.gpgsign=false commit -q -m "init" )
}

teardown_repo() {
  if [ -n "${TMP_REPO:-}" ] && [ -d "$TMP_REPO" ]; then
    rm -rf "$TMP_REPO"
  fi
}

# Write a minimal .merge-agent.json in TMP_REPO with optional overrides.
# Usage: write_config '{ "gate": { "command": "true" } }'
write_config() {
  echo "$1" > "$TMP_REPO/.merge-agent.json"
}

# Compute portable epoch seconds (BSD and GNU both accept +%s).
now_epoch() { date +%s; }

# Force a lock dir on disk with a stamp file (for stale-recovery tests).
seed_lock() {
  local lock_dir="$1" pid="$2" branch="$3" acquired_at="$4"
  mkdir "$lock_dir"
  printf '{"pid":%s,"branch":"%s","acquired_at":%s}\n' "$pid" "$branch" "$acquired_at" \
    > "$lock_dir/lock.json"
}
