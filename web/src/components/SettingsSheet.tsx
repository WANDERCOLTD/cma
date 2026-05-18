import { ExternalLink, Github, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import type { RepoConfig } from "@/types";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: RepoConfig;
  onToggleKillSwitch: () => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  repo,
  onToggleKillSwitch,
}: SettingsSheetProps): JSX.Element {
  const { theme, toggle } = useTheme();

  const configJson = JSON.stringify(
    {
      disabled: repo.cmaDisabled,
      ratchet: ".ratchet.json",
      gate: {
        command: "npm run gate",
        timeoutMinutes: 30,
      },
      branchProtection: repo.branchProtectionEnabled,
      mergeQueue: repo.mergeQueueEnabled,
    },
    null,
    2,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configuration for {repo.owner}/{repo.name}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            <Section title="Repository">
              <Row label="Owner" value={repo.owner} />
              <Row label="Name" value={repo.name} />
              <Row label="cma version" value={repo.cmaVersion} mono />
              <Row
                label="Branch protection"
                value={
                  repo.branchProtectionEnabled ? (
                    <Badge variant="merged">on</Badge>
                  ) : (
                    <Badge variant="failed">off</Badge>
                  )
                }
              />
              <Row
                label="Merge queue"
                value={
                  repo.mergeQueueEnabled ? (
                    <Badge variant="merged">on</Badge>
                  ) : (
                    <Badge variant="idle">off</Badge>
                  )
                }
              />
            </Section>

            <Separator />

            <Section title="Kill switch">
              <p className="text-sm text-muted-foreground">
                When enabled, cma will refuse to merge anything until manually
                re-enabled. Equivalent to setting{" "}
                <code className="font-mono text-xs">CMA_DISABLE=1</code> or{" "}
                <code className="font-mono text-xs">.merge-agent.json</code>{" "}
                disabled flag.
              </p>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Disable cma</p>
                  <p className="text-xs text-muted-foreground">
                    Status:{" "}
                    {repo.cmaDisabled ? (
                      <span className="text-rose-400">ON — merges blocked</span>
                    ) : (
                      <span className="text-emerald-400">OFF — operational</span>
                    )}
                  </p>
                </div>
                <Button
                  variant={repo.cmaDisabled ? "destructive" : "outline"}
                  size="sm"
                  onClick={onToggleKillSwitch}
                >
                  {repo.cmaDisabled ? "Re-enable" : "Disable"}
                </Button>
              </div>
            </Section>

            <Separator />

            <Section title="Appearance">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">
                    {theme === "dark" ? "Dark mode" : "Light mode"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggle}>
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-4 w-4" /> Switch to light
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" /> Switch to dark
                    </>
                  )}
                </Button>
              </div>
            </Section>

            <Separator />

            <Section title=".merge-agent.json">
              <pre className="max-h-72 overflow-auto rounded-lg border border-border/60 bg-black/30 p-3 text-[11px] leading-relaxed font-mono text-muted-foreground">
                {configJson}
              </pre>
              <p className="text-xs text-muted-foreground">
                Read from repo root. Edit in the repository and commit to
                update.
              </p>
            </Section>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}/blob/main/.merge-agent.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" /> View on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>
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
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </div>
  );
}
