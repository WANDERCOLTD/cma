import * as React from "react";

/**
 * Personal, per-browser dashboard preferences.
 *
 * Everything here is stored in `localStorage` under a single JSON blob so the
 * shape can grow without churning storage keys. The state shape is versioned
 * via `SCHEMA_VERSION` — bump it and add a migration when the contract changes.
 *
 * The `useTheme` hook continues to own theme state — we don't duplicate it
 * here. The Profile slideout reads/writes theme through `useTheme` directly.
 */

const STORAGE_KEY = "4wd:personal-settings";
const SCHEMA_VERSION = 1;

/** Polling interval (seconds) bounds — guard against absurd values. */
export const POLL_BOUNDS = {
  queueMin: 5,
  queueMax: 120,
  queueDefault: 15,
  mergesMin: 15,
  mergesMax: 300,
  mergesDefault: 60,
} as const;

export type RecentMergesView = "card" | "list";

export interface PersonalSettings {
  /** Slug of the repo to land on next time (`owner/name`). `null` = "last visited". */
  defaultRepoSlug: string | null;
  /** Queue refetch interval (seconds). */
  queuePollSeconds: number;
  /** Recent-merges refetch interval (seconds). */
  mergesPollSeconds: number;
  /** How Recent merges renders — card grid or compact list. */
  recentMergesView: RecentMergesView;
}

interface StoredEnvelope {
  v: number;
  data: PersonalSettings;
}

const DEFAULTS: PersonalSettings = {
  defaultRepoSlug: null,
  queuePollSeconds: POLL_BOUNDS.queueDefault,
  mergesPollSeconds: POLL_BOUNDS.mergesDefault,
  recentMergesView: "card",
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalize(input: Partial<PersonalSettings>): PersonalSettings {
  return {
    defaultRepoSlug:
      typeof input.defaultRepoSlug === "string" && input.defaultRepoSlug
        ? input.defaultRepoSlug
        : null,
    queuePollSeconds: clamp(
      input.queuePollSeconds ?? DEFAULTS.queuePollSeconds,
      POLL_BOUNDS.queueMin,
      POLL_BOUNDS.queueMax,
    ),
    mergesPollSeconds: clamp(
      input.mergesPollSeconds ?? DEFAULTS.mergesPollSeconds,
      POLL_BOUNDS.mergesMin,
      POLL_BOUNDS.mergesMax,
    ),
    recentMergesView:
      input.recentMergesView === "list" ? "list" : "card",
  };
}

function readFromStorage(): PersonalSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as StoredEnvelope | Partial<PersonalSettings>;
    // Tolerate both the new envelope and an old flat shape.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "data" in parsed
    ) {
      return normalize((parsed as StoredEnvelope).data);
    }
    return normalize(parsed as Partial<PersonalSettings>);
  } catch {
    return DEFAULTS;
  }
}

function writeToStorage(s: PersonalSettings): void {
  try {
    const envelope: StoredEnvelope = { v: SCHEMA_VERSION, data: s };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore — storage disabled
  }
}

interface PersonalSettingsContextValue {
  settings: PersonalSettings;
  setDefaultRepoSlug: (slug: string | null) => void;
  setQueuePollSeconds: (n: number) => void;
  setMergesPollSeconds: (n: number) => void;
  setRecentMergesView: (v: RecentMergesView) => void;
  resetToDefaults: () => void;
}

const PersonalSettingsContext =
  React.createContext<PersonalSettingsContextValue | null>(null);

export function PersonalSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [settings, setSettings] = React.useState<PersonalSettings>(
    readFromStorage,
  );

  React.useEffect(() => {
    writeToStorage(settings);
  }, [settings]);

  const setDefaultRepoSlug = React.useCallback((slug: string | null) => {
    setSettings((s) => ({ ...s, defaultRepoSlug: slug ?? null }));
  }, []);

  const setQueuePollSeconds = React.useCallback((n: number) => {
    setSettings((s) => ({
      ...s,
      queuePollSeconds: clamp(n, POLL_BOUNDS.queueMin, POLL_BOUNDS.queueMax),
    }));
  }, []);

  const setMergesPollSeconds = React.useCallback((n: number) => {
    setSettings((s) => ({
      ...s,
      mergesPollSeconds: clamp(
        n,
        POLL_BOUNDS.mergesMin,
        POLL_BOUNDS.mergesMax,
      ),
    }));
  }, []);

  const setRecentMergesView = React.useCallback((v: RecentMergesView) => {
    setSettings((s) => ({ ...s, recentMergesView: v }));
  }, []);

  const resetToDefaults = React.useCallback(() => {
    setSettings(DEFAULTS);
  }, []);

  const value = React.useMemo<PersonalSettingsContextValue>(
    () => ({
      settings,
      setDefaultRepoSlug,
      setQueuePollSeconds,
      setMergesPollSeconds,
      setRecentMergesView,
      resetToDefaults,
    }),
    [
      settings,
      setDefaultRepoSlug,
      setQueuePollSeconds,
      setMergesPollSeconds,
      setRecentMergesView,
      resetToDefaults,
    ],
  );

  return (
    <PersonalSettingsContext.Provider value={value}>
      {children}
    </PersonalSettingsContext.Provider>
  );
}

export function usePersonalSettings(): PersonalSettingsContextValue {
  const ctx = React.useContext(PersonalSettingsContext);
  if (!ctx) {
    throw new Error(
      "usePersonalSettings must be used inside <PersonalSettingsProvider>",
    );
  }
  return ctx;
}
