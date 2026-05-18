import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import { useSignedInUser } from "@/hooks/useSignedInUser";
import type { ConfiguredRepo } from "@/types";

/**
 * Find every repo the viewer can see that contains a `.4wd.json` file at root.
 *
 * Backed by GitHub code-search (`/search/code`), scoped to the signed-in user
 * via `user:<login>`. Code-search has its own bucket (~30 req/min for
 * authenticated calls), so we cache aggressively — 5 min stale, 10 min gc.
 *
 * Public mode disables the hook outright: code-search requires a token.
 */

const CACHE_MS = 5 * 60_000;
const MAX_RESULTS = 30; // sane cap — most users won't have more

interface RawSearchItem {
  name: string;
  path: string;
  html_url: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    pushed_at?: string | null;
    updated_at?: string | null;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

function mapItem(item: RawSearchItem): ConfiguredRepo {
  const r = item.repository;
  return {
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url },
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    pushedAt: r.pushed_at ?? r.updated_at ?? null,
  };
}

/**
 * Dedupe by `fullName` — code-search can return multiple matches per repo when
 * the file appears in multiple paths (we restrict to root via `filename:` but
 * the API still occasionally yields dupes after forks).
 */
function dedupe(items: ConfiguredRepo[]): ConfiguredRepo[] {
  const seen = new Set<string>();
  const out: ConfiguredRepo[] = [];
  for (const it of items) {
    if (seen.has(it.fullName)) continue;
    seen.add(it.fullName);
    out.push(it);
  }
  return out;
}

interface UseConfiguredReposResult {
  repos: ConfiguredRepo[];
  isLoading: boolean;
  error: unknown;
  isPublicMode: boolean;
}

export function useConfiguredRepos(): UseConfiguredReposResult {
  const { token, isPublicMode } = useGitHubAuth();
  const viewer = useSignedInUser();
  const login = viewer.data?.login ?? null;
  const octokit = makeOctokit(token);

  // We compose the hook output so the caller doesn't need to thread three
  // UseQueryResults together for the loading/error states.
  const query: UseQueryResult<ConfiguredRepo[]> = useQuery<ConfiguredRepo[]>({
    queryKey: ["configuredRepos", login],
    enabled: !!token && !!login,
    queryFn: async () => {
      if (!login) return [];
      // `filename:.4wd.json user:<login>` — restrict to the viewer's own +
      // accessible repos. `path:/` excludes nested `.4wd.json` (rare but
      // possible in mono-repos).
      const res = await octokit.search.code({
        q: `filename:.4wd.json user:${login}`,
        per_page: MAX_RESULTS,
      });
      const items = (res.data.items ?? []) as RawSearchItem[];
      const mapped = items.map(mapItem);
      return dedupe(mapped).sort((a, b) => {
        // Most-recently-pushed first.
        const at = a.pushedAt ? new Date(a.pushedAt).getTime() : 0;
        const bt = b.pushedAt ? new Date(b.pushedAt).getTime() : 0;
        return bt - at;
      });
    },
    staleTime: CACHE_MS,
    gcTime: CACHE_MS * 2,
    retry: 1,
  });

  return {
    repos: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    isPublicMode,
  };
}
