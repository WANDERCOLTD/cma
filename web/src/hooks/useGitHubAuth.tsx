import * as React from "react";

/**
 * GitHub PAT auth — sessionStorage only.
 *
 * Tokens arrive via one of:
 *   1. URL hash `#token=ghp_...` — consumed on mount, then stripped from URL.
 *   2. Manual paste through `setToken`.
 *   3. Pre-existing sessionStorage value from this tab session.
 *
 * Public mode (no token) is supported — Octokit will still hit unauthenticated
 * endpoints at 60 req/hr. The dashboard surfaces a banner in this case.
 */

const STORAGE_KEY = "cma-gh-token";

interface GitHubAuthContextValue {
  token: string | null;
  setToken: (t: string) => void;
  signOut: () => void;
  /** True when there is no token loaded. */
  isPublicMode: boolean;
}

const GitHubAuthContext = React.createContext<GitHubAuthContextValue | null>(
  null,
);

/**
 * Extract `token=<value>` from a hash fragment, returning the token and a
 * scrubbed hash (with that pair removed). Other hash params are preserved.
 */
function extractTokenFromHash(
  hash: string,
): { token: string | null; cleanHash: string } {
  if (!hash || hash.length < 2) return { token: null, cleanHash: hash };
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const token = params.get("token");
  if (!token) return { token: null, cleanHash: hash };
  params.delete("token");
  const remaining = params.toString();
  return {
    token,
    cleanHash: remaining ? `#${remaining}` : "",
  };
}

function readInitialToken(): string | null {
  if (typeof window === "undefined") return null;

  // Hash takes precedence — and is immediately consumed.
  const { token, cleanHash } = extractTokenFromHash(window.location.hash);
  if (token) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // ignore — storage disabled
    }
    // Strip the token from the address bar without touching path/search.
    const cleanUrl = `${window.location.pathname}${window.location.search}${cleanHash}`;
    window.history.replaceState(null, "", cleanUrl);
    return token;
  }

  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function GitHubAuthProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [token, setTokenState] = React.useState<string | null>(readInitialToken);

  const setToken = React.useCallback((t: string) => {
    const trimmed = t.trim();
    if (!trimmed) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore — storage disabled
    }
    setTokenState(trimmed);
  }, []);

  const signOut = React.useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setTokenState(null);
    // Reload to flush any in-flight queries and reset state.
    window.location.reload();
  }, []);

  const value = React.useMemo<GitHubAuthContextValue>(
    () => ({
      token,
      setToken,
      signOut,
      isPublicMode: !token,
    }),
    [token, setToken, signOut],
  );

  return (
    <GitHubAuthContext.Provider value={value}>
      {children}
    </GitHubAuthContext.Provider>
  );
}

export function useGitHubAuth(): GitHubAuthContextValue {
  const ctx = React.useContext(GitHubAuthContext);
  if (!ctx) {
    throw new Error(
      "useGitHubAuth must be used inside <GitHubAuthProvider>",
    );
  }
  return ctx;
}
