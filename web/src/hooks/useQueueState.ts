import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { QueueItem, QueueStatus, User } from "@/types";

interface UseQueueStateArgs {
  owner: string;
  name: string;
}

const POLL_MS = 15_000;

interface PullListItem {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft?: boolean;
  auto_merge: unknown | null;
  user: { login: string; avatar_url: string } | null;
  head: { ref: string };
  created_at: string;
  updated_at: string;
  labels: { name: string }[];
}

/**
 * Best-effort detection of "this PR is in/queued for the merge queue".
 *
 * GitHub's REST API does not expose merge-queue state on a PR directly
 * (the GraphQL `mergeQueueEntry` field does, but bringing in a separate
 * GraphQL client for one field isn't justified yet). Proxies, in order:
 *
 *  1. `auto_merge` set → queued for auto-merge.
 *  2. label name matches `merge-queue` / `auto-merge` / `queued`.
 *  3. branch protection's queue checks (we don't have them here, so skip).
 *
 * Falls back to "show every open non-draft PR with auto_merge set" — which
 * matches how cma + GitHub's own merge queue work in practice.
 */
function statusFor(pr: PullListItem): QueueStatus {
  if (pr.state === "closed") return "merged";
  // We can't easily tell "running gate now" vs "queued" from a list call.
  // Default to "queued" — useRecentMerges already covers running history.
  return "queued";
}

function isMergeQueueCandidate(pr: PullListItem): boolean {
  if (pr.state !== "open") return false;
  if (pr.draft) return false;
  if (pr.auto_merge) return true;
  const labels = pr.labels.map((l) => l.name.toLowerCase());
  return labels.some(
    (l) =>
      l === "merge-queue" ||
      l === "auto-merge" ||
      l === "queued" ||
      l.startsWith("merge:"),
  );
}

function mapPr(pr: PullListItem): QueueItem {
  const author: User = pr.user
    ? { login: pr.user.login, avatarUrl: pr.user.avatar_url }
    : { login: "unknown", avatarUrl: "" };
  return {
    id: `pr-${pr.number}`,
    prNumber: pr.number,
    title: pr.title,
    branch: pr.head.ref,
    author,
    status: statusFor(pr),
    startedAt: pr.updated_at,
  };
}

export function useQueueState({
  owner,
  name,
}: UseQueueStateArgs): UseQueryResult<QueueItem[]> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<QueueItem[]>({
    queryKey: ["queueState", owner, name, token ? "auth" : "public"],
    queryFn: async () => {
      const res = await octokit.pulls.list({
        owner,
        repo: name,
        state: "open",
        sort: "updated",
        direction: "desc",
        per_page: 30,
      });
      const candidates = (res.data as unknown as PullListItem[]).filter(
        isMergeQueueCandidate,
      );
      return candidates.map(mapPr);
    },
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  });
}
