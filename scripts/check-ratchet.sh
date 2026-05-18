#!/usr/bin/env bash
# scripts/check-ratchet.sh — count-cap ratchet gate (ported from WANDERCOLTD/HF).
#
# Reads `.ratchet.json` at the repo root, measures three counts across the
# cma shell sources, and:
#   • fails if any count exceeds its baseline (ratchet up = forbidden)
#   • emits a "lock the win" hint if any count drops below baseline
#     (downward ratchet only via deliberate `lock` invocation)
#
# Metrics:
#   shellcheck_warnings — sum of shellcheck issues across bin/ + lib/ + scripts/
#   bats_tests          — count of `@test` lines across test/*.bats
#   todo_fixme_count    — TODO/FIXME comments across bin/ + lib/ + commands/
#
# Notes:
#   • Run lock on Linux (the GHA canonical platform) to set baseline. Mac and
#     Linux can produce different shellcheck counts due to bash version diffs.
#   • A measurement crash emits a warning and SKIPS that metric — never silently
#     records 0 which would falsely look like a huge improvement.
#   • A baseline of `null` means "not yet baselined" — metric is skipped with
#     a hint to run lock.
#
# Usage:
#   ./scripts/check-ratchet.sh         — measure + compare against baseline
#   ./scripts/check-ratchet.sh init    — write fresh `.ratchet.json` (refuses overwrite)
#   ./scripts/check-ratchet.sh lock    — overwrite `.ratchet.json` with current counts
#
# Exit codes:
#   0 — all metrics within baseline
#   1 — at least one metric exceeded baseline
#   2 — invocation error / measurement crash on init or lock

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$REPO_ROOT/.ratchet.json"

MODE="${1:-check}"

# ─── Measurement ────────────────────────────────────────────────

measure_shellcheck() {
  if ! command -v shellcheck >/dev/null 2>&1; then
    echo "WARN shellcheck not on PATH — skipping shellcheck_warnings" >&2
    echo "ERR"
    return
  fi
  local files count
  files=$(find "$REPO_ROOT/bin" "$REPO_ROOT/lib" "$REPO_ROOT/scripts" \
    -type f -name '*.sh' 2>/dev/null || true)
  if [ -z "$files" ]; then
    echo 0
    return
  fi
  # shellcheck disable=SC2086 # word splitting intentional for $files
  count=$(shellcheck -f gcc $files 2>&1 | grep -cE ': (note|warning|error):' || true)
  echo "${count:-0}"
}

measure_bats() {
  local count
  if [ ! -d "$REPO_ROOT/test" ]; then
    echo 0
    return
  fi
  # Exclude vendored bats-core/bats-assert/bats-support directories — they have
  # their own .bats files (their own self-tests) that aren't cma tests.
  count=$(find "$REPO_ROOT/test" -name '*.bats' -type f \
    -not -path "$REPO_ROOT/test/bats-core/*" \
    -not -path "$REPO_ROOT/test/bats-assert/*" \
    -not -path "$REPO_ROOT/test/bats-support/*" \
    -exec grep -hcE '^@test ' {} + 2>/dev/null \
    | awk '{s+=$1} END {print s+0}')
  echo "${count:-0}"
}

measure_todos() {
  local count
  count=$(grep -RhcE '\b(TODO|FIXME|XXX)\b' \
    "$REPO_ROOT/bin" "$REPO_ROOT/lib" "$REPO_ROOT/commands" \
    2>/dev/null | awk '{s+=$1} END {print s+0}')
  echo "${count:-0}"
}

# ─── Baseline I/O ───────────────────────────────────────────────

read_baseline() {
  if [ ! -f "$BASELINE_FILE" ]; then
    echo "ERROR baseline file not found: $BASELINE_FILE" >&2
    exit 2
  fi
  jq -r "$1 // empty" "$BASELINE_FILE"
}

write_baseline() {
  local sc bats todos
  sc=$(measure_shellcheck)
  bats=$(measure_bats)
  todos=$(measure_todos)

  for v in sc bats todos; do
    local val="${!v}"
    if [ "$val" = "ERR" ]; then
      echo "ERROR cannot lock — measurement for $v crashed" >&2
      exit 2
    fi
  done

  cat > "$BASELINE_FILE" <<EOF
{
  "shellcheck_warnings": $sc,
  "bats_tests": $bats,
  "todo_fixme_count": $todos,
  "_note": "Locked $(date -u +%Y-%m-%dT%H:%M:%SZ) on $(uname -s). Linux is canonical."
}
EOF
  echo "Baseline locked → shellcheck=$sc bats=$bats todos=$todos"
}

# ─── Dispatch ───────────────────────────────────────────────────

case "$MODE" in
  init)
    if [ -f "$BASELINE_FILE" ]; then
      echo "ERROR $BASELINE_FILE already exists. Use 'lock' to overwrite." >&2
      exit 2
    fi
    write_baseline
    ;;
  lock)
    write_baseline
    ;;
  check|"")
    sc=$(measure_shellcheck)
    bats=$(measure_bats)
    todos=$(measure_todos)

    base_sc=$(read_baseline .shellcheck_warnings)
    base_bats=$(read_baseline .bats_tests)
    base_todos=$(read_baseline .todo_fixme_count)

    fail=0
    win=0

    check_one() {
      local name="$1" current="$2" base="$3" direction="$4"
      if [ "$current" = "ERR" ]; then
        echo "  ⚠️  $name: measurement crashed — skipped"
        return
      fi
      if [ -z "$base" ] || [ "$base" = "null" ]; then
        echo "  ❓ $name: $current (no baseline — run \`./scripts/check-ratchet.sh lock\`)"
        return
      fi
      case "$direction" in
        up_bad)
          if [ "$current" -gt "$base" ]; then
            echo "  ❌ $name: $current (+$((current - base)) over baseline $base)"
            fail=1
          elif [ "$current" -lt "$base" ]; then
            echo "  ✨ $name: $current (-$((base - current)) under baseline $base — lock it!)"
            win=1
          else
            echo "  ✅ $name: $current (== baseline)"
          fi
          ;;
        down_bad)
          if [ "$current" -lt "$base" ]; then
            echo "  ❌ $name: $current ($((base - current)) under baseline $base)"
            fail=1
          elif [ "$current" -gt "$base" ]; then
            echo "  ✨ $name: $current (+$((current - base)) over baseline $base — lock it!)"
            win=1
          else
            echo "  ✅ $name: $current (== baseline)"
          fi
          ;;
      esac
    }

    echo "Ratchet check:"
    check_one "shellcheck_warnings" "$sc"    "$base_sc"    "up_bad"
    check_one "bats_tests"          "$bats"  "$base_bats"  "down_bad"
    check_one "todo_fixme_count"    "$todos" "$base_todos" "up_bad"

    if [ "$win" = 1 ]; then
      echo
      echo "Some metrics improved. Lock the win:"
      echo "  ./scripts/check-ratchet.sh lock"
    fi

    exit "$fail"
    ;;
  *)
    echo "Usage: $0 [check|init|lock]" >&2
    exit 2
    ;;
esac
