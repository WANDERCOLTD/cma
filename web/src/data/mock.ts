import type {
  MergeRecord,
  QueueItem,
  RepoConfig,
  SignedInUser,
} from "@/types";

const gh = (login: string) => ({
  login,
  avatarUrl: `https://github.com/${login}.png`,
});

const minutesAgo = (m: number): string =>
  new Date(Date.now() - m * 60_000).toISOString();

const hoursAgo = (h: number): string =>
  new Date(Date.now() - h * 3_600_000).toISOString();

const daysAgo = (d: number): string =>
  new Date(Date.now() - d * 86_400_000).toISOString();

export const signedInUser: SignedInUser = {
  login: "paw2paw",
  name: "Paul Wander",
  avatarUrl: "https://github.com/paw2paw.png",
};

export const repoConfig: RepoConfig = {
  owner: "WANDERCOLTD",
  name: "HF",
  branchProtectionEnabled: true,
  mergeQueueEnabled: true,
  cmaDisabled: false,
  cmaVersion: "0.2.1",
};

export const queueItems: QueueItem[] = [
  {
    id: "q-001",
    prNumber: 463,
    title: "feat(seed): IELTS playbook + curriculum import",
    branch: "feat/463-ielts-seed",
    author: gh("paw2paw"),
    status: "merged",
    startedAt: minutesAgo(8),
    finishedAt: minutesAgo(2),
  },
  {
    id: "q-002",
    prNumber: 464,
    title: "fix(#447): rubric goal scoring respects band overrides",
    branch: "fix/447-rubric-band-overrides",
    author: gh("danabra"),
    status: "running",
    startedAt: minutesAgo(1),
  },
  {
    id: "q-003",
    prNumber: 465,
    title: "chore: ratchet relock after BATS bump",
    branch: "chore/ratchet-relock",
    author: gh("dependabot"),
    status: "queued",
    startedAt: minutesAgo(0),
  },
];

const sampleGateLog = `[gate] running on origin/main + branch
[gate] tsc --noEmit ......................... ok (8.2s)
[gate] eslint . ............................. ok (3.1s)
[gate] vitest run --coverage ................ ok (41.4s)
[gate]   ✓ 3188 tests passed
[gate]   coverage  lines  92.4%  (+0.3% vs main)
[gate] playwright (smoke) .................... ok (22.7s)
[gate] ratchet check ......................... ok
[gate]   ↑ coverage.lines  92.1 → 92.4
[gate]   ↓ build.bundleKb  482  → 478
[gate] all checks green — proceeding to merge`;

const titles: { title: string; branch: string; author: string }[] = [
  {
    title: "feat(#412): teacher tuning overlay scope picker",
    branch: "feat/412-overlay-scope",
    author: "paw2paw",
  },
  {
    title: "fix(#405): force re-run clears prior writes",
    branch: "fix/405-force-rerun-cleanup",
    author: "paw2paw",
  },
  {
    title: "fix(#403): real LO refs in AI prompt",
    branch: "fix/403-lo-refs-in-prompt",
    author: "danabra",
  },
  {
    title: "fix(#401): tutor pedagogy — concept before application",
    branch: "fix/401-tutor-pedagogy",
    author: "marisol-eng",
  },
  {
    title: "fix(#397): derive Module Mastery from LO scores",
    branch: "fix/397-module-mastery",
    author: "paw2paw",
  },
  {
    title: "fix(#396): wire activeCall into SimChat",
    branch: "fix/396-simchat-activecall",
    author: "tom-h",
  },
  {
    title: "feat(#388): journey-stops continuous resolver",
    branch: "feat/388-journey-resolver",
    author: "marisol-eng",
  },
  {
    title: "chore: bump @anthropic-ai/sdk to 0.34",
    branch: "chore/bump-anthropic-sdk",
    author: "dependabot",
  },
  {
    title: "fix(#379): playbook source migration phase 6 cleanup",
    branch: "fix/379-playbook-source-phase6",
    author: "paw2paw",
  },
  {
    title: "feat(#372): scheduler soft-cap + preset picker",
    branch: "feat/372-scheduler-softcap",
    author: "danabra",
  },
  {
    title: "fix(#365): TDZ in pipeline config import",
    branch: "fix/365-tdz-pipeline-config",
    author: "tom-h",
  },
  {
    title: "feat(#360): AI model management cascade",
    branch: "feat/360-model-cascade",
    author: "paw2paw",
  },
  {
    title: "fix(#355): wizard busyReason flicker on chip toggle",
    branch: "fix/355-busyreason-flicker",
    author: "marisol-eng",
  },
  {
    title: "chore(deps): pin tanstack-query to 5.62",
    branch: "chore/pin-tanstack",
    author: "dependabot",
  },
  {
    title: "feat(#341): outcome graph pacing v1",
    branch: "feat/341-outcome-graph",
    author: "danabra",
  },
  {
    title: "fix(#338): RBAC requireAuth on adaptation routes",
    branch: "fix/338-rbac-adapt",
    author: "tom-h",
  },
  {
    title: "fix(#330): CSS alpha → color-mix() sweep",
    branch: "fix/330-color-mix-sweep",
    author: "paw2paw",
  },
  {
    title: "feat(#321): tuning assistant phase 1",
    branch: "feat/321-tuning-assistant",
    author: "marisol-eng",
  },
  {
    title: "fix(#315): seed idempotency for skill-agg spec",
    branch: "fix/315-seed-idempotent",
    author: "paw2paw",
  },
  {
    title: "feat: BATS matrix on shellcheck + ratchet",
    branch: "feat/bats-matrix",
    author: "paw2paw",
  },
];

