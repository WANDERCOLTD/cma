# Node example

Drop-in `.merge-agent.json` for a Node/TypeScript project where the canonical gate is `npm test` (Jest, Vitest, Mocha — whatever your project uses).

## Assumes

- `package.json` at repo root with a `"test"` script.
- `scripts/check-ratchet.sh` exists and the project owns its own ratchet metric definitions (typescript errors, eslint warnings, jest test count, TODOs). cma's `/cma:init` v0.4 will generate this for you.
- `merge.mode: "merge-queue"` — assumes GitHub Merge Queue is enabled on `main`. Drop this back to `direct-push` for repos without branch protection.

## To install

```bash
cp .merge-agent.json /path/to/your/project/.merge-agent.json
```

Then in that project:

```bash
claude plugin marketplace add WANDERCOLTD/cma
claude plugin install cma
/cma:status     # check it picks up the config
/cma:merge      # try it on a feature branch
```
