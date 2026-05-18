#!/usr/bin/env bash
# bin/init.sh — bootstrap cma gate + ratchet into a project.
#
# Usage:
#   bash bin/init.sh <repo_root> [--stack node|python|shell] [--force] [--merge]
#                    [--dry-run] [--with-gha]
#
# By default emits 3 files at <repo_root>:
#   .merge-agent.json   (from examples/<stack>/.merge-agent.json)
#   .ratchet.json       (a starter file with null baselines)
#   scripts/check-ratchet.sh   (from examples/<stack>/check-ratchet.sh)
#
# Add --with-gha to also emit .github/workflows/cma-gate.yml.
#
# Exit codes:
#   0 — files written (or dry-run completed)
#   1 — refused due to file collision (use --force or --merge)
#   2 — invocation error / not a git repo / unknown stack

set -u

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="${1:-}"
[ -z "$ROOT" ] && { echo "cma init: repo root required as \$1" >&2; exit 2; }
shift

. "$PLUGIN_ROOT/lib/detect-stack.sh"

# ── parse flags ────────────────────────────────────────────────
STACK=""
FORCE=0
MERGE=0
DRY_RUN=0
WITH_GHA=0

while [ $# -gt 0 ]; do
  case "$1" in
    --stack)     STACK="${2:-}"; shift 2 ;;
    --stack=*)   STACK="${1#--stack=}"; shift ;;
    --force)     FORCE=1; shift ;;
    --merge)     MERGE=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    --with-gha)  WITH_GHA=1; shift ;;
    *)           echo "cma init: unknown flag: $1" >&2; exit 2 ;;
  esac
done

cd "$ROOT" || { echo "cma init: cannot cd to $ROOT" >&2; exit 2; }

# ── pre-flight ────────────────────────────────────────────────
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "cma init: not a git repository — run \`git init\` first" >&2
  exit 2
fi

# ── stack detection or override ───────────────────────────────
if [ -n "$STACK" ]; then
  if ! is_supported_stack "$STACK"; then
    echo "cma init: falling back to shell stack" >&2
    STACK="shell"
  fi
else
  STACK=$(detect_stack "$ROOT")
fi

EXAMPLE_DIR=$(stack_example_dir "$STACK")
if [ -z "$EXAMPLE_DIR" ] || [ ! -d "$PLUGIN_ROOT/examples/$EXAMPLE_DIR" ]; then
  echo "cma init: no template directory for stack '$STACK'" >&2
  exit 2
fi

echo "cma init: detected stack → $STACK"
echo "cma init: template source → examples/$EXAMPLE_DIR/"
[ "$DRY_RUN" = 1 ] && echo "cma init: DRY-RUN — no files will be written"

# ── plan ──────────────────────────────────────────────────────

# Detect non-GitHub origin (TL bear trap #6): GHA template suppressed entirely.
GHA_SUPPRESSED=0
if [ "$WITH_GHA" = 1 ]; then
  remote=$(git remote get-url origin 2>/dev/null || true)
  if [ -n "$remote" ] && ! echo "$remote" | grep -qE 'github\.com[:/]'; then
    echo "cma init: origin is not GitHub ($remote) — suppressing cma-gate.yml" >&2
    GHA_SUPPRESSED=1
  fi
fi

declare -a PLAN_SRC=()
declare -a PLAN_DST=()
declare -a PLAN_KIND=()  # "copy" or "starter" or "merge"

# Standard 3 files
PLAN_SRC+=("$PLUGIN_ROOT/examples/$EXAMPLE_DIR/.merge-agent.json")
PLAN_DST+=("$ROOT/.merge-agent.json")
PLAN_KIND+=("copy")

PLAN_SRC+=("__ratchet_starter__")
PLAN_DST+=("$ROOT/.ratchet.json")
PLAN_KIND+=("starter")

PLAN_SRC+=("$PLUGIN_ROOT/examples/$EXAMPLE_DIR/check-ratchet.sh")
PLAN_DST+=("$ROOT/scripts/check-ratchet.sh")
PLAN_KIND+=("copy")

if [ "$WITH_GHA" = 1 ] && [ "$GHA_SUPPRESSED" = 0 ]; then
  PLAN_SRC+=("$PLUGIN_ROOT/examples/$EXAMPLE_DIR/cma-gate.yml")
  PLAN_DST+=("$ROOT/.github/workflows/cma-gate.yml")
  PLAN_KIND+=("copy")
fi

