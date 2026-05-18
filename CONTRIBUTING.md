# Contributing to cma

Thanks for the interest. cma is small but disciplined — a few conventions keep it that way.

## Quick setup

```bash
git clone git@github.com:WANDERCOLTD/cma.git
cd cma
git config core.hooksPath .githooks    # activate commit-msg + future hooks

# Vendor BATS (one-time)
git clone --depth 1 https://github.com/bats-core/bats-core.git   test/bats-core
git clone --depth 1 https://github.com/bats-core/bats-assert.git test/bats-assert
git clone --depth 1 https://github.com/bats-core/bats-support.git test/bats-support

# Run the suite
test/bats-core/bin/bats test/*.bats

# Ratchet gate (needs shellcheck + jq on PATH)
bash scripts/check-ratchet.sh
```

## Engineering discipline (the four rules)

1. **One concern per commit.** The `.githooks/commit-msg` hook will reject multi-subsystem subjects. Bypass with `--no-verify` only if you've thought about why. Examples that pass:
   - `feat(ghmq): add poll timeout config`
   - `test: cover stale-lock reclaim`
   - `docs: clarify merge-queue ratchet behaviour`

   Examples that fail (and the hook will tell you):
   - `feat: add ghmq mode + test + docs`  — three concerns. Split.

2. **Ratchet locks the win.** `.ratchet.json` tracks three counts:
   - `shellcheck_warnings` (up-bad; baseline 0)
   - `bats_tests` (down-bad; baseline 42 today)
   - `todo_fixme_count` (up-bad; baseline 0)

   If your PR adds tests, bump `bats_tests` upward. If you remove tests, justify it.

3. **Tests come with features.** Anything new in `bin/` or `lib/` gets a matching `test/*.bats` file. Use `bats-mock` patterns for tools that hit the network (gh, ssh, gcloud).

4. **CI is canonical.** GHA runs on `ubuntu-latest` + `macos-latest`. Local greens that fail in CI usually mean BSD vs GNU tool differences (`date`, `sed`, `mktemp`). Test on both if you can; CI is the final word.

## File layout

```
.claude-plugin/plugin.json         # plugin manifest
commands/                          # slash command markdown (frontmatter + body)
hooks/hooks.json                   # SessionStart hook
bin/                               # entry-point shell scripts
lib/                               # sourced helper modules
scripts/                           # CI helpers (ratchet)
schema/                            # JSON schema for .merge-agent.json
examples/                          # minimal / hf / github-actions
test/                              # BATS suite (test/bats-* are vendored)
web/                               # Vite + React dashboard (v0.3)
.githooks/                         # commit-msg + future client hooks
.github/workflows/                 # CI
```

## Adding a slash command

1. Create `commands/<name>.md` with frontmatter:
   ```
   ---
   name: <short-name>
   description: <one-line>
   ---
   ```
2. Body explains the command, ending with a "How to execute" block that calls a `bin/<name>.sh` script with `${CLAUDE_PLUGIN_ROOT}`.
3. Create `bin/<name>.sh` — `set -u`, sources `lib/`, exits clean codes.
4. Add `test/<name>.bats` covering happy path + at least one failure path.
5. Run the suite, lock the ratchet, commit.

## Releasing

Tags follow semver (`vX.Y.Z`). On a release:

```bash
# Bump version in .claude-plugin/plugin.json
git commit -m "chore: bump version to X.Y.Z"
git push
git tag -a vX.Y.Z -m "vX.Y.Z — <subject>"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "..." --notes "..."
```

## Asking questions / filing issues

- **Bug or feature request:** open an issue at https://github.com/WANDERCOLTD/cma/issues — include your `.merge-agent.json`, the `/cma:status` output, and the failing command's stderr if relevant.
- **Security:** email instead of opening a public issue.

## License

MIT — see [LICENSE](./LICENSE).
