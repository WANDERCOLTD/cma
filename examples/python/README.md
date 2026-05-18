# Python example

Drop-in `.4wd.json` for a Python project where the canonical gate is `pytest -q` (or whatever your project runs).

## Assumes

- `pyproject.toml` or `requirements.txt` at repo root with pytest installed.
- `scripts/check-ratchet.sh` exists and the project owns its own ratchet metric definitions (mypy errors OR ruff warnings, pytest collected test count, TODOs). 4wd's `/4wd:init` v0.4 will generate this for you.
- `merge.mode: "merge-queue"` — assumes GitHub Merge Queue is enabled on `main`. Drop to `direct-push` for repos without branch protection.

## Suggested ratchet metrics (for the `scripts/check-ratchet.sh` you'll author)

| Metric | Source | Direction |
|--------|--------|-----------|
| `mypy_errors` | `mypy --strict 2>&1 \| grep -c '^.*: error:'` | up-bad |
| `pytest_tests` | `pytest --collect-only -q 2>/dev/null \| tail -1 \| grep -oE '^[0-9]+'` | down-bad |
| `todo_fixme_count` | `grep -rhcE '\\b(TODO\|FIXME\|XXX)\\b' src/ tests/` | up-bad |

Adapt for your stack — these are starters.

## To install

```bash
cp .4wd.json /path/to/your/project/.4wd.json
```

Then in that project:

```bash
claude plugin marketplace add WANDERCOLTD/4wd
claude plugin install 4wd
/4wd:status
/4wd:merge
```
