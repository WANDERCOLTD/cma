import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GitBranch,
  GitMerge,
  Lock,
  LogOut,
  Unlock,
} from "lucide-react";
import { classifyGitHubError } from "@/lib/github";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { useSignedInUser } from "@/hooks/useSignedInUser";
import { useUserRepos, type UserRepoSummary } from "@/hooks/useUserRepos";
import { formatRelative, cn } from "@/lib/utils";

const REPO_SLUG_RE = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;

const SELECTED_REPO_KEY = "cma:selectedRepo";

interface RepoPickerScreenProps {
  /** Public-mode users can only paste a slug — no listing. */
  isPublicMode: boolean;
}

/**
 * Push `?repo=<slug>` into the URL and reload-via-pushState. The App listens
 * to `popstate` (and we dispatch one) so the dashboard re-mounts with the
 * new scope without a full page navigation.
 */
function navigateToRepo(slug: string): void {
  try {
    window.sessionStorage.setItem(SELECTED_REPO_KEY, slug);
  } catch {
    // ignore — storage disabled
  }
  const url = new URL(window.location.href);
  url.searchParams.set("repo", slug);
  window.history.pushState(null, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Read the stashed slug from sessionStorage. The App uses this to auto-route
 * a returning user without an explicit click.
 */
export function readStoredRepoSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SELECTED_REPO_KEY);
  } catch {
    return null;
  }
}

