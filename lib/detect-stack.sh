#!/usr/bin/env bash
# lib/detect-stack.sh — pick the right cma stack template for a project.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/detect-stack.sh"
#   stack=$(detect_stack "$repo_root")
#
# Detects:
#   node    — package.json with a "scripts.test" entry (or simply a package.json
#             when no Python marker is present)
#   python  — pyproject.toml or requirements.txt (beats package.json unless
#             package.json declares a test script — see TL bear trap #4)
#   shell   — fallback when none of the above are present
#
# Stacks deferred to v0.4.x (returns "shell" today):
#   rust    — Cargo.toml
#   go      — go.mod
#   ruby    — Gemfile
#   jvm     — pom.xml / build.gradle*

set -u

detect_stack() {
  local root="$1"

  local has_node=0 has_node_test=0 has_python=0
  [ -f "$root/package.json" ] && has_node=1
  if [ "$has_node" = 1 ] && command -v jq >/dev/null 2>&1; then
    if jq -e '.scripts.test // empty' "$root/package.json" >/dev/null 2>&1; then
      has_node_test=1
    fi
  fi
  { [ -f "$root/pyproject.toml" ] || [ -f "$root/requirements.txt" ]; } && has_python=1

  # Disambiguation: Python beats Node UNLESS package.json has a test script
  # (avoids treating a Jupyter-extension package.json as the canonical stack).
  if [ "$has_python" = 1 ] && [ "$has_node_test" != 1 ]; then
    echo "python"
    return 0
  fi

  if [ "$has_node" = 1 ]; then
    echo "node"
    return 0
  fi

  echo "shell"
}

# Map a stack name to the example directory it draws from.
stack_example_dir() {
  case "$1" in
    node)   echo "node" ;;
    python) echo "python" ;;
    shell)  echo "minimal" ;;
    *)      echo "" ;;
  esac
}

# Validate a user-supplied --stack override.
is_supported_stack() {
  case "$1" in
    node|python|shell) return 0 ;;
    rust|go|ruby|jvm)
      echo "cma init: --stack=$1 is recognised but not implemented in v0.4 — defaults to shell." >&2
      return 1
      ;;
    *)
      echo "cma init: --stack=$1 is not a known stack. Supported: node, python, shell." >&2
      return 1
      ;;
  esac
}
