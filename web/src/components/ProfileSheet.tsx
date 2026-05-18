import * as React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Compass,
  ExternalLink,
  Github,
  LogOut,
  Moon,
  Shield,
  Sun,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { useConfiguredRepos } from "@/hooks/useConfiguredRepos";
import {
  useAggregateStats,
  type RatchetTrend,
} from "@/hooks/useAggregateStats";
import {
  POLL_BOUNDS,
  usePersonalSettings,
} from "@/lib/personal-settings";
import { cn, formatDuration, formatRelative } from "@/lib/utils";
import type { ConfiguredRepo, SignedInUser } from "@/types";

const SELECTED_REPO_KEY = "4wd:selectedRepo";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SignedInUser;
  /** Optional viewer bio surfaced from the signed-in-user fetch. */
  bio?: string | null;
  htmlUrl?: string;
  isPublicMode: boolean;
  onSignOut: () => void;
}

/**
 * Switch the dashboard scope to `slug` without a full page navigation. Mirrors
 * the helper in `RepoPickerScreen.tsx` — kept inline here to avoid an export
 * shape we'd then need to maintain in two places.
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

export function ProfileSheet({
  open,
  onOpenChange,
  user,
  bio,
  htmlUrl,
  isPublicMode,
  onSignOut,
}: ProfileSheetProps): JSX.Element {
  const { theme, toggle } = useTheme();
  const {
    settings,
    setDefaultRepoSlug,
    setQueuePollSeconds,
    setMergesPollSeconds,
  } = usePersonalSettings();

  const configured = useConfiguredRepos();
  const stats = useAggregateStats(configured.repos);

  const profileUrl = htmlUrl ?? `https://github.com/${user.login}`;

  const handlePickRepo = React.useCallback((slug: string) => {
    navigateToRepo(slug);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
          <SheetDescription>
            Your 4WD usage at a glance.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-7 p-6">
            <IdentityHeader
              user={user}
              bio={bio}
              profileUrl={profileUrl}
            />

            <Separator />

            <ConfiguredReposSection
              isPublicMode={isPublicMode}
              repos={configured.repos}
              isLoading={configured.isLoading}
              error={configured.error}
              onPick={handlePickRepo}
            />

            <Separator />

            <AggregateStatsSection
              hasRepos={configured.repos.length > 0}
              isLoading={stats.isLoading}
              data={stats.data}
            />

            <Separator />

            <PersonalSettingsSection
              theme={theme}
              onToggleTheme={toggle}
              repos={configured.repos}
              defaultRepoSlug={settings.defaultRepoSlug}
              onChangeDefaultRepo={setDefaultRepoSlug}
              queuePollSeconds={settings.queuePollSeconds}
              mergesPollSeconds={settings.mergesPollSeconds}
              onChangeQueuePoll={setQueuePollSeconds}
              onChangeMergesPoll={setMergesPollSeconds}
            />

            <Separator />

            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                className="w-full justify-center text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                {isPublicMode ? "Add / change token" : "Sign out"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

function IdentityHeader({
  user,
  bio,
  profileUrl,
}: {
  user: SignedInUser;
  bio?: string | null;
  profileUrl: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-4">
      <div className="relative shrink-0">
        {/* Glow ring — soft brand gradient halo. */}
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full bg-brand-gradient opacity-50 blur-md"
        />
        <Avatar className="relative h-20 w-20 ring-2 ring-background">
          <AvatarImage src={user.avatarUrl} alt={user.login} />
          <AvatarFallback className="text-lg">
            {user.login.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="min-w-0 flex-1 space-y-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {user.name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              @{user.login}
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Open on GitHub"
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            <a href={profileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
        {bio && (
          <p className="line-clamp-2 text-xs text-muted-foreground/90">
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configured repos
// ---------------------------------------------------------------------------

function ConfiguredReposSection({
  isPublicMode,
  repos,
  isLoading,
  error,
  onPick,
}: {
  isPublicMode: boolean;
  repos: ConfiguredRepo[];
  isLoading: boolean;
  error: unknown;
  onPick: (slug: string) => void;
}): JSX.Element {
  return (
    <Section title="Repos using 4WD" count={repos.length}>
      {isPublicMode ? (
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title="Sign in to discover repos"
          hint="Code-search requires a GitHub token — public mode can only view a single repo at a time."
        />
      ) : error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
          Couldn&apos;t load your 4WD repos. Code-search may be rate-limited —
          try again in a minute.
        </div>
      ) : isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full" />
            </li>
          ))}
        </ul>
      ) : repos.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title="No 4WD repos yet"
          hint="Run /4wd:init in a repo to scaffold .4wd.json — it'll show up here within a few minutes."
        />
      ) : (
        <ul className="space-y-2">
          {repos.map((r) => (
            <ConfiguredRepoCard key={r.fullName} repo={r} onPick={onPick} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ConfiguredRepoCard({
  repo,
  onPick,
}: {
  repo: ConfiguredRepo;
  onPick: (slug: string) => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(repo.fullName)}
        className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-left transition-colors hover:border-border hover:bg-accent/40"
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={repo.owner.avatarUrl} alt={repo.owner.login} />
          <AvatarFallback>
            {repo.owner.login.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {repo.fullName}
            </span>
            {repo.branchProtectionEnabled !== undefined && (
              <Badge
                variant={
                  repo.branchProtectionEnabled ? "merged" : "failed"
                }
                className="gap-1 px-1.5 py-0 text-[10px]"
              >
                <Shield className="h-2.5 w-2.5" />
                {repo.branchProtectionEnabled ? "on" : "off"}
              </Badge>
            )}
          </div>
          {repo.description && (
            <p className="truncate text-xs text-muted-foreground">
              {repo.description}
            </p>
          )}
          {repo.pushedAt && (
            <p className="text-[11px] text-muted-foreground/80">
              {formatRelative(repo.pushedAt)}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

function AggregateStatsSection({
  hasRepos,
  isLoading,
  data,
}: {
  hasRepos: boolean;
  isLoading: boolean;
  data:
    | {
        mergesThisWeek: number;
        meanGateSeconds: number;
        gatePassRate: number;
        trends: Array<{ fullName: string; trend: RatchetTrend }>;
      }
    | undefined;
}): JSX.Element {
  // TODO(v1.2): proper ratchet history — needs a server-side merge-log endpoint.
  // The current trend is a "commits vs prior week" heuristic only.
  return (
    <Section title="This week">
      {!hasRepos ? (
        <p className="text-xs text-muted-foreground">
          Stats appear once you have at least one 4WD repo.
        </p>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StatTile
              label="Merges this week"
              value={String(data.mergesThisWeek)}
              tint="primary"
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Mean gate"
              value={
                data.meanGateSeconds > 0
                  ? formatDuration(data.meanGateSeconds)
                  : "—"
              }
              tint="sky"
              icon={<Timer className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Gate pass-rate"
              value={`${Math.round(data.gatePassRate * 100)}%`}
              tint="emerald"
              icon={<Shield className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Repos tracked"
              value={String(data.trends.length)}
              tint="amber"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
          </div>
          {data.trends.length > 0 && (
            <TrendsList trends={data.trends} />
          )}
        </>
      )}
    </Section>
  );
}

type Tint = "primary" | "sky" | "emerald" | "amber";

const TILE_TINTS: Record<Tint, { bg: string; ring: string; text: string }> = {
  primary: {
    bg: "bg-[linear-gradient(135deg,_color-mix(in_oklab,_hsl(var(--primary))_18%,_transparent)_0%,_transparent_70%)]",
    ring: "ring-primary/20",
    text: "text-primary",
  },
  sky: {
    bg: "bg-[linear-gradient(135deg,_color-mix(in_oklab,_hsl(220_90%_60%)_18%,_transparent)_0%,_transparent_70%)]",
    ring: "ring-sky-400/20",
    text: "text-sky-300",
  },
  emerald: {
    bg: "bg-[linear-gradient(135deg,_color-mix(in_oklab,_hsl(160_70%_45%)_18%,_transparent)_0%,_transparent_70%)]",
    ring: "ring-emerald-400/20",
    text: "text-emerald-300",
  },
  amber: {
    bg: "bg-[linear-gradient(135deg,_color-mix(in_oklab,_hsl(35_95%_60%)_18%,_transparent)_0%,_transparent_70%)]",
    ring: "ring-amber-400/20",
    text: "text-amber-300",
  },
};

function StatTile({
  label,
  value,
  tint,
  icon,
}: {
  label: string;
  value: string;
  tint: Tint;
  icon: React.ReactNode;
}): JSX.Element {
  const t = TILE_TINTS[tint];
  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-xl p-3 ring-1",
        t.ring,
      )}
    >
      <span aria-hidden className={cn("pointer-events-none absolute inset-0", t.bg)} />
      <div className="relative">
        <div className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider", t.text)}>
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function TrendsList({
  trends,
}: {
  trends: Array<{ fullName: string; trend: RatchetTrend }>;
}): JSX.Element {
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Trend (vs prior week)
      </p>
      <ul className="space-y-1">
        {trends.map((t) => (
          <li
            key={t.fullName}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="truncate font-mono text-muted-foreground">
              {t.fullName}
            </span>
            <TrendChip trend={t.trend} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendChip({ trend }: { trend: RatchetTrend }): JSX.Element {
  // Down is good for warning counts — match the existing ratchet metric
  // direction. Improving = down arrow + emerald.
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
        <ArrowDownRight className="h-3 w-3" />
        improving
      </span>
    );
  }
  if (trend === "regressing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
        <ArrowUpRight className="h-3 w-3" />
        regressing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-300">
      <ArrowRight className="h-3 w-3" />
      stable
    </span>
  );
}

// ---------------------------------------------------------------------------
// Personal settings
// ---------------------------------------------------------------------------

function PersonalSettingsSection({
  theme,
  onToggleTheme,
  repos,
  defaultRepoSlug,
  onChangeDefaultRepo,
  queuePollSeconds,
  mergesPollSeconds,
  onChangeQueuePoll,
  onChangeMergesPoll,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  repos: ConfiguredRepo[];
  defaultRepoSlug: string | null;
  onChangeDefaultRepo: (slug: string | null) => void;
  queuePollSeconds: number;
  mergesPollSeconds: number;
  onChangeQueuePoll: (n: number) => void;
  onChangeMergesPoll: (n: number) => void;
}): JSX.Element {
  return (
    <Section title="Personal settings">
      <div className="space-y-3">
        {/* Theme */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onToggleTheme}>
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" /> Light
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" /> Dark
              </>
            )}
          </Button>
        </div>

        {/* Default repo */}
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Default repo</p>
            <Github className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Where to land when you open the dashboard.
          </p>
          <select
            value={defaultRepoSlug ?? ""}
            onChange={(e) =>
              onChangeDefaultRepo(e.target.value === "" ? null : e.target.value)
            }
            className="mt-2 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Last visited</option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Polling */}
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-sm font-medium">Polling intervals</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How often the dashboard refreshes from GitHub.
          </p>
          <div className="mt-3 space-y-3">
            <SliderRow
              label="Queue"
              value={queuePollSeconds}
              min={POLL_BOUNDS.queueMin}
              max={POLL_BOUNDS.queueMax}
              onChange={onChangeQueuePoll}
            />
            <SliderRow
              label="Recent merges"
              value={mergesPollSeconds}
              min={POLL_BOUNDS.mergesMin}
              max={POLL_BOUNDS.mergesMax}
              onChange={onChangeMergesPoll}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}): JSX.Element {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">
          every {value}s
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-xl p-5 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-white shadow-sm">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-[28ch] text-xs text-muted-foreground">{hint}</p>
      <code className="mt-1 rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        /4wd:init
      </code>
    </div>
  );
}
