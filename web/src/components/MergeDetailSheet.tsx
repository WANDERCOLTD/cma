import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitCommit,
  Github,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusChip } from "@/components/StatusChip";
import { formatDuration, formatRelative } from "@/lib/utils";
import type { MergeRecord, RepoConfig } from "@/types";

interface MergeDetailSheetProps {
  merge: MergeRecord | null;
  repo: RepoConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MergeDetailSheet({
  merge,
  repo,
  open,
  onOpenChange,
}: MergeDetailSheetProps): JSX.Element {
  const [showGate, setShowGate] = React.useState(false);

  React.useEffect(() => {
    if (!open) setShowGate(false);
  }, [open]);

  const ghBase = `https://github.com/${repo.owner}/${repo.name}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        {merge && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <StatusChip status={merge.status} />
                <span className="text-xs font-mono text-muted-foreground">
                  {merge.shortSha}
                </span>
              </div>
              <SheetTitle className="pr-2 text-balance">
                {merge.title}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={merge.author.avatarUrl}
                    alt={merge.author.login}
                  />
                  <AvatarFallback>
                    {merge.author.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{merge.author.login}</span>
                <span>·</span>
                <span>{formatRelative(merge.mergedAt)}</span>
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="space-y-6 p-6">
                <DetailSection title="Branch">
                  <div className="flex items-center gap-2 text-sm">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <code className="font-mono text-sm">{merge.branch}</code>
                  </div>
                </DetailSection>

                <DetailSection title="Gate">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDuration(merge.gateSeconds)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      finished {formatRelative(merge.mergedAt)}
                    </span>
                  </div>
                  {merge.gateLog && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
                      <button
                        type="button"
                        onClick={() => setShowGate((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50"
                      >
                        <span>Gate log</span>
                        {showGate ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {showGate && (
                        <pre className="max-h-72 overflow-auto bg-black/30 p-3 text-[11px] leading-relaxed font-mono text-emerald-200/90">
                          {merge.gateLog}
                        </pre>
                      )}
                    </div>
                  )}
                </DetailSection>

                {merge.ratchetDelta && merge.ratchetDelta.length > 0 && (
                  <DetailSection title="Ratchet delta">
                    <ul className="space-y-2">
                      {merge.ratchetDelta.map((d) => {
                        const up = d.after > d.before;
                        return (
                          <li
                            key={d.metric}
                            className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-sm"
                          >
                            <span className="font-mono">{d.metric}</span>
                            <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                              {up ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-sky-400" />
                              )}
                              <span>{d.before}</span>
                              <span className="text-muted-foreground/60">
                                →
                              </span>
                              <span className="text-foreground">{d.after}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </DetailSection>
                )}

                {merge.commits && merge.commits.length > 0 && (
                  <DetailSection
                    title={`Commits (${merge.commits.length})`}
                  >
                    <ul className="space-y-2">
                      {merge.commits.map((c) => (
                        <li
                          key={c.sha}
                          className="flex items-start gap-2 text-sm"
                        >
                          <GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <a
                            href={`${ghBase}/commit/${c.sha}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {c.shortSha}
                          </a>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="line-clamp-1 text-sm">
                            {c.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </DetailSection>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {merge.prNumber !== undefined && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <a
                        href={`${ghBase}/pull/${merge.prNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="h-4 w-4" /> PR #{merge.prNumber}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`${ghBase}/commit/${merge.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GitCommit className="h-4 w-4" /> Commit
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  {merge.ratchetDelta && merge.ratchetDelta.length > 0 && (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`${ghBase}/commits/main/.ratchet.json`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <TrendingUp className="h-4 w-4" /> Ratchet
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
