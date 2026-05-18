# cma dashboard

Web UI for **Claude Merge Agent** (cma) — v0.3.1.

A status + history dashboard for a configured GitHub repo's main-branch merges.
The CLI plugin lives at the repo root (`bin/`, `commands/`, `hooks/`, `lib/`);
this `web/` subdirectory is the hosted dashboard companion.

## Auth flow

The dashboard is a Vercel-hosted SPA with no backend. GitHub auth is
sessionStorage-only:

1. **From `/cma:dashboard`** — `bin/dashboard.sh` discovers a token from
   `gh auth token`, `GITHUB_TOKEN`, or `GH_TOKEN` and appends it as
   `#token=<value>`. The dashboard consumes the hash on load, stashes the
   token in `sessionStorage`, then rewrites the URL to remove it.
2. **Manual paste** — visit the dashboard and paste a PAT into the setup
   screen. Required scopes: `repo`, `read:org`.
3. **Public mode** — no token; rate-limited to 60 req/hr against public
   repos. A yellow banner surfaces this.

Closing the tab drops the token. Sign-out clears `sessionStorage` and
reloads.

---

## Quickstart

```bash
cd web
npm install
npm run dev          # → http://localhost:5173
```

Build for production:

```bash
npm run build        # → web/dist
npm run preview      # serve the production build locally
```

---

## What you'll see

```
┌──────────────────────────────────────────────────────────────┐
│  ☰   cma — WANDERCOLTD/HF                    [⚙] [👤 paw2paw]│  ← top bar
├──────────────────────────────────────────────────────────────┤
│  Queue (live)                                                │
│  ╭────────────────────────────────────────────────────────╮  │
│  │  ✓ #463 feat(seed): IELTS playbook   [avatar] 2m ago   │  │
│  │  ⏳ #464 fix(#447): rubric goal      [avatar] now      │  │
│  │  ▢ #465 chore: ratchet relock        [avatar] queued   │  │
│  ╰────────────────────────────────────────────────────────╯  │
├──────────────────────────────────────────────────────────────┤
│  Recent merges (last 20)                                     │
│  Card grid — avatar, branch, sha, gate-time, ratchet-delta,  │
│  MERGED/FAILED chip. Click a card → right slideout detail.   │
└──────────────────────────────────────────────────────────────┘
```

Slideouts:

- **Left (☰ hamburger)** — repo switcher, status overview, kill-switch toggle, recent activity.
- **Right (click a merge)** — SHA, branch, commits in the branch, gate output (collapsed by default), ratchet delta, links to GitHub PR / commit / ratchet.
- **Settings (⚙)** — config viewer (mock `.merge-agent.json`), kill-switch, dark/light mode toggle.

Dark mode is the default. Toggle via the sun/moon icon in the top bar or the Settings sheet.

---

## Tech stack

| Concern | Choice |
|---|---|
| Build | Vite 6 + React 18 |
| Language | TypeScript strict mode |
| Styling | Tailwind CSS 3.4 (`darkMode: "class"`) |
| Primitives | Radix UI (Dialog, DropdownMenu, Avatar, Toast, ScrollArea, Separator) |
| Icons | lucide-react |
| Motion | framer-motion |
| Data fetching | @tanstack/react-query (polling, 15s queue / 60s merges) |
| GitHub client | @octokit/rest (via sessionStorage PAT) |

shadcn/ui primitives live in `src/components/ui/` — copy-in style, fully owned
by this project. Extend or replace freely.

---

## Theme reference

CSS variables in `src/index.css`:

| Token | Dark default | Light default |
|---|---|---|
| `--background` | `240 12% 4%` | `0 0% 100%` |
| `--foreground` | `240 5% 96%` | `240 10% 4%` |
| `--primary` | `265 85% 68%` | `265 85% 62%` |
| `--card` | `240 12% 7%` | `0 0% 100%` |
| `--border` | `240 6% 18%` | `240 6% 90%` |
| `--radius` | `0.75rem` | `0.75rem` |