const baseTimes = [
  minutesAgo(14),
  minutesAgo(48),
  hoursAgo(2),
  hoursAgo(4),
  hoursAgo(7),
  hoursAgo(11),
  hoursAgo(16),
  hoursAgo(20),
  daysAgo(1),
  daysAgo(1.4),
  daysAgo(2),
  daysAgo(2.6),
  daysAgo(3),
  daysAgo(3.8),
  daysAgo(4),
  daysAgo(5),
  daysAgo(6),
  daysAgo(8),
  daysAgo(10),
  daysAgo(13),
];

const ratchetSamples: MergeRecord["ratchetDelta"][] = [
  [
    { metric: "coverage.lines", before: 92.1, after: 92.4 },
    { metric: "build.bundleKb", before: 482, after: 478 },
  ],
  [{ metric: "coverage.lines", before: 91.8, after: 92.1 }],
  [
    { metric: "tests.count", before: 3180, after: 3188 },
    { metric: "coverage.lines", before: 92.0, after: 92.1 },
  ],
  undefined,
  [{ metric: "build.bundleKb", before: 490, after: 482 }],
  [
    { metric: "coverage.lines", before: 91.5, after: 91.8 },
    { metric: "tests.count", before: 3165, after: 3180 },
  ],
];

function hexSha(seed: number): string {
  // Stable, varied-looking 40-char hex string derived from seed.
  const chars = "0123456789abcdef";
  let s = "";
  let x = seed * 2654435761;
  for (let i = 0; i < 40; i++) {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    s += chars[x % 16];
  }
  return s;
}

export const recentMerges: MergeRecord[] = titles.map((t, i) => {
  const sha = hexSha(i + 1);
  const failed = i === 7 || i === 13; // a couple of failures sprinkled in
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch: t.branch,
    title: t.title,
    author: gh(t.author),
    status: failed ? "failed" : "merged",
    mergedAt: baseTimes[i] ?? daysAgo(15 + i),
    gateSeconds: 45 + ((i * 17) % 220),
    ratchetDelta: failed ? undefined : ratchetSamples[i % ratchetSamples.length],
    prNumber: 463 - i - 1,
    gateLog: failed
      ? `[gate] running on origin/main + branch
[gate] tsc --noEmit ......................... ok
[gate] eslint . ............................. ok
[gate] vitest run ........................... FAILED
[gate]   ✗ 2 tests failed in lib/pipeline/score.test.ts
[gate]   ✗ 1 test failed in lib/prompt/composer.test.ts
[gate] aborting merge — see logs above`
      : sampleGateLog,
    commits: [
      {
        sha: hexSha(i * 31 + 7),
        shortSha: hexSha(i * 31 + 7).slice(0, 7),
        message: t.title,
      },
      {
        sha: hexSha(i * 31 + 11),
        shortSha: hexSha(i * 31 + 11).slice(0, 7),
        message: "test: cover edge cases",
      },
      {
        sha: hexSha(i * 31 + 13),
        shortSha: hexSha(i * 31 + 13).slice(0, 7),
        message: "chore: lint + format",
      },
    ],
  };
});
