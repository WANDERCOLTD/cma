import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { SignedInUser } from "@/types";

/**
 * Fetch the signed-in viewer (`GET /user`). Disabled in public mode — the
 * endpoint requires a token. Cached for 5 minutes since it rarely changes.
 */
export function useSignedInUser(): UseQueryResult<SignedInUser | null> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<SignedInUser | null>({
    queryKey: ["viewer", token ? "auth" : "public"],
    queryFn: async () => {
      if (!token) return null;
      const res = await octokit.users.getAuthenticated();
      return {
        login: res.data.login,
        name: res.data.name ?? res.data.login,
        avatarUrl: res.data.avatar_url,
      };
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}
