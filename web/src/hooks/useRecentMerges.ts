import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { MergeRecord, User } from "@/types";

interface UseRecentMergesArgs {
  owner: string;
  name: string;
  /** Limit of recent merges (commits on default branch). */
  limit?: number;
}

const POLL_MS = 60_000;
const MAX_PARALLEL_ENRICH = 6; // PR + checks fetches per commit

interface CommitListItem {
  sha: string;
  commit: {
    message: string;
    author: { name?: string | null; date?: string | null } | null;
    committer: { date?: string | null } | null;
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

/**
 * Coerce raw commit JSON → MergeRecord. Author info falls back to the
 * commit author name when GitHub couldn't resolve a user.
 */
function mapCommit(raw: CommitListItem): MergeRecord {
  const sha = raw.sha;
  const author: User = raw.author
    ? {
        login: raw.author.login,
        avatarUrl: raw.author.avatar_url,
      }
    : {
        login: raw.commit.author?.name ?? "unknown",
        avatarUrl: "",
      };
  const mergedAt =
    raw.commit.committer?.date ?? raw.commit.author?.date ?? new Date().toISOString();
  const title = raw.commit.message.split("\n")[0].slice(0, 200);
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch: "main", // commit on main — origin branch is in the PR (enriched below)
    title,
    author,
    status: "merged",
    mergedAt,
    // Approximated below via check-runs; 0 means unknown / no checks.
    gateSeconds: 0,
    // TODO(v0.3.2): read from a hosted log endpoint (cma writes ratchet deltas
    // to ${CLAUDE_PLUGIN_DATA}/merge-log.jsonl on the developer's machine,
    // which is not reachable from a browser).
    ratchetDelta: undefined,
  };
}

/**
 * Fetch a small helping of enrichment per commit:
 *  - associated PR (prNumber + canonical branch name)
 *  - check-runs (longest duration → gateSeconds approximation)
 *
 * Errors are swallowed per-commit — enrichment is best-effort, the merge
 * card still renders with the bare commit info.
 */
async function enrichCommit(
  octokit: ReturnType<typeof makeOctokit>,
  owner: string,
  repo: string,
  base: MergeRecord,
): Promise<MergeRecord> {
  const result: MergeRecord = { ...base };

  const [prsRes, checksRes] = await Promise.allSettled([
    octokit.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: base.sha,
    }),
    octokit.checks.listForRef({ owner, repo, ref: base.sha }),
  ]);

  if (prsRes.status === "fulfilled") {
    const pr = prsRes.value.data[0];
    if (pr) {
      result.prNumber = pr.number;
      // Prefer the PR's head ref — it's the "feature branch" that was merged.
      if (pr.head?.ref) result.branch = pr.head.ref;
      if (pr.title) result.title = pr.title;
    }
  }

  if (checksRes.status === "fulfilled") {
    const runs = checksRes.value.data.check_runs ?? [];
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
    if (longest > 0) result.gateSeconds = longest;
    // A commit on main with a failed required check is still "merged" from
    // GitHub's perspective. Surface as failed so the UI shows the chip.
    if (anyFailed && runs.length > 0) result.status = "failed";
  }

  return result;
}

/** Pool helper: run `tasks` with at most `n` in flight. */
async function withConcurrency<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function useRecentMerges({
  owner,
  name,
  limit = 20,
}: UseRecentMergesArgs): UseQueryResult<MergeRecord[]> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<MergeRecord[]>({
    queryKey: ["recentMerges", owner, name, limit, token ? "auth" : "public"],
    queryFn: async () => {
      const commits = await octokit.repos.listCommits({
        owner,
        repo: name,
        per_page: limit,
      });
      const base = commits.data.map((c) => mapCommit(c as CommitListItem));
      const enriched = await withConcurrency(base, MAX_PARALLEL_ENRICH, (m) =>
        enrichCommit(octokit, owner, name, m),
      );
      return enriched;
    },
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  });
}
