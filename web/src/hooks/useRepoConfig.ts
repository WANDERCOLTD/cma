import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { makeOctokit } from "@/lib/github";
import type { RepoConfig } from "@/types";

interface UseRepoConfigArgs {
  owner: string;
  name: string;
}

/**
 * Fetch branch protection + merge-queue config for `main` of the given repo.
 *
 * - `branchProtectionEnabled`: true when `GET .../branches/main/protection` succeeds (200).
 *   A 404 means "no protection rules" — we report false rather than error.
 * - `mergeQueueEnabled`: derived from `required_status_checks` having
 *   `strict: true` and the repo itself exposing the `mergeQueue` toggle.
 *   The REST API surface for merge-queue settings is limited; we infer
 *   from the presence of the protection rule. v0.3.2 will switch to GraphQL.
 * - `cmaDisabled`: cma keeps this in repo's `.merge-agent.json`. The dashboard
 *   has no FS access — leave as `false` for now and surface a TODO.
 * - `cmaVersion`: bundled with the dashboard, not the repo. Use the package
 *   version baked into the build via a Vite env var (defaults to "dev").
 */
export function useRepoConfig({
  owner,
  name,
}: UseRepoConfigArgs): UseQueryResult<RepoConfig> {
  const { token } = useGitHubAuth();
  const octokit = makeOctokit(token);

  return useQuery<RepoConfig>({
    queryKey: ["repoConfig", owner, name, token ? "auth" : "public"],
    queryFn: async () => {
      // Fetch repo to confirm access (and to get default_branch when needed).
      const repo = await octokit.repos.get({ owner, repo: name });
      const defaultBranch = repo.data.default_branch ?? "main";

      // Branch protection — may 404 when not configured.
      let branchProtectionEnabled = false;
      let mergeQueueEnabled = false;
      try {
        const protection = await octokit.repos.getBranchProtection({
          owner,
          repo: name,
          branch: defaultBranch,
        });
        branchProtectionEnabled = true;
        // Merge queue inference — the REST shape doesn't expose merge-queue
        // settings directly. Treat strict required-status-checks as a proxy.
        const strict = protection.data.required_status_checks?.strict ?? false;
        mergeQueueEnabled = strict;
      } catch (err) {
        // 404 = no protection. Anything else, swallow but leave both false.
        if (
          typeof err === "object" &&
          err &&
          "status" in err &&
          (err as { status?: number }).status !== 404
        ) {
          // Other errors bubble (e.g. 401/403) so the UI shows the toast.
          throw err;
        }
      }

      return {
        owner,
        name,
        branchProtectionEnabled,
        mergeQueueEnabled,
        // TODO(v0.3.2): Dashboard has no file-system access to read
        // .merge-agent.json from the repo root. A future iteration could:
        //   - Use the Contents API to GET .merge-agent.json and parse it; or
        //   - Read from a hosted log endpoint.
        cmaDisabled: false,
        cmaVersion: __CMA_DASHBOARD_VERSION__,
      };
    },
    // Repo config rarely changes — poll less frequently.
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}
