export interface User {
  login: string;
  avatarUrl: string;
}

export type QueueStatus = "merged" | "running" | "queued" | "failed";

export interface QueueItem {
  id: string;
  prNumber: number;
  title: string;
  branch: string;
  author: User;
  status: QueueStatus;
  startedAt: string; // ISO
  finishedAt?: string;
}

export interface RatchetMetric {
  metric: string;
  before: number;
  after: number;
}

export type MergeStatus = "merged" | "failed";

export interface MergeRecord {
  sha: string;
  shortSha: string;
  branch: string;
  title: string;
  author: User;
  status: MergeStatus;
  mergedAt: string; // ISO
  gateSeconds: number;
  ratchetDelta?: RatchetMetric[];
  prNumber?: number;
  /** Compact gate log output — shown collapsed in the detail sheet. */
  gateLog?: string;
  /** Commits included in the branch (oldest → newest). */
  commits?: { sha: string; shortSha: string; message: string }[];
}

export interface RepoConfig {
  owner: string;
  name: string;
  branchProtectionEnabled: boolean;
  mergeQueueEnabled: boolean;
  fourWdDisabled: boolean;
  fourWdVersion: string;
}

export interface SignedInUser extends User {
  name: string;
}
