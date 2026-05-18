import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { ConfiguredRepo } from "@/types";

/**
 * Aggregate dashboard stats across the viewer's 4wd-configured repos.
 *
 * Computed client-side from `repos.listCommits` + `checks.listForRef` — the
 * same primitives the per-repo "Recent merges" view uses. We cap parallelism
 * at 5 to avoid bursting the rate-limit budget; per-commit check fetches are
 * capped at 10 per repo so a single hot repo can't dominate.
 *
 * Returns *approximations* — proper ratchet history needs the local
 * `${CLAUDE_PLUGIN_DATA}/merge-log.jsonl`, which a browser can't read.
 *
 * TODO(v1.2): proper ratchet history — server-side merge-log endpoint.
 */

const CACHE_MS = 5 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REPO_CONCURRENCY = 5;
const CHECKS_PER_REPO = 10;

export type RatchetTrend = "improving" | "stable" | "regressing";

export interface AggregateStats {
  mergesThisWeek: number;
  /** Mean of longest check-run duration per commit (seconds). */
  meanGateSeconds: number;
  /** 0-1 — fraction of last-week commits with no failed/timed-out check-runs. */
  gatePassRate: number;
  /** Per-repo `improving | stable | regressing` heuristic. */
  trends: Array<{ fullName: string; trend: RatchetTrend }>;
}

interface RawCommit {
  sha: string;
  commit: { committer: { date?: string | null } | null };
}

interface RawCheckRun {
  status: string;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

/** Pool helper — limits in-flight tasks to `n`. */
async function withConcurrency<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(n, items.length) },
    async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        results[idx] = await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

interface RepoSlice {
  fullName: string;
  weekCommits: RawCommit[];
  priorWeekCount: number;
  /** Longest check-run duration per commit, seconds. */
  gateDurations: number[];
  /** Per-commit pass flag for gate-pass-rate. */
  gatePasses: boolean[];
}

async function fetchRepoSlice(
  octokit: ReturnType<typeof makeOctokit>,
  repo: ConfiguredRepo,
  nowMs: number,
): Promise<RepoSlice> {
  const sinceWeekIso = new Date(nowMs - WEEK_MS).toISOString();
  const sincePriorIso = new Date(nowMs - 2 * WEEK_MS).toISOString();
  const untilPriorIso = sinceWeekIso;

  // Two windows in parallel — current week and the week before it.
  const [thisWeekRes, priorWeekRes] = await Promise.allSettled([
    octokit.repos.listCommits({
      owner: repo.owner.login,
      repo: repo.name,
      since: sinceWeekIso,
      per_page: 100,
    }),
    octokit.repos.listCommits({
      owner: repo.owner.login,
      repo: repo.name,
      since: sincePriorIso,
      until: untilPriorIso,
      per_page: 100,
    }),
  ]);

  const weekCommits =
    thisWeekRes.status === "fulfilled"
      ? (thisWeekRes.value.data as RawCommit[])
      : [];
  const priorWeekCount =
    priorWeekRes.status === "fulfilled" ? priorWeekRes.value.data.length : 0;

  // Per-commit check-run enrichment — capped to avoid budget blow-out on
  // chatty repos. Best-effort; swallow per-commit errors.
  const sampled = weekCommits.slice(0, CHECKS_PER_REPO);
  const checksByCommit = await withConcurrency(sampled, 4, async (c) => {
    try {
      const r = await octokit.checks.listForRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: c.sha,
      });
      return (r.data.check_runs ?? []) as RawCheckRun[];
    } catch {
      return [] as RawCheckRun[];
    }
  });

  const gateDurations: number[] = [];
  const gatePasses: boolean[] = [];
  for (const runs of checksByCommit) {
    if (runs.length === 0) {
      // No checks → treat as pass (parity with per-repo view's neutral case).
      gatePasses.push(true);
      continue;
    }
    let longest = 0;
    let anyFailed = false;
    for (const run of runs) {
      if (run.conclusion === "failure" || run.conclusion === "timed_out") {
        anyFailed = true;
      }
      if (run.started_at && run.completed_at) {
        const dur = Math.floor(
          (new Date(run.completed_at).getTime() -
            new Date(run.started_at).getTime()) /
            1000,
        );
        if (dur > longest) longest = dur;
      }
    }
    if (longest > 0) gateDurations.push(longest);
    gatePasses.push(!anyFailed);
  }

  return {
    fullName: repo.fullName,
    weekCommits,
    priorWeekCount,
    gateDurations,
    gatePasses,
  };
}

function trendFor(weekCount: number, priorCount: number): RatchetTrend {
  // Down is good for warning counts. Here we proxy "regressing" with a *rising*
  // commit count over the previous window — a noisy heuristic, but stable
  // enough as a placeholder until we land a real ratchet feed.
  const delta = weekCount - priorCount;
  const base = Math.max(priorCount, 1);
  const ratio = delta / base;
  if (ratio > 0.25) return "regressing";
  if (ratio < -0.15) return "improving";
  return "stable";
}

export function useAggregateStats(
  repos: ConfiguredRepo[],
): UseQueryResult<AggregateStats> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  // Stable key — full-name list is small (capped at 30).
  const fullNames = repos.map((r) => r.fullName).join(",");

  return useQuery<AggregateStats>({
    queryKey: ["aggregateStats", fullNames, token ? "auth" : "public"],
    enabled: repos.length > 0 && !!token,
    queryFn: async () => {
      const nowMs = Date.now();
      const slices = await withConcurrency(repos, REPO_CONCURRENCY, (r) =>
        fetchRepoSlice(octokit, r, nowMs),
      );

      const mergesThisWeek = slices.reduce(
        (acc, s) => acc + s.weekCommits.length,
        0,
      );

      const allDurations = slices.flatMap((s) => s.gateDurations);
      const meanGateSeconds =
        allDurations.length > 0
          ? Math.round(
              allDurations.reduce((a, b) => a + b, 0) / allDurations.length,
            )
          : 0;

      const allPasses = slices.flatMap((s) => s.gatePasses);
      const gatePassRate =
        allPasses.length > 0
          ? allPasses.filter(Boolean).length / allPasses.length
          : 1;

      const trends = slices.map((s) => ({
        fullName: s.fullName,
        trend: trendFor(s.weekCommits.length, s.priorWeekCount),
      }));

      return { mergesThisWeek, meanGateSeconds, gatePassRate, trends };
    },
    staleTime: CACHE_MS,
    gcTime: CACHE_MS * 2,
    retry: 1,
  });
}
