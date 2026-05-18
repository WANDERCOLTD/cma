import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";

/**
 * Construct an Octokit client. When `token` is null, the client is
 * unauthenticated (60 req/hr to public endpoints — fine for a demo).
 */
export function makeOctokit(token: string | null): Octokit {
  return new Octokit({
    auth: token ?? undefined,
    userAgent: "4wd-dashboard/0.3.1",
  });
}

/**
 * Parse `owner/name` from the `?repo=<owner>/<name>` URL query param.
 * Returns null when missing or malformed.
 */
export function parseRepoFromUrl(
  search: string = window.location.search,
): { owner: string; name: string } | null {
  const params = new URLSearchParams(search);
  const raw = params.get("repo");
  if (!raw) return null;
  const trimmed = raw.trim();
  // owner/name — at most one slash, neither side empty, restrict to GitHub-legal chars.
  const match = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(trimmed);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

export interface GitHubErrorInfo {
  status: number;
  message: string;
  /** True when the response carried `x-ratelimit-remaining: 0`. */
  rateLimited: boolean;
  /** Epoch seconds (when known) the limit resets. */
  rateLimitReset?: number;
  /** True for 403 messages mentioning `scope` (missing token scope). */
  missingScope: boolean;
}

/**
 * Normalise an unknown error into a shape the UI can use to show a
 * specific toast. Returns null for non-Octokit errors.
 */
export function classifyGitHubError(err: unknown): GitHubErrorInfo | null {
  if (!(err instanceof RequestError)) return null;
  const headers = (err.response?.headers ?? {}) as Record<string, string>;
  const remaining = headers["x-ratelimit-remaining"];
  const reset = headers["x-ratelimit-reset"];
  const rateLimited = err.status === 403 && remaining === "0";
  const message = err.message ?? "GitHub request failed";
  const missingScope =
    err.status === 403 &&
    /missing.*scope|insufficient.*scope|scope/i.test(message);
  return {
    status: err.status,
    message,
    rateLimited,
    rateLimitReset: reset ? Number.parseInt(reset, 10) : undefined,
    missingScope,
  };
}

/**
 * Format a rate-limit-reset epoch into a short human string.
 */
export function formatResetTime(epochSeconds: number): string {
  const ms = epochSeconds * 1000;
  const now = Date.now();
  if (ms <= now) return "now";
  const mins = Math.ceil((ms - now) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.ceil(mins / 60);
  return `${hours}h`;
}
