# Node example

Drop-in `.4wd.json` for a Node/TypeScript project where the canonical gate is `npm test` (Jest, Vitest, Mocha — whatever your project uses).

## Assumes

- `package.json` at repo root with a `"test"` script.
- `scripts/check-ratchet.sh` exists and the project owns its own ratchet metric definitions (typescript errors, eslint warnings, jest test count, TODOs). 4wd's `/4wd:init` v0.4 will generate this for you.
- `merge.mode: "merge-queue"` — assumes GitHub Merge Queue is enabled on `main`. Drop this back to `direct-push` for repos without branch protection.

## To install

```bash
cp .4wd.json /path/to/your/project/.4wd.json
```

Then in that project:

```bash
claude plugin marketplace add WANDERCOLTD/4wd
claude plugin install 4wd
/4wd:status     # check it picks up the config
/4wd:merge      # try it on a feature branch
```
