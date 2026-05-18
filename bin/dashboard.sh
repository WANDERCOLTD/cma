#!/usr/bin/env bash
# bin/dashboard.sh — open the cma web dashboard in the default browser,
# scoped to the current repo via ?repo=<owner>/<repo>.
#
# If a GitHub token is discoverable on this machine (gh auth token, or the
# GITHUB_TOKEN / GH_TOKEN env vars), it's appended as #token=<value>. The
# dashboard consumes the hash on load, stashes the token in sessionStorage,
# then rewrites the URL to scrub it from the address bar.

set -u
ROOT="${1:?repo root required as \$1}"

DEFAULT_URL="https://cma-dashboard-eight.vercel.app"

cd "$ROOT" || { echo "cma: cannot cd to $ROOT" >&2; exit 1; }

# Resolve the dashboard URL: per-repo override in .merge-agent.json or default.
URL="$DEFAULT_URL"
if [ -f "$ROOT/.merge-agent.json" ] && command -v jq >/dev/null 2>&1; then
  override=$(jq -r '.dashboard.url // empty' "$ROOT/.merge-agent.json" 2>/dev/null || true)
  if [ -n "$override" ]; then
    URL="$override"
  fi
fi

remote=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$remote" ]; then
  echo "cma: no 'origin' remote — cannot determine repo for the dashboard." >&2
  exit 1
fi

# Parse github.com:<owner>/<repo>(.git) — accepts SSH (git@github.com:o/r.git)
# and HTTPS (https://github.com/o/r.git) forms.
if [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
else
  echo "cma: 'origin' is not a github.com URL ($remote) — dashboard expects GitHub." >&2
  exit 1
fi

# Best-effort token discovery — silent if unavailable.
token=""
if [ -n "${GITHUB_TOKEN:-}" ]; then
  token="$GITHUB_TOKEN"
elif [ -n "${GH_TOKEN:-}" ]; then
  token="$GH_TOKEN"
elif command -v gh >/dev/null 2>&1; then
  token=$(gh auth token 2>/dev/null || true)
fi

target="$URL/?repo=$owner/$repo"
if [ -n "$token" ]; then
  target="$target#token=$token"
  echo "cma: opening dashboard → $URL/?repo=$owner/$repo (with token)"
else
  echo "cma: opening dashboard → $target"
  echo "cma: no GitHub token detected — dashboard will start in public mode."
  echo "cma: set GITHUB_TOKEN, GH_TOKEN, or run 'gh auth login' for full access."
fi

# Cross-platform browser open.
if command -v open >/dev/null 2>&1; then
  open "$target"               # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$target"           # Linux
elif command -v start >/dev/null 2>&1; then
  start "$target"              # Windows (Git Bash)
else
  echo "cma: no browser-open command found. Visit manually: $target" >&2
fi