function RepoRow({
  repo,
  onSelect,
}: {
  repo: UserRepoSummary;
  onSelect: (slug: string) => void;
}): JSX.Element {
  return (
    <CommandItem
      // cmdk searches against `value` — set it to the full slug + description
      // so the user can filter on either.
      value={`${repo.fullName} ${repo.description ?? ""}`}
      onSelect={() => onSelect(repo.fullName)}
      className="gap-3"
    >
      <Avatar className="h-6 w-6">
        <AvatarImage src={repo.owner.avatarUrl} alt={repo.owner.login} />
        <AvatarFallback>
          {repo.owner.login.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {repo.fullName}
          </span>
        </div>
        {repo.description && (
          <span className="truncate text-xs text-muted-foreground">
            {repo.description}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {repo.hasMergeQueue && (
          <Badge variant="merged" className="gap-1 px-2 py-0">
            <GitMerge className="h-3 w-3" />
            queue
          </Badge>
        )}
        <Badge variant="outline" className="gap-1 px-2 py-0">
          {repo.isPrivate ? (
            <>
              <Lock className="h-3 w-3" />
              Private
            </>
          ) : (
            <>
              <Unlock className="h-3 w-3" />
              Public
            </>
          )}
        </Badge>
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
          {formatRelative(repo.pushedAt)}
        </span>
      </div>
    </CommandItem>
  );
}

interface RepoListProps {
  repos: UserRepoSummary[];
  emptyHint: string;
  onSelect: (slug: string) => void;
}

function RepoList({ repos, emptyHint, onSelect }: RepoListProps): JSX.Element {
  return (
    <CommandList>
      <CommandEmpty>{emptyHint}</CommandEmpty>
      <CommandGroup>
        {repos.map((r) => (
          <RepoRow key={r.id} repo={r} onSelect={onSelect} />
        ))}
      </CommandGroup>
    </CommandList>
  );
}

function ManualPasteRow({
  onSubmit,
}: {
  onSubmit: (slug: string) => void;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const trimmed = value.trim();
  const valid = REPO_SLUG_RE.test(trimmed);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    onSubmit(trimmed);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Or paste a repo path
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="owner/name"
        autoComplete="off"
        spellCheck={false}
        className="w-48 rounded-md border border-border bg-background/60 px-2 py-1 text-xs font-mono outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <Button
        type="submit"
        size="sm"
        variant="gradient"
        disabled={!valid}
        className="h-7 px-3 text-xs"
      >
        Go
        <ArrowRight className="h-3 w-3" />
      </Button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setValue("");
        }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </form>
  );
}

function PublicModePicker({
  onSelect,
}: {
  onSelect: (slug: string) => void;
}): JSX.Element {
  const [value, setValue] = React.useState("");
  const trimmed = value.trim();
  const valid = REPO_SLUG_RE.test(trimmed);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    onSelect(trimmed);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="sr-only">Repository owner/name</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/name"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm font-mono outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="gradient" disabled={!valid}>
          Open repo
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Public mode — you can view any public repo.
        </p>
      </div>
    </form>
  );
}

interface OrgTabValue {
  login: string;
  avatarUrl: string;
  repos: UserRepoSummary[];
}

function groupRepos(
  repos: UserRepoSummary[],
  viewerLogin: string | undefined,
): { owned: UserRepoSummary[]; orgs: OrgTabValue[] } {
  const owned: UserRepoSummary[] = [];
  const orgBuckets = new Map<string, OrgTabValue>();

  for (const r of repos) {
    if (viewerLogin && r.owner.login === viewerLogin) {
      owned.push(r);
      continue;
    }
    if (r.owner.type === "Organization") {
      const bucket = orgBuckets.get(r.owner.login) ?? {
        login: r.owner.login,
        avatarUrl: r.owner.avatarUrl,
        repos: [],
      };
      bucket.repos.push(r);
      orgBuckets.set(r.owner.login, bucket);
    } else if (!viewerLogin) {
      // Fallback when we haven't loaded viewer yet — treat user-owned repos
      // we'd otherwise lose as "owned".
      owned.push(r);
    }
  }

  const orgs = Array.from(orgBuckets.values()).sort((a, b) =>
    a.login.localeCompare(b.login),
  );
  return { owned, orgs };
}

export function RepoPickerScreen({
  isPublicMode,
}: RepoPickerScreenProps): JSX.Element {
  const { signOut } = useGitHubAuth();
  const { toast } = useToast();
  const reposQuery = useUserRepos();
  const viewerQuery = useSignedInUser();

  // 401: token is bad — clear it (which reloads into the SetupScreen).
  React.useEffect(() => {
    const err = reposQuery.error ?? viewerQuery.error;
    if (!err) return;
    const info = classifyGitHubError(err);
    if (info?.status === 401) {
      toast({
        title: "Token invalid",
        description: "Your GitHub token was rejected — sign in again.",
        variant: "destructive",
      });
      signOut();
    } else if (info?.rateLimited) {
      toast({
        title: "Rate-limited by GitHub",
        description:
          "Couldn't list your repos. Paste an owner/name to view a specific repo.",
        variant: "destructive",
      });
    }
  }, [reposQuery.error, viewerQuery.error, signOut, toast]);

  const repos = React.useMemo(() => reposQuery.data ?? [], [reposQuery.data]);
  const viewerLogin = viewerQuery.data?.login;
  const { owned, orgs } = React.useMemo(
    () => groupRepos(repos, viewerLogin),
    [repos, viewerLogin],
  );

  const handleSelect = React.useCallback((slug: string) => {
    navigateToRepo(slug);
  }, []);

  // Global keyboard shortcuts: `/` focuses search.
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (isPublicMode) return;
    const onKey = (e: KeyboardEvent): void => {
      // Ignore when typing in an input/textarea.
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPublicMode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="min-h-screen px-4 py-10 sm:px-6"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-gradient text-sm font-bold tracking-tight text-white shadow-sm">
              c
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Pick a repository
              </h1>
              <p className="text-sm text-muted-foreground">
                {isPublicMode
                  ? "Public mode — paste a repo to view."
                  : "Your recently-pushed repos appear first."}
              </p>
            </div>
          </div>
          {!isPublicMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>

        {isPublicMode ? (
          <Card className="glass space-y-5 p-6">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Open a public repo
              </h2>
              <p className="text-sm text-muted-foreground">
                Public mode can&apos;t list your repos — paste an{" "}
                <code className="font-mono">owner/name</code> to open one.
              </p>
            </div>
            <PublicModePicker onSelect={handleSelect} />
          </Card>
        ) : (
          <PickerCard
            owned={owned}
            orgs={orgs}
            recent={repos}
            inputRef={inputRef}
            isLoading={reposQuery.isLoading}
            error={reposQuery.error}
            onSelect={handleSelect}
          />
        )}
      </div>
    </motion.div>
  );
}

interface PickerCardProps {
  owned: UserRepoSummary[];
  orgs: OrgTabValue[];
  recent: UserRepoSummary[];
  inputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
  error: unknown;
  onSelect: (slug: string) => void;
}

function PickerCard({
  owned,
  orgs,
  recent,
  inputRef,
  isLoading,
  error,
  onSelect,
}: PickerCardProps): JSX.Element {
  const [tab, setTab] = React.useState<string>("recent");
  // Re-mount the Command per tab so the filtered list resets cleanly.
  return (
    <Card className="glass space-y-4 p-4 sm:p-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap gap-1 bg-muted/30 p-1">
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="owned">Owned</TabsTrigger>
          {orgs.map((o) => (
            <TabsTrigger key={o.login} value={`org:${o.login}`}>
              {o.login}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="recent" className="mt-3">
          <PickerBody
            key="recent"
            inputRef={tab === "recent" ? inputRef : undefined}
            isLoading={isLoading}
            error={error}
            repos={recent}
            emptyHint="No repos found in your account. Paste an owner/name to view a public one."
            onSelect={onSelect}
          />
        </TabsContent>

        <TabsContent value="owned" className="mt-3">
          <PickerBody
            key="owned"
            inputRef={tab === "owned" ? inputRef : undefined}
            isLoading={isLoading}
            error={error}
            repos={owned}
            emptyHint="No repos owned by you in the first page of results."
            onSelect={onSelect}
          />
        </TabsContent>

        {orgs.map((o) => (
          <TabsContent
            key={o.login}
            value={`org:${o.login}`}
            className="mt-3"
          >
            <PickerBody
              key={`org:${o.login}`}
              inputRef={tab === `org:${o.login}` ? inputRef : undefined}
              isLoading={isLoading}
              error={error}
              repos={o.repos}
              emptyHint={`No repos in ${o.login} in the first page.`}
              onSelect={onSelect}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <ManualPasteRow onSubmit={onSelect} />
        <span className="text-xs text-muted-foreground">
          <kbd className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[10px]">
            /
          </kbd>{" "}
          search ·{" "}
          <kbd className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>{" "}
          open
        </span>
      </div>
    </Card>
  );
}

interface PickerBodyProps {
  inputRef: React.RefObject<HTMLInputElement> | undefined;
  isLoading: boolean;
  error: unknown;
  repos: UserRepoSummary[];
  emptyHint: string;
  onSelect: (slug: string) => void;
}

function PickerBody({
  inputRef,
  isLoading,
  error,
  repos,
  emptyHint,
  onSelect,
}: PickerBodyProps): JSX.Element {
  if (error) {
    return (
      <div className={cn("rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200")}>
        Couldn&apos;t load your repos. Try again or paste a repo path below.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-2 px-1 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-muted/30"
          />
        ))}
      </div>
    );
  }
  return (
    <Command shouldFilter loop>
      <CommandInput
        ref={inputRef}
        placeholder="Filter your repos…"
      />
      <RepoList repos={repos} emptyHint={emptyHint} onSelect={onSelect} />
    </Command>
  );
}
