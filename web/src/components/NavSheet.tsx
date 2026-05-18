import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Github,
  PowerOff,
  Settings as SettingsIcon,
  Shield,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { formatRelative } from "@/lib/utils";
import type { MergeRecord, RepoConfig } from "@/types";

interface NavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: RepoConfig;
  recentMerges: MergeRecord[];
  onOpenSettings: () => void;
  onToggleKillSwitch: () => void;
}

export function NavSheet({
  open,
  onOpenChange,
  repo,
  recentMerges,
  onOpenSettings,
  onToggleKillSwitch,
}: NavSheetProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient text-[11px] font-bold tracking-tight text-white">
              c
            </span>
            4wd
          </SheetTitle>
          <SheetDescription>4WD — drift control for your main branch — v{repo.cmaVersion}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            <Section title="Repository">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-left hover:bg-accent/50"
              >
                <span className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {repo.owner}/{repo.name}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <p className="text-xs text-muted-foreground">
                Switching to multi-repo support in v0.3.1.
              </p>
            </Section>

            <Separator />

            <Section title="Status">
              <Row
                icon={<Shield className="h-4 w-4" />}
                label="Branch protection"
                trail={
                  repo.branchProtectionEnabled ? (
                    <Badge variant="merged">on</Badge>
                  ) : (
                    <Badge variant="failed">off</Badge>
                  )
                }
              />
              <Row
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Merge queue"
                trail={
                  repo.mergeQueueEnabled ? (
                    <Badge variant="merged">on</Badge>
                  ) : (
                    <Badge variant="idle">off</Badge>
                  )
                }
              />
              <Row
                icon={<PowerOff className="h-4 w-4" />}
                label="Kill switch"
                trail={
                  repo.fourWdDisabled ? (
                    <Badge variant="failed">on</Badge>
                  ) : (
                    <Badge variant="idle">off</Badge>
                  )
                }
              />
            </Section>

            <Separator />

            <Section title="Actions">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onOpenSettings}
              >
                <SettingsIcon className="h-4 w-4" /> Settings
              </Button>
              <Button
                variant={repo.fourWdDisabled ? "destructive" : "outline"}
                className="w-full justify-start"
                onClick={onToggleKillSwitch}
              >
                <PowerOff className="h-4 w-4" />
                {repo.fourWdDisabled ? "Re-enable 4wd" : "Trigger kill switch"}
              </Button>
            </Section>

            <Separator />

            <Section title="Recent activity">
              <ul className="space-y-2">
                {recentMerges.slice(0, 6).map((m) => (
                  <li
                    key={m.sha}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={m.author.avatarUrl}
                        alt={m.author.login}
                      />
                      <AvatarFallback className="text-[10px]">
                        {m.author.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(m.mergedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            Queue every 15s · merges every 60s
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  trail,
}: {
  icon: React.ReactNode;
  label: string;
  trail: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
      <span className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        <span>{label}</span>
      </span>
      {trail}
    </div>
  );
}
