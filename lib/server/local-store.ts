import type { ChallengeAttempt, ChallengeBest, DailyChallenge, MigrationBackup, OtpEntry, PieceLock, Profile, Puzzle, Room, RoomEvent, RoomMember, Session, UploadIntent } from "./types";
import { supabaseConfigFromEnv } from "./data-adapter.ts";

const now = () => new Date().toISOString();
const image = "/placeholders/mountain.svg";
const image2 = "/placeholders/garden.svg";
const seedPuzzle = (id: string, title: string, category: string, categorySlug: string, imageUrl: string, rows = 6, columns = 6): Puzzle => ({ id, ownerId: null, title, description: `${title} 的一幅拼图`, imageUrl, aspectRatio: 1.5, author: { id: "curated", name: "拼图时光编辑部" }, category, categorySlug, rows, columns, pieceCount: rows * columns, playCount: 120 + Number(id.replace(/\D/g, "") || 1) * 37, visibility: "public", status: "published", createdAt: now(), favoriteBy: new Set() });
const seedTitles = ["蓝色时刻", "山谷的风", "午后建筑", "森林漫游", "海边留白", "静物练习", "雨后花园", "沿海公路"];
const seedImages = [image, image2, "/placeholders/coast.svg", "/placeholders/forest.svg"];
const cowboyTitles = ["星际牛仔：火星唱片店", "星际牛仔：Bebop Crew", "星际牛仔：香港雨幕"];
const cowboyImages = ["/cowboy-bebop/spaceport.jpg", "/cowboy-bebop/crew.jpg", "/cowboy-bebop/hong-kong.jpg"];
const seedCategories = [["风景", "landscape"], ["日常", "daily"], ["建筑", "architecture"], ["艺术", "art"]] as const;
const curatedPuzzles = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1; const [category, slug] = seedCategories[index % seedCategories.length]; const size = [3, 4, 6, 8, 11, 14][index % 6];
  const isCowboyBanner = index < cowboyImages.length;
  const title = isCowboyBanner ? cowboyTitles[index] : `${seedTitles[index % seedTitles.length]}${index >= seedTitles.length ? ` ${Math.floor(index / seedTitles.length) + 1}` : ""}`;
  const imageUrl = isCowboyBanner ? cowboyImages[index] : seedImages[index % seedImages.length];
  const gridSize = isCowboyBanner ? 14 : size;
  return [`puzzle-${number}`, seedPuzzle(`puzzle-${number}`, title, category, slug, imageUrl, gridSize, gridSize)] as const;
});

export const store = {
  profiles: new Map<string, Profile>(),
  puzzles: new Map<string, Puzzle>(curatedPuzzles),
  sessions: new Map<string, Session>(),
  otp: new Map<string, OtpEntry>(),
  emailToUser: new Map<string, string>(),
  emailChanges: new Map<string, { oldEmail: string; newEmail: string; expiresAt: number }>(),
  idempotency: new Map<string, string>(),
  completed: new Map<string, Map<string, string>>(),
  recent: new Map<string, Map<string, string>>(),
  notifications: new Map<string, Array<{ id: string; type: string; message: string; createdAt: string; readAt: string | null }>>(),
  feedback: [] as Array<{ id: string; userId: string; type: string; description: string; ticketNo: string; createdAt: string }>,
  reports: [] as Array<{ id: string; userId: string; puzzleId: string; category: string; description: string; createdAt: string }>,
  uploadIntents: new Map<string, UploadIntent>(),
  migrationBackups: new Map<string, MigrationBackup>(),
  idempotencyHashes: new Map<string, string>(),
  dailyChallenges: new Map<string, DailyChallenge>(),
  challengeAttempts: new Map<string, ChallengeAttempt>(),
  challengeBests: new Map<string, ChallengeBest>(),
  rooms: new Map<string, Room>(),
  roomMembers: new Map<string, RoomMember[]>(),
  pieceLocks: new Map<string, PieceLock>(),
  roomEvents: new Map<string, RoomEvent[]>(),
};

/** x-user-id is deliberately disabled as soon as production Supabase config exists. */
export function getUser(request: Request) { return supabaseConfigFromEnv() ? null : request.headers.get("x-user-id"); }
export function getGuest(request: Request) { return request.headers.get("x-guest-id"); }
export function profileFor(userId: string) {
  let profile = store.profiles.get(userId);
  if (!profile) { profile = { id: userId, email: `${userId}@local.test`, displayName: "本地玩家", bio: "" }; store.profiles.set(userId, profile); }
  return profile;
}
export function activityIdentity(request: Request) { return getUser(request) ?? getGuest(request); }
export function recordRecent(identity: string, puzzleId: string) {
  const items = store.recent.get(identity) ?? new Map<string, string>();
  items.set(puzzleId, now());
  store.recent.set(identity, items);
}
export function recordCompleted(identity: string, puzzleId: string) {
  const items = store.completed.get(identity) ?? new Map<string, string>();
  if (!items.has(puzzleId)) items.set(puzzleId, now());
  store.completed.set(identity, items);
  recordRecent(identity, puzzleId);
}
export function createPieces(rows: number, columns: number) {
  return Array.from({ length: rows * columns }, (_, index) => ({ id: `piece-${index}`, index, row: Math.floor(index / columns), column: index % columns, tray: index % 2 ? "right" as const : "left" as const, fixed: false, x: 0, y: 0 }));
}

export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function ensureDailyChallenge(now = new Date()): DailyChallenge {
  const date = businessDate(now);
  const existing = store.dailyChallenges.get(date);
  if (existing) return existing;
  const puzzle = [...store.puzzles.values()].find((item) => item.status === "published" && item.visibility === "public") ?? [...store.puzzles.values()][0];
  const challenge: DailyChallenge = {
    id: `challenge-${date}`,
    businessDate: date,
    timezone: "Asia/Shanghai",
    puzzleId: puzzle.id,
    puzzleVersion: 1,
    rows: puzzle.rows,
    columns: puzzle.columns,
    shape: "classic",
    seed: [...date].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17),
    ruleVersion: "challenge-v1",
    status: "open",
  };
  store.dailyChallenges.set(date, challenge);
  return challenge;
}

export function roomMember(roomId: string, userId: string) {
  return (store.roomMembers.get(roomId) ?? []).find((member) => member.userId === userId && !member.leftAt);
}

export function roomMembers(roomId: string) {
  return store.roomMembers.get(roomId) ?? [];
}
