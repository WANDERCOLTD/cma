# cma dashboard

Web UI for **Claude Merge Agent** (cma) — v0.3 scaffold.

A status + history dashboard for a configured GitHub repo's main-branch merges.
The CLI plugin lives at the repo root (`bin/`, `commands/`, `hooks/`, `lib/`);
this `web/` subdirectory is the dashboard companion shipping as v0.3.

> Real GitHub API wiring (Octokit + `gh auth token` + polling) lands in v0.3.1.
> This scaffold runs entirely off mock data in `src/data/mock.ts`.

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
| Data fetching | @tanstack/react-query (configured, not yet used) |
| GitHub client | @octokit/rest (installed, not yet used) |

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
    ├── data/
    │   └── mock.ts          ← 20 merges, 3 queue items, repo config
    ├── lib/
    │   └── utils.ts         ← cn() + formatRelative / formatDuration
    ├── hooks/
    │   ├── use-theme.tsx
    │   └── use-toast.tsx
    ├── components/
    │   ├── TopBar.tsx
    │   ├── Queue.tsx
    │   ├── RecentMerges.tsx
    │   ├── MergeDetailSheet.tsx
    │   ├── SettingsSheet.tsx
    │   ├── NavSheet.tsx
    │   ├── StatusChip.tsx
    │   ├── Toaster.tsx
    │   └── ui/              ← shadcn primitives (button, card, sheet, ...)
    └── vite-env.d.ts
```

---

## What's mocked vs. what's real

| Concern | State |
|---|---|
| Queue items + recent merges | **Mocked** — `src/data/mock.ts` |
| User identity / sign-in | **Mocked** — `signedInUser` |
| `.merge-agent.json` view | **Mocked** — synthesised JSON in `SettingsSheet` |
| Kill-switch toggle | **Local state only** — no GitHub write yet |
| Ratchet delta | **Mocked** — `MergeRecord.ratchetDelta` |
| Gate log | **Mocked** — `MergeRecord.gateLog` |
| GitHub deep-links (PR / commit) | **Real URLs** — open in a new tab |

### Coming in v0.3.1

- Octokit-backed live data via `gh auth token`.
- Polling for the queue (every 15s).
- Real `.merge-agent.json` read via the Contents API.
- Sign-in via GitHub OAuth device flow.
- `/cma:dashboard` slash command to open this UI from inside Claude Code.
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
