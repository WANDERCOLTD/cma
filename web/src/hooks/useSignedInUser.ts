import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { SignedInUser } from "@/types";

/**
 * Extended viewer shape — keeps the original `SignedInUser` contract intact
 * (so callers that destructure {login, name, avatarUrl} keep working) and
 * tacks on the Profile-sheet fields. We don't promote `bio`/`htmlUrl` into
 * `SignedInUser` itself to avoid widening that type for callers who don't
 * need it.
 */
export interface SignedInUserExtended extends SignedInUser {
  bio: string | null;
  htmlUrl: string;
}

/**
 * Fetch the signed-in viewer (`GET /user`). Disabled in public mode — the
 * endpoint requires a token. Cached for 5 minutes since it rarely changes.
 */
export function useSignedInUser(): UseQueryResult<SignedInUserExtended | null> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<SignedInUserExtended | null>({
    queryKey: ["viewer", token ? "auth" : "public"],
    queryFn: async () => {
      if (!token) return null;
      const res = await octokit.users.getAuthenticated();
      return {
        login: res.data.login,
        name: res.data.name ?? res.data.login,
        avatarUrl: res.data.avatar_url,
        bio: res.data.bio ?? null,
        htmlUrl: res.data.html_url,
      };
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}
