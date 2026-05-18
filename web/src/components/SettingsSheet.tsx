import { ExternalLink, Github, LogOut, Moon, Shield, Sun } from "lucide-react";
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
  onSignOut: () => void;
  isPublicMode: boolean;
}

export function SettingsSheet({
  open,
  onOpenChange,
  repo,
  onToggleKillSwitch,
  onSignOut,
  isPublicMode,
}: SettingsSheetProps): JSX.Element {
  const { theme, toggle } = useTheme();

  const repoSlug = `${repo.owner}/${repo.name}`;
  const ghBranchesUrl = `https://github.com/${repoSlug}/settings/branches`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configuration for {repoSlug}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            <Section title="Authentication">
              <Row
                label="Mode"
                value={
                  isPublicMode ? (
                    <Badge variant="idle">public (rate-limited)</Badge>
                  ) : (
                    <Badge variant="merged">authenticated</Badge>
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Tokens live in sessionStorage — closing the tab signs you out.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isPublicMode ? "Add / change token" : "Sign out"}
                </Button>
              </div>
            </Section>

            <Separator />

            <Section title="Repository">
              <Row label="Owner" value={repo.owner} />
              <Row label="Name" value={repo.name} />
              <Row label="4wd version" value={repo.fourWdVersion} mono />
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
              <div className="pt-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={ghBranchesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Shield className="h-4 w-4" /> Branch protection
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </Section>

            <Separator />

            <Section title="Kill switch">
              <p className="text-sm text-muted-foreground">
                When enabled, 4wd will refuse to merge anything until manually
                re-enabled. Equivalent to setting{" "}
                <code className="font-mono text-xs">FWD_DISABLE=1</code> or the{" "}
                <code className="font-mono text-xs">disabled</code> flag in{" "}
                <code className="font-mono text-xs">.4wd.json</code>.
              </p>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Disable 4wd</p>
                  <p className="text-xs text-muted-foreground">
                    Status:{" "}
                    {repo.fourWdDisabled ? (
                      <span className="text-rose-400">ON — merges blocked</span>
                    ) : (
                      <span className="text-emerald-400">OFF — operational</span>
                    )}
                  </p>
                </div>
                <Button
                  variant={repo.fourWdDisabled ? "destructive" : "outline"}
                  size="sm"
                  onClick={onToggleKillSwitch}
                  title="Read-only in v0.3 — toggling defers to v0.3.2"
                >
                  {repo.fourWdDisabled ? "Re-enable" : "Disable"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Read-only in v0.3 — write-back to{" "}
                <code className="font-mono">.4wd.json</code> lands in
                v0.3.2.
              </p>
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

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://github.com/${repoSlug}/blob/main/.4wd.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" /> View .4wd.json
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
