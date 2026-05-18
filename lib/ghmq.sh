#!/usr/bin/env bash
# lib/ghmq.sh — GitHub Merge Queue submission helpers.
#
# Used when .4wd.json has `merge.mode: "merge-queue"`. Pushes the
# rebased feature branch, opens a PR, submits to the merge queue, and polls
# until merge or failure.
#
# Required tools: gh CLI >= 2.46.0 (when --merge-queue flag landed).

set -u

# Minimum gh CLI version that supports `gh pr merge --merge-queue`.
GHMQ_GH_MIN_MAJOR=2
GHMQ_GH_MIN_MINOR=46

# ghmq_preflight — verify gh is installed, authenticated, and recent enough.
# Exits non-zero with a clear message on any failure.
ghmq_preflight() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "4wd: gh CLI is required for merge.mode=\"merge-queue\" but is not on PATH." >&2
    echo "  Install: https://cli.github.com/" >&2
    return 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "4wd: gh CLI is not authenticated. Run \`gh auth login\` and retry." >&2
    return 1
  fi

  local version major minor
  version=$(gh --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -z "$version" ]; then
    echo "4wd: could not parse gh version. Update to >= ${GHMQ_GH_MIN_MAJOR}.${GHMQ_GH_MIN_MINOR}." >&2
    return 1
  fi
  major=$(echo "$version" | cut -d. -f1)
  minor=$(echo "$version" | cut -d. -f2)
  if [ "$major" -lt "$GHMQ_GH_MIN_MAJOR" ] || \
     { [ "$major" -eq "$GHMQ_GH_MIN_MAJOR" ] && [ "$minor" -lt "$GHMQ_GH_MIN_MINOR" ]; }; then
    echo "4wd: gh $version is too old for --merge-queue (need >= ${GHMQ_GH_MIN_MAJOR}.${GHMQ_GH_MIN_MINOR})." >&2
    echo "  Upgrade: brew upgrade gh  (or your platform's equivalent)" >&2
    return 1
  fi

  return 0
}

# ghmq_push_feature_branch — push the rebased local branch to origin.
# Uses --force-with-lease since the local rebase may have rewritten history
# that exists on origin (previous push). --force-with-lease is safer than
# --force: it refuses if origin has new commits we don't have locally.
ghmq_push_feature_branch() {
  local branch="$1"
  echo "4wd: pushing $branch to origin with --force-with-lease"
  if ! git push --force-with-lease origin "$branch"; then
    echo "4wd: PUSH FAILED — origin has commits you don't. Re-fetch and re-run /4wd:merge." >&2
    return 1
  fi
  return 0
}

# ghmq_open_or_reuse_pr — open a PR from $branch into main, or reuse an existing one.
# Echoes the PR number on success.
ghmq_open_or_reuse_pr() {
  local branch="$1" title body
  local existing

  # If a PR already exists for this branch, reuse it.
  existing=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number' 2>/dev/null || true)
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    echo "$existing"
    return 0
  fi

  # Default title from the latest commit subject. Body = the commit body or a placeholder.
  title=$(git log -1 --pretty=%s)
  body=$(git log -1 --pretty=%b)
  if [ -z "$body" ]; then
    body="Submitted by 4wd via \`/4wd:merge\`."
  fi

  local pr_url pr_number
  pr_url=$(gh pr create --base main --head "$branch" --title "$title" --body "$body" 2>&1 | tail -1)
  if [ -z "$pr_url" ]; then
    echo "4wd: gh pr create produced no URL — failing." >&2
    return 1
  fi
  pr_number=$(echo "$pr_url" | grep -oE '/pull/[0-9]+' | grep -oE '[0-9]+')
  if [ -z "$pr_number" ]; then
    echo "4wd: could not parse PR number from: $pr_url" >&2
    return 1
  fi
  echo "$pr_number"
}

# ghmq_submit_to_queue — add a PR to the merge queue.
ghmq_submit_to_queue() {
  local pr="$1"
  echo "4wd: submitting PR #$pr to merge queue"
  if ! gh pr merge "$pr" --merge-queue 2>&1; then
    echo "4wd: gh pr merge --merge-queue failed for PR #$pr" >&2
    return 1
  fi
  return 0
}

# ghmq_poll_until_done — wait for a PR to leave the queue.
# Args: pr_number, poll_interval_seconds, timeout_seconds.
# Echoes the final state and exits 0 on MERGED, 1 on anything else.
ghmq_poll_until_done() {
  local pr="$1" interval="$2" timeout="$3"
  local start now elapsed state
  start=$(date +%s)

  while :; do
    now=$(date +%s)
    elapsed=$(( now - start ))
    if [ "$elapsed" -gt "$timeout" ]; then
      echo "4wd: TIMEOUT waiting for PR #$pr after ${elapsed}s" >&2
      return 1
    fi

    # mergeStateStatus possible values: CLEAN, DIRTY, BLOCKED, BEHIND, UNSTABLE,
    # UNKNOWN, DRAFT, HAS_HOOKS. state: OPEN, CLOSED, MERGED.
    state=$(gh pr view "$pr" --json state,mergeStateStatus 2>/dev/null | \
            jq -r '"\(.state)/\(.mergeStateStatus)"')

    case "$state" in
      MERGED/*)
        echo "4wd: PR #$pr MERGED via queue (after ${elapsed}s)"
        return 0
        ;;
      CLOSED/*)
        echo "4wd: PR #$pr was CLOSED without merge" >&2
        return 1
        ;;
      OPEN/CLEAN|OPEN/UNSTABLE|OPEN/UNKNOWN|OPEN/HAS_HOOKS)
        # Still in queue or being processed.
        printf "4wd: PR #$pr in queue (state=%s elapsed=%ss)\r" "$state" "$elapsed"
        ;;
      OPEN/BLOCKED|OPEN/DIRTY|OPEN/BEHIND)
        echo "4wd: PR #$pr blocked or dirty (state=$state). Check the PR in GitHub." >&2
        return 1
        ;;
      *)
        echo "4wd: PR #$pr unknown state=$state — continuing to poll" >&2
        ;;
    esac

    sleep "$interval"
  done
}
