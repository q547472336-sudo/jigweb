export type PlayState = "not_started" | "in_progress" | "completed";
export type Visibility = "public" | "private";

export type PuzzleSummary = {
  id: string;
  title: string;
  imageUrl: string;
  aspectRatio: number;
  author: { id: string; name: string; avatarUrl?: string };
  category: string;
  rows: number;
  columns: number;
  pieceCount: number;
  playCount: number;
  visibility: Visibility;
  favorite: boolean;
  playState: PlayState;
  progress?: number;
  createdAt: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export type PieceState = {
  id: string;
  index: number;
  row: number;
  column: number;
  tray: "left" | "right" | "board";
  fixed: boolean;
  slot?: number;
};

export type PuzzleSnapshot = {
  sessionId: string;
  puzzleId: string;
  version: number;
  status: "ready" | "active" | "paused" | "completed";
  pieces: PieceState[];
  updatedAt: string;
};

export type ListFilters = {
  q?: string;
  category?: string;
  pieces?: string;
  sort?: "newest" | "popular";
};

export type Challenge = {
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
  mode: "formal" | "practice";
  status: "ready" | "active" | "paused" | "completed" | "expired" | "abandoned";
  pieces: Array<PieceState & { x: number; y: number }>;
  startedAt: string | null;
  elapsedMs: number;
  pausedMs: number;
  completedAt: string | null;
  stateVersion: number;
  updatedAt: string;
};

export type RoomMember = { roomId: string; userId: string; role: "owner" | "member"; joinedAt: string; leftAt: string | null; participatedAt: string | null; lastSeenAt: string; displayName: string; online: boolean };
export type Room = {
  id: string;
  ownerId: string;
  puzzleId: string;
  sourceSessionId: string | null;
  snapshot: { pieces: Array<PieceState & { x: number; y: number }> } | null;
  stateVersion: number;
  status: "creating" | "waiting" | "starting" | "active" | "completed" | "reconnecting" | "ended";
  createdAt: string;
  startedAt: string | null;
  expiresAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  members: RoomMember[];
  canPlay: boolean;
};