# ── collision detection ──────────────────────────────────────
declare -a CONFLICTS=()
for i in "${!PLAN_DST[@]}"; do
  dst="${PLAN_DST[$i]}"
  if [ -e "$dst" ]; then
    if [ "$dst" = "$ROOT/.merge-agent.json" ] && [ "$MERGE" = 1 ]; then
      PLAN_KIND[i]="merge"
      continue
    fi
    # In --merge mode, leave non-merge-target files alone (don't overwrite,
    # don't error). Only --force does a blind overwrite of everything.
    if [ "$MERGE" = 1 ] && [ "$FORCE" != 1 ]; then
      PLAN_KIND[i]="skip"
      continue
    fi
    if [ "$FORCE" != 1 ]; then
      CONFLICTS+=("$dst")
    fi
  fi
done

if [ "${#CONFLICTS[@]}" -gt 0 ]; then
  echo "cma init: refusing to overwrite existing files:" >&2
  for c in "${CONFLICTS[@]}"; do echo "  - $c" >&2; done
  echo >&2
  echo "Re-run with --force to overwrite, or --merge to deep-merge .merge-agent.json." >&2
  exit 1
fi

# ── emit ──────────────────────────────────────────────────────

emit_starter_ratchet() {
  cat <<EOF
{
  "_note": "Starter — baselines null. Run \`bash scripts/check-ratchet.sh lock\` BEFORE your first commit to lock the canonical baseline. (Locking after first CI green is fine too, but you'll have one PR where the ratchet skips.)"
}
EOF
}

merge_merge_agent_json() {
  local src="$1" dst="$2"
  if ! command -v jq >/dev/null 2>&1; then
    echo "cma init: --merge requires jq on PATH" >&2; return 1
  fi
  local tmp
  tmp=$(mktemp)
  # Deep merge: existing wins on conflicts so user fields survive.
  jq -s '.[0] * .[1]' "$src" "$dst" > "$tmp"
  if [ "$DRY_RUN" = 1 ]; then
    echo "would write merged → $dst"
    diff -u "$dst" "$tmp" 2>/dev/null | head -40 | sed 's/^/    /'
  else
    mv "$tmp" "$dst"
    echo "merged → $dst"
  fi
  rm -f "$tmp"
}

for i in "${!PLAN_DST[@]}"; do
  src="${PLAN_SRC[$i]}"
  dst="${PLAN_DST[$i]}"
  kind="${PLAN_KIND[$i]}"

  case "$kind" in
    skip)
      echo "skipped → $dst (already exists; --merge mode leaves it alone)"
      ;;
    merge)
      merge_merge_agent_json "$src" "$dst"
      ;;
    copy)
      if [ "$DRY_RUN" = 1 ]; then
        echo "would write → $dst (from ${src#"$PLUGIN_ROOT"/})"
      else
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        [[ "$dst" == *.sh ]] && chmod +x "$dst"
        echo "wrote → $dst"
      fi
      ;;
    starter)
      if [ "$DRY_RUN" = 1 ]; then
        echo "would write starter → $dst"
      else
        mkdir -p "$(dirname "$dst")"
        emit_starter_ratchet > "$dst"
        echo "wrote starter → $dst"
      fi
      ;;
  esac
done

# .gitignore upkeep — add .merge-agent.lock if not present (TL bear trap #1).
if [ "$DRY_RUN" != 1 ]; then
  if [ -f "$ROOT/.gitignore" ]; then
    if ! grep -qxF '.merge-agent.lock' "$ROOT/.gitignore" && ! grep -qxF '.merge-agent.lock/' "$ROOT/.gitignore"; then
      echo '.merge-agent.lock/' >> "$ROOT/.gitignore"
      echo "appended → $ROOT/.gitignore (.merge-agent.lock/)"
    fi
  else
    echo '.merge-agent.lock/' > "$ROOT/.gitignore"
    echo "wrote → $ROOT/.gitignore"
  fi
fi

# ── next steps ────────────────────────────────────────────────
if [ "$DRY_RUN" = 1 ]; then
  echo
  echo "cma init: DRY-RUN complete — re-run without --dry-run to write files."
  exit 0
fi

echo
echo "Next steps:"
echo "  1. bash scripts/check-ratchet.sh lock      # lock the canonical baseline"
echo "  2. git add . && git commit -m 'chore: cma init'"
remote=$(git remote get-url origin 2>/dev/null || true)
if [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  echo "  3. Enable branch protection on main:"
  echo "       https://github.com/$owner/$repo/settings/branches"
fi
echo "  4. Install cma:  claude plugin marketplace add WANDERCOLTD/cma && claude plugin install cma"
echo "  5. Try it:       /cma:status   then /cma:merge from a feature branch"
