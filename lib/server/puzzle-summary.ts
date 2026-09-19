import { store } from "./local-store";

export function puzzleSummary(puzzle: typeof store.puzzles extends Map<string, infer T> ? T : never, identity: string | null) {
  const userId = identity?.startsWith("user-") ? identity : null;
  const favorite = userId ? puzzle.favoriteBy.has(userId) : false;
  const active = identity ? [...store.sessions.values()].find((session) => (session.userId === identity || session.guestId === identity) && session.puzzleId === puzzle.id && session.status !== "ready" && session.status !== "completed") : undefined;
  const completed = identity ? store.completed.get(identity)?.has(puzzle.id) : false;
  const fixed = active?.snapshot.pieces.filter((piece) => piece.fixed).length ?? 0;
  const progress = active ? Math.min(99, Math.round(fixed / active.snapshot.pieces.length * 100)) : undefined;
  return { id: puzzle.id, title: puzzle.title, imageUrl: puzzle.imageUrl, aspectRatio: puzzle.aspectRatio, author: puzzle.author, category: puzzle.category, rows: puzzle.rows, columns: puzzle.columns, pieceCount: puzzle.pieceCount, playCount: puzzle.playCount, visibility: puzzle.visibility, favorite, playState: active ? "in_progress" as const : completed ? "completed" as const : "not_started" as const, progress, createdAt: puzzle.createdAt };
}
