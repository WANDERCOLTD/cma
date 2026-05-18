import { AnimatePresence, motion } from "framer-motion";
import { GitBranch, Activity } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/StatusChip";
import { cn, formatRelative } from "@/lib/utils";
import type { QueueItem } from "@/types";

interface QueueProps {
  items: QueueItem[];
  loading?: boolean;
}

export function Queue({ items, loading = false }: QueueProps): JSX.Element {
  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2
          id="queue-heading"
          className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Queue
        </h2>
        <span className="text-xs text-muted-foreground">live</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Queue is empty — nothing in flight.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 sm:px-5",
                    item.status === "running" && "bg-sky-500/5",
                  )}
                >
                  {item.status === "running" && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5 bg-brand-gradient"
                    />
                  )}
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={item.author.avatarUrl}
                      alt={item.author.login}
                    />
                    <AvatarFallback>
                      {item.author.login.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{item.prNumber}
                      </span>
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      <span className="truncate font-mono">{item.branch}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">
                        {item.status === "queued"
                          ? "now"
                          : formatRelative(item.startedAt)}
                      </span>
                    </div>
                  </div>

                  <StatusChip status={item.status} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
