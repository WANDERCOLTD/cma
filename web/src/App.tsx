import * as React from "react";
import { MergeDetailSheet } from "@/components/MergeDetailSheet";
import { NavSheet } from "@/components/NavSheet";
import { Queue } from "@/components/Queue";
import { RecentMerges } from "@/components/RecentMerges";
import {
  RepoPickerScreen,
  readStoredRepoSlug,
} from "@/components/RepoPickerScreen";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SetupScreen } from "@/components/SetupScreen";
import { Toaster } from "@/components/Toaster";
import { TopBar } from "@/components/TopBar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { useGitHubAuth } from "@/hooks/useGitHubAuth";
import { useRecentMerges } from "@/hooks/useRecentMerges";
import { useQueueState } from "@/hooks/useQueueState";
import { useRepoConfig } from "@/hooks/useRepoConfig";
import { useSignedInUser } from "@/hooks/useSignedInUser";
import { useToast } from "@/hooks/use-toast";
import {
  classifyGitHubError,
  formatResetTime,
  parseRepoFromUrl,
} from "@/lib/github";
import type { MergeRecord, RepoConfig, SignedInUser } from "@/types";

const PUBLIC_MODE_ACK_KEY = "4wd-public-mode-ack";

const FALLBACK_REPO: RepoConfig = {
  owner: "",
  name: "",
  branchProtectionEnabled: false,
  mergeQueueEnabled: false,
  fourWdDisabled: false,
  cmaVersion: __CMA_DASHBOARD_VERSION__,
};

const FALLBACK_USER: SignedInUser = {
  login: "guest",
  name: "Public mode",
  avatarUrl: "",
};