Brand gradient (purple → blue) is exposed as the Tailwind utility
`bg-brand-gradient` and is used sparingly on:

- the primary action variant (`<Button variant="gradient">`)
- the active-queue-item left accent stripe
- the cma monogram in the top bar / nav sheet

Status chip colors (mapped to Tailwind palettes):

| Status | Color | Tailwind |
|---|---|---|
| `merged` | emerald | `emerald-300/200` on `emerald-500/15` |
| `running` | sky | `sky-300/200` on `sky-500/15` |
| `queued` | amber | `amber-300/200` on `amber-500/15` |
| `failed` | rose | `rose-300/200` on `rose-500/15` |
| `idle` | slate | `slate-300/200` on `slate-500/15` |

Glass-morphism utility: `.glass` in `index.css` — `backdrop-blur(12px)` +
translucent card surface + subtle border. Applied to queue and recent-merge
cards.

---

## File layout

```
web/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── public/
│   └── favicon.svg
└── src/
    ├── App.tsx              ← top-level layout + state
    ├── main.tsx             ← React/Query/Theme/Toast providers
    ├── index.css            ← Tailwind + design tokens + .glass utility
    ├── types.ts             ← MergeRecord / QueueItem / RepoConfig
    ├── lib/
    │   ├── utils.ts         ← cn() + formatRelative / formatDuration
    │   └── github.ts        ← Octokit factory + error classifier
    ├── hooks/
    │   ├── use-theme.tsx
    │   ├── use-toast.tsx
    │   ├── useGitHubAuth.tsx    ← sessionStorage token + URL hash consumer
    │   ├── useRecentMerges.ts   ← commits on main + PR/check enrichment
    │   ├── useQueueState.ts     ← open PRs in the merge queue
    │   ├── useRepoConfig.ts     ← branch protection + cma toggles
    │   └── useSignedInUser.ts   ← /user (auth mode only)
    ├── components/
    │   ├── TopBar.tsx
    │   ├── Queue.tsx
    │   ├── RecentMerges.tsx
    │   ├── MergeDetailSheet.tsx
    │   ├── SettingsSheet.tsx
    │   ├── SetupScreen.tsx
    │   ├── NavSheet.tsx
    │   ├── Banner.tsx
    │   ├── StatusChip.tsx
    │   ├── Toaster.tsx
    │   └── ui/              ← shadcn primitives (button, card, sheet, ...)
    └── vite-env.d.ts
```

---

## What's live vs. still TODO

| Concern | State |
|---|---|
| Queue items + recent merges | **Live** — Octokit (`/commits`, `/pulls`) |
| User identity | **Live** — `GET /user` when authenticated |
| Branch protection / merge queue | **Live** — branch protection API |
| Kill-switch toggle | **Read-only stub** — no FS write from a browser |
| `.merge-agent.json` view | **Stub** — deep-link to GitHub |
| Ratchet delta | **Hidden** — `MergeRecord.ratchetDelta` undefined |
| Gate log | **Hidden** — cma writes locally; not reachable |
| Gate seconds | **Approximated** — longest check-run on the merge commit |

### Coming in v0.3.2

- Hosted log endpoint so ratchet delta and gate log can be surfaced.
- Write-back to `.merge-agent.json` (kill switch toggle).
- Real-time updates (SSE).
- GitHub OAuth device flow (no PAT paste).
- Vitest harness for components and hooks.

---

## Conventions

- **No `any`.** Strict TypeScript everywhere.
- **CSS alpha** via `color-mix()` — never hex opacity.
- **Named exports** preferred (matches the global preference).
- **shadcn primitives** are owned files — edit them freely instead of upgrading.
- **Mobile** collapses to a single-column card grid at `< 640px`.

---

## License

MIT (matches the parent cma plugin).
