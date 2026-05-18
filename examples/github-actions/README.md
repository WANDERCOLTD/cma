# GitHub Actions companion — GHMQ + remote-VM gate

The `4wd` plugin handles the **developer-experience layer**: `/4wd:merge` from inside Claude Code, lock state, gate output streaming. For *serialisation* of merges to `main` when more than one contributor (human or AI agent) is active, the right primitive is **GitHub Merge Queue** plus a GHA workflow that runs the canonical gate.

This directory shows the pattern.

## Why both?

| Layer | What it does | Lives where |
|-------|--------------|-------------|
| **`4wd` plugin** | `/4wd:merge`, file lock, rebase, stream gate output, ratchet relock | Claude Code session |
| **GHMQ + GHA** | Serialise PRs into main, run the same gate on a clean checkout, block direct pushes | GitHub |

The plugin is the *fast path* for a single developer running parallel Claude Code sessions on one machine. GHMQ is the *correctness path* for any repo with more than one contributor — it enforces serialisation even when somebody bypasses Claude Code.

Use the plugin for fast iteration. Use GHMQ as the safety net. They share the gate command.

## Setup (3 steps)

### 1. Enable branch protection + merge queue on `main`

```
Settings → Branches → main → Add rule
  ✓ Require a pull request before merging
  ✓ Require status checks to pass before merging
  ✓ Require merge queue
```

This blocks direct pushes — including from `4wd`. The plugin will still rebase + run the local gate, but it'll submit to the merge queue instead of pushing direct.

### 2. Copy the workflow

Drop [`merge-queue.yml`](./merge-queue.yml) into `.github/workflows/`. It runs on `merge_group` (the queue trigger) and on `pull_request` for early feedback.

### 3. (Optional) Wire up the remote-VM gate

If your gate must run against a long-running VM (e.g. Cloud Run, Compute Engine, on-prem) rather than a clean GHA runner, [`ssh-to-vm-gate.yml`](./ssh-to-vm-gate.yml) is a drop-in template. Requires three secrets:

- `GATE_VM_HOST` — `user@host` or just `host` if using IAP/bastion
- `GATE_SSH_KEY` — private key with access to the VM (base64-encoded)
- `GATE_SSH_KNOWN_HOSTS` — output of `ssh-keyscan` for the VM

For Google Cloud IAP tunnels specifically, see the comments in `ssh-to-vm-gate.yml` — the pattern is `gcloud compute ssh --tunnel-through-iap` instead of bare `ssh`.

## Recommended `.4wd.json` when paired with GHMQ

```json
{
  "gate": {
    "command": "bash scripts/deploy-gate.sh dev",
    "timeoutSeconds": 900
  },
  "branchProtection": "error",
  "ratchet": {
    "file": ".ratchet.json",
    "lockCommand": "bash scripts/check-ratchet.sh lock"
  }
}
```

Notes:
- `branchProtection: "error"` makes `4wd` refuse to start a session in a repo with no branch protection. Once you've enabled GHMQ, that's the right posture.
- The plugin will warn that direct push is rejected (correct — GHMQ owns main). v0.2 will submit to the queue automatically. For now, after a green local gate, push your branch and `gh pr create --merge-queue`.