export function App(): JSX.Element {
  const { isPublicMode, signOut } = useGitHubAuth();
  const { toast } = useToast();

  // Re-read the URL on history changes (the RepoPickerScreen uses pushState +
  // a synthetic popstate to navigate without a full reload).
  const [searchTick, setSearchTick] = React.useState(0);
  React.useEffect(() => {
    const onPop = (): void => setSearchTick((n) => n + 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const repoSlug = React.useMemo(() => parseRepoFromUrl(), [searchTick]);

  // Auto-rehydrate: if the user picked a repo earlier this session and we
  // don't have one in the URL, jump straight to it. Saves a click.
  React.useEffect(() => {
    if (repoSlug) return;
    const stored = readStoredRepoSlug();
    if (!stored) return;
    const url = new URL(window.location.href);
    url.searchParams.set("repo", stored);
    window.history.replaceState(null, "", url.toString());
    setSearchTick((n) => n + 1);
  }, [repoSlug]);

  // Track whether the user has explicitly chosen public mode. Distinct from
  // "no token in storage yet" — without an ack, we still show the setup screen.
  const [publicAck, setPublicAck] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(PUBLIC_MODE_ACK_KEY) === "1";
    } catch {
      return false;
    }
  });

  const acknowledgePublic = React.useCallback(() => {
    try {
      window.sessionStorage.setItem(PUBLIC_MODE_ACK_KEY, "1");
    } catch {
      // ignore
    }
    setPublicAck(true);
  }, []);

  const [navOpen, setNavOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [detailMerge, setDetailMerge] = React.useState<MergeRecord | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Setup gate: show until we have either a token or an explicit "public mode" ack.
  const needsSetup = isPublicMode && !publicAck;
  // Picker gate: we've got auth (or public-ack) but no repo yet.
  const needsPicker = !needsSetup && !repoSlug;

  // Always declare hooks — they no-op when the inputs are empty.
  const owner = repoSlug?.owner ?? "";
  const name = repoSlug?.name ?? "";
  const queryEnabled = !!repoSlug && !needsSetup;

  const repoQuery = useRepoConfig({ owner, name });
  const mergesQuery = useRecentMerges({ owner, name });
  const queueQuery = useQueueState({ owner, name });
  const viewerQuery = useSignedInUser();

  // Surface GitHub errors as toasts, deduped per error code.
  const lastErrorRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!queryEnabled) return;
    const errs = [
      repoQuery.error,
      mergesQuery.error,
      queueQuery.error,
      viewerQuery.error,
    ];
    for (const err of errs) {
      if (!err) continue;
      const info = classifyGitHubError(err);
      if (!info) continue;
      const key = `${info.status}:${info.rateLimited}:${info.missingScope}`;
      if (lastErrorRef.current === key) continue;
      lastErrorRef.current = key;
      if (info.rateLimited) {
        toast({
          title: "Rate-limited by GitHub",
          description: info.rateLimitReset
            ? `Resets in ~${formatResetTime(info.rateLimitReset)}. ${
                isPublicMode ? "Add a token to raise the limit." : ""
              }`
            : "Try again shortly.",
          variant: "destructive",
        });
        return;
      }
      if (info.missingScope) {
        toast({
          title: "Token is missing required scope",
          description: "Regenerate your PAT with `repo` (and `read:org` for private orgs).",
          variant: "destructive",
        });
        return;
      }
      if (info.status === 401) {
        toast({
          title: "Token invalid",
          description: "Your GitHub token was rejected — sign out and re-enter.",
          variant: "destructive",
        });
        return;
      }
      if (info.status === 404) {
        toast({
          title: "Repository not found",
          description: `${owner}/${name} — check the spelling, or that your token has access.`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `GitHub error ${info.status}`,
        description: info.message,
        variant: "destructive",
      });
      return;
    }
  }, [
    queryEnabled,
    repoQuery.error,
    mergesQuery.error,
    queueQuery.error,
    viewerQuery.error,
    toast,
    isPublicMode,
    owner,
    name,
  ]);

  const handleSelectMerge = React.useCallback((m: MergeRecord) => {
    setDetailMerge(m);
    setDetailOpen(true);
  }, []);

  const handleToggleKillSwitch = React.useCallback(() => {
    // TODO(v0.3.2): write back to .4wd.json via a hosted endpoint.
    // The dashboard has no file-system access, so this remains a read-only
    // surface for now.
    toast({
      title: "Kill switch is read-only in v0.3",
      description:
        "Edit .4wd.json in the repo and commit to toggle 4wd. Write-back lands in v0.3.2.",
    });
  }, [toast]);

  // 1. No token and no public ack — show setup. (Picker comes next.)
  if (needsSetup) {
    return (
      <>
        <SetupScreen
          repoSlug={repoSlug ? `${repoSlug.owner}/${repoSlug.name}` : null}
          onContinuePublic={acknowledgePublic}
        />
        <Toaster />
      </>
    );
  }

  // 2. Auth (or public-ack) but no repo selected — show the picker.
  if (needsPicker) {
    return (
      <>
        <RepoPickerScreen isPublicMode={isPublicMode} />
        <Toaster />
      </>
    );
  }

  // Guarded above by `needsPicker` — repoSlug is non-null past this point.
  if (!repoSlug) {
    return null as unknown as JSX.Element;
  }
  const repo: RepoConfig = repoQuery.data ?? {
    ...FALLBACK_REPO,
    owner: repoSlug.owner,
    name: repoSlug.name,
  };
  const merges = mergesQuery.data ?? [];
  const queue = queueQuery.data ?? [];
  const viewer = viewerQuery.data ?? FALLBACK_USER;

  return (
    <div className="min-h-screen">
      <TopBar
        repo={repo}
        user={viewer}
        onOpenNav={() => setNavOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={signOut}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {isPublicMode && (
          <Banner
            tone="warning"
            title="Unauthenticated — rate-limited to 60 requests/hr."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  try {
                    window.sessionStorage.removeItem(PUBLIC_MODE_ACK_KEY);
                  } catch {
                    // ignore
                  }
                  setPublicAck(false);
                }}
              >
                Add token
              </Button>
            }
          >
            Add a GitHub PAT for full access and to read private repos.
          </Banner>
        )}

        <Queue items={queue} loading={queueQuery.isLoading} />
        <RecentMerges
          merges={merges}
          loading={mergesQuery.isLoading}
          onSelect={handleSelectMerge}
        />
      </main>

      <NavSheet
        open={navOpen}
        onOpenChange={setNavOpen}
        repo={repo}
        recentMerges={merges}
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
        onSignOut={signOut}
        isPublicMode={isPublicMode}
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
