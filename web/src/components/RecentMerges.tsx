import { motion } from "framer-motion";
import {
  ArrowUpRight,
  GitBranch,
  GitCommit,
  History,
  LayoutGrid,
  List as ListIcon,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/StatusChip";
import { cn, formatDuration, formatRelative } from "@/lib/utils";
import type { RecentMergesView } from "@/lib/personal-settings";
import type { MergeRecord } from "@/types";

interface RecentMergesProps {
  merges: MergeRecord[];
  loading?: boolean;
  onSelect: (m: MergeRecord) => void;
  view: RecentMergesView;
  onViewChange: (v: RecentMergesView) => void;
}

export function RecentMerges({
  merges,
  loading = false,
  onSelect,
  view,
  onViewChange,
}: RecentMergesProps): JSX.Element {
  return (
    <section aria-labelledby="recent-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2
          id="recent-heading"
          className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Recent merges
        </h2>
        <span className="text-xs text-muted-foreground">last {merges.length}</span>
        <div className="ml-auto">
          <ViewToggle value={view} onChange={onViewChange} />
        </div>
      </div>

      {loading ? (
        view === "list" ? (
          <ListSkeleton />
        ) : (
          <GridSkeleton />
        )
      ) : view === "list" ? (
        <MergeList merges={merges} onSelect={onSelect} />
      ) : (
        <MergeGrid merges={merges} onSelect={onSelect} />
      )}
    </section>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: RecentMergesView;
  onChange: (v: RecentMergesView) => void;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Recent merges view"
      className="inline-flex items-center rounded-md border border-border/60 bg-background/40 p-0.5"
    >
      <ToggleButton
        active={value === "card"}
        onClick={() => onChange("card")}
        label="Card view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </ToggleButton>
      <ToggleButton
        active={value === "list"}
        onClick={() => onChange("list")}
        label="List view"
      >
        <ListIcon className="h-3.5 w-3.5" />
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-6 w-7 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
      )}
    >
      {children}
    </button>
  );
}

function MergeGrid({
  merges,
  onSelect,
}: {
  merges: MergeRecord[];
  onSelect: (m: MergeRecord) => void;
}): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {merges.map((m, idx) => (
        <motion.button
          key={m.sha}
          type="button"
          onClick={() => onSelect(m)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: Math.min(idx * 0.015, 0.2) }}
          whileHover={{ y: -2 }}
          className="group text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Card className="glass h-full p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={m.author.avatarUrl} alt={m.author.login} />
                <AvatarFallback>
                  {m.author.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-balance">
                    {m.title}
                  </p>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">@{m.author.login}</span>
                  <span>·</span>
                  <span>{formatRelative(m.mergedAt)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3 w-3 shrink-0" />
                <span className="truncate font-mono">{m.branch}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitCommit className="h-3 w-3 shrink-0" />
                <span className="font-mono">{m.shortSha}</span>
                <span>·</span>
                <Timer className="h-3 w-3 shrink-0" />
                <span>{formatDuration(m.gateSeconds)} gate</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <RatchetSummary m={m} />
              <StatusChip status={m.status} />
            </div>
          </Card>
        </motion.button>
      ))}
    </div>
  );
}

function MergeList({
  merges,
  onSelect,
}: {
  merges: MergeRecord[];
  onSelect: (m: MergeRecord) => void;
}): JSX.Element {
  return (
    <Card className="glass overflow-hidden p-0">
      <ul role="list" className="divide-y divide-border/60">
        {merges.map((m, idx) => (
          <motion.li
            key={m.sha}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(idx * 0.01, 0.15) }}
          >
            <button
              type="button"
              onClick={() => onSelect(m)}
              className="group flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={m.author.avatarUrl} alt={m.author.login} />
                <AvatarFallback className="text-[10px]">
                  {m.author.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {m.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">@{m.author.login}</span>
                  <span>·</span>
                  <GitBranch className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">{m.branch}</span>
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
                <GitCommit className="h-3 w-3" />
                <span className="font-mono">{m.shortSha}</span>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
                <Timer className="h-3 w-3" />
                <span>{formatDuration(m.gateSeconds)}</span>
              </div>

              <div className="hidden shrink-0 xl:block">
                <RatchetSummary m={m} />
              </div>

              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {formatRelative(m.mergedAt)}
              </span>

              <StatusChip status={m.status} />

              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}

function GridSkeleton(): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="glass p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

function ListSkeleton(): JSX.Element {
  return (
    <Card className="glass overflow-hidden p-0">
      <ul role="list" className="divide-y divide-border/60">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3 w-16" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RatchetSummary({ m }: { m: MergeRecord }): JSX.Element {
  if (!m.ratchetDelta || m.ratchetDelta.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/70">no ratchet delta</span>
    );
  }
  const first = m.ratchetDelta[0];
  const up = first.after > first.before;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {up ? (
        <TrendingUp className="h-3 w-3 text-emerald-400" />
      ) : (
        <TrendingDown className="h-3 w-3 text-sky-400" />
      )}
      <span className="font-mono">{first.metric}</span>
      <span className="font-mono">
        {first.before} → {first.after}
      </span>
      {m.ratchetDelta.length > 1 && (
        <span className="ml-1 text-muted-foreground/60">
          +{m.ratchetDelta.length - 1}
        </span>
      )}
    </span>
  );
}
