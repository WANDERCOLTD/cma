import { motion } from "framer-motion";
import {
  ArrowUpRight,
  GitBranch,
  GitCommit,
  History,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/StatusChip";
import { formatDuration, formatRelative } from "@/lib/utils";
import type { MergeRecord } from "@/types";

interface RecentMergesProps {
  merges: MergeRecord[];
  loading?: boolean;
  onSelect: (m: MergeRecord) => void;
}

export function RecentMerges({
  merges,
  loading = false,
  onSelect,
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
      </div>

      {loading ? (
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
      ) : (
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
                    <AvatarImage
                      src={m.author.avatarUrl}
                      alt={m.author.login}
                    />
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
      )}
    </section>
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
