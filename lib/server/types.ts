export type Visibility = "public" | "private";
export type Puzzle = {
  id: string; ownerId: string | null; title: string; description: string; imageUrl: string;
  aspectRatio: number; author: { id: string; name: string; avatarUrl?: string };
  category: string; categorySlug: string; rows: number; columns: number; pieceCount: number;
  playCount: number; visibility: Visibility; status: "published" | "unpublished";
  createdAt: string; favoriteBy: Set<string>;
};
export type Piece = { id: string; index: number; row: number; column: number; tray: "left" | "right" | "board"; fixed: boolean; x: number; y: number; slot?: number };
export type Session = { id: string; userId: string | null; guestId: string | null; puzzleId: string; puzzleVersion: number; status: "ready" | "active" | "paused" | "completed"; snapshot: { pieces: Piece[] }; stateVersion: number; updatedAt: string };
export type Profile = { id: string; email: string; displayName: string; avatarUrl?: string; bio: string };
export type OtpEntry = {
  code: string;
  expiresAt: number;
  resendAt: number;
  failedAttempts: number;
  sentAt: number[];
};
export type UploadIntent = {
  token: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  expiresAt: number;
  completedAt: number | null;
};
export type MigrationBackup = {
  id: string;
  userId: string;
  puzzleId: string;
  source: "guest" | "cloud";
  snapshot: Session;
  expiresAt: number;
};

export type DailyChallenge = {
  id: string;
  businessDate: string;
  timezone: "Asia/Shanghai";
  puzzleId: string;
  puzzleVersion: number;
  rows: number;
  columns: number;
  shape: "classic" | "rectangular";
  seed: number;
  ruleVersion: string;
  status: "open" | "unavailable" | "unpublished";
};

export type ChallengeAttempt = {
  id: string;
  challengeId: string;
  userId: string | null;
  guestId: string | null;
  mode: "formal" | "practice";
  status: "ready" | "active" | "paused" | "completed" | "expired" | "abandoned";
  pieces: Piece[];
  startedAt: string | null;
  activeSince: string | null;
  pauseStartedAt: string | null;
  pausedMs: number;
  elapsedMs: number | null;
  completedAt: string | null;
  eventCursor: number;
  stateVersion: number;
  updatedAt: string;
};

export type ChallengeBest = {
  challengeId: string;
  userId: string;
  attemptId: string;
  elapsedMs: number;
  completedAt: string;
};

export type RoomStatus = "creating" | "waiting" | "starting" | "active" | "completed" | "reconnecting" | "ended";
export type RoomMember = {
  roomId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  leftAt: string | null;
  participatedAt: string | null;
  lastSeenAt: string;
};
export type Room = {
  id: string;
  ownerId: string;
  puzzleId: string;
  sourceSessionId: string | null;
  snapshot: { pieces: Piece[] };
  stateVersion: number;
  status: RoomStatus;
  createdAt: string;
  startedAt: string | null;
  expiresAt: string;
  lastActivityAt: string;
  completedAt: string | null;
};
export type PieceLock = {
  roomId: string;
  pieceId: string;
  userId: string;
  leaseToken: string;
  expiresAt: string;
  version: number;
};
export type RoomEvent = {
  id: string;
  roomId: string;
  pieceId: string;
  userId: string;
  eventType: "move" | "fixed";
  payload: { x: number; y: number; tray: Piece["tray"]; fixed: boolean; slot?: number };
  version: number;
  createdAt: string;
};
