import * as React from "react";
import { ExternalLink, Github, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";

interface SetupScreenProps {
  /** Repo param from the URL, if present. */
  repoSlug?: string | null;
  /** Continue without setting a token (public mode). */
  onContinuePublic?: () => void;
}

const NEW_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=repo,read:org&description=4wd+dashboard";

/**
 * First-run screen — shown when the user has no token and hasn't opted into
 * public mode. Lets them paste a PAT or skip into rate-limited public mode.
 */
export function SetupScreen({
  repoSlug,
  onContinuePublic,
}: SetupScreenProps): JSX.Element {
  const { setToken } = useGitHubAuth();
  const [value, setValue] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setToken(trimmed);
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-gradient text-sm font-bold tracking-tight text-white shadow-sm">
            c
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              4wd dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              {repoSlug
                ? `Connect to ${repoSlug}`
                : "Connect to a GitHub repository"}
            </p>
          </div>
        </div>

        <Card className="glass space-y-5 p-6">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Paste a GitHub personal access token
            </h2>
            <p className="text-sm text-muted-foreground">
              Stored only in this browser tab&apos;s sessionStorage — closing
              the tab signs you out. The dashboard never sends your token to
              a server other than GitHub.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="relative block">
              <span className="sr-only">GitHub token</span>
              <input
                type={revealed ? "text" : "password"}
                placeholder="ghp_..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background/60 px-3 py-2 pr-10 text-sm font-mono outline-none ring-offset-background transition-all placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? "Hide token" : "Reveal token"}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="gradient" disabled={!value.trim()}>
                Connect
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={NEW_TOKEN_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" /> Create token
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required scopes:{" "}
              <code className="font-mono">repo</code>,{" "}
              <code className="font-mono">read:org</code>.
            </p>
          </form>
        </Card>

        <div className="rounded-xl border border-border/40 p-4">
          <h3 className="text-sm font-medium">Or continue without a token</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Public mode works for public repos only and is rate-limited to
            60 requests / hour. Suitable for a quick look.
          </p>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onContinuePublic}
              disabled={!onContinuePublic}
            >
              Continue in public mode
            </Button>
          </div>
        </div>

        {!repoSlug && (
          <p className="text-xs text-muted-foreground">
            You&apos;ll pick a repository after connecting.
          </p>
        )}
      </div>
    </div>
  );
}
