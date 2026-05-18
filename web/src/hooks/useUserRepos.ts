import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";

/**
 * Compact repo summary returned by `GET /user/repos` — the shape the
 * RepoPickerScreen needs. We deliberately keep this narrow to avoid coupling
 * to the full Octokit response type, which churns between versions.
 */
export interface UserRepoSummary {
  id: number;
  owner: {
    login: string;
    avatarUrl: string;
    type: "User" | "Organization";
  };
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  /** Updated when a branch is pushed — drives "Recent" sort. */
  pushedAt: string;
  /** Best-effort: GitHub doesn't return merge-queue state in /user/repos. */
  hasMergeQueue: boolean;
  htmlUrl: string;
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  pushed_at: string | null;
  updated_at: string | null;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
  /** Newer responses expose this — falsy on older endpoints. */
  merge_queue_enabled?: boolean;
}

const CACHE_MS = 5 * 60_000; // 5 min
const PER_PAGE = 50;

function mapRepo(r: RawRepo): UserRepoSummary {
  return {
    id: r.id,
    owner: {
      login: r.owner.login,
      avatarUrl: r.owner.avatar_url,
      type: r.owner.type === "Organization" ? "Organization" : "User",
    },
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    isPrivate: r.private,
    pushedAt: r.pushed_at ?? r.updated_at ?? new Date(0).toISOString(),
    hasMergeQueue: Boolean(r.merge_queue_enabled),
    htmlUrl: r.html_url,
  };
}

/**
 * List the authenticated user's repos, recently pushed first. Returns an
 * empty array in public mode (the endpoint is auth-only).
 */
export function useUserRepos(): UseQueryResult<UserRepoSummary[]> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<UserRepoSummary[]>({
    queryKey: ["userRepos", token ? "auth" : "public"],
    enabled: !!token,
    queryFn: async () => {
      // /user/repos returns up to 100 per page; 50 covers ~95% of users.
      const res = await octokit.request("GET /user/repos", {
        sort: "pushed",
        per_page: PER_PAGE,
        affiliation: "owner,collaborator,organization_member",
      });
      const data = res.data as RawRepo[];
      return data.map(mapRepo);
    },
    staleTime: CACHE_MS,
    gcTime: CACHE_MS * 2,
    retry: 1,
  });
}
