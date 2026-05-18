import * as React from "react";
import { MergeDetailSheet } from "@/components/MergeDetailSheet";
import { NavSheet } from "@/components/NavSheet";
import { Queue } from "@/components/Queue";
import { RecentMerges } from "@/components/RecentMerges";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Toaster } from "@/components/Toaster";
import { TopBar } from "@/components/TopBar";
import { useToast } from "@/hooks/use-toast";
import {
  queueItems as mockQueue,
  recentMerges as mockMerges,
  repoConfig as mockRepo,
  signedInUser,
} from "@/data/mock";
import type { MergeRecord, RepoConfig } from "@/types";

export function App(): JSX.Element {
  const [repo, setRepo] = React.useState<RepoConfig>(mockRepo);
  const [navOpen, setNavOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [detailMerge, setDetailMerge] = React.useState<MergeRecord | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = React.useState(false);
  const { toast } = useToast();

  const handleSelectMerge = React.useCallback((m: MergeRecord) => {
    setDetailMerge(m);
    setDetailOpen(true);
  }, []);

  const handleToggleKillSwitch = React.useCallback(() => {
    setRepo((prev) => {
      const next = { ...prev, cmaDisabled: !prev.cmaDisabled };
      toast({
        title: next.cmaDisabled ? "Kill switch enabled" : "Kill switch off",
        description: next.cmaDisabled
          ? "cma will refuse to merge until re-enabled."
          : "cma is operational again.",
        variant: next.cmaDisabled ? "destructive" : "default",
      });
      return next;
    });
  }, [toast]);

  const handleSignOut = React.useCallback(() => {
    toast({
      title: "Sign out (mock)",
      description: "Real auth wiring lands in v0.3.1.",
    });
  }, [toast]);

  return (
    <div className="min-h-screen">
      <TopBar
        repo={repo}
        user={signedInUser}
        onOpenNav={() => setNavOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <Queue items={mockQueue} />
        <RecentMerges merges={mockMerges} onSelect={handleSelectMerge} />
      </main>

      <NavSheet
        open={navOpen}
        onOpenChange={setNavOpen}
        repo={repo}
        recentMerges={mockMerges}
        onOpenSettings={() => {
          setNavOpen(false);
          setSettingsOpen(true);
        }}
        onToggleKillSwitch={handleToggleKillSwitch}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        repo={repo}
        onToggleKillSwitch={handleToggleKillSwitch}
      />

      <MergeDetailSheet
        merge={detailMerge}
        repo={repo}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <Toaster />
    </div>
  );
}
