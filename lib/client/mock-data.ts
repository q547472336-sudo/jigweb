import type { ListFilters, PuzzleSummary } from "./types";

const images = [
  "/placeholders/mountain.svg",
  "/placeholders/coast.svg",
  "/placeholders/forest.svg",
  "/placeholders/mountain.svg",
  "/placeholders/coast.svg",
  "/placeholders/garden.svg",
  "/placeholders/forest.svg",
  "/placeholders/garden.svg",
];

const titles = ["晨雾山谷", "沿海公路", "林间微光", "雪山湖泊", "蓝色海湾", "雨后花园", "草原来客", "热带叶影"];
const puzzleCategories = ["风景", "日常", "风景", "风景", "艺术", "日常", "动物", "插画"];

export const puzzles: PuzzleSummary[] = Array.from({ length: 32 }, (_, index) => {
  const base = index % 8;
  const pieces = [9, 16, 36, 64, 121, 196][index % 6];
  const side = Math.round(Math.sqrt(pieces));
  const playState = index === 1 ? "in_progress" : index === 2 ? "completed" : "not_started";
  return {
    id: `puzzle-${index + 1}`,
    title: index < 8 ? titles[base] : `${titles[base]} ${Math.floor(index / 8) + 1}`,
    imageUrl: images[base],
    aspectRatio: 4 / 3,
    author: { id: `author-${base}`, name: ["Maple", "Juno", "小岛", "Theo", "Lina", "原野", "Mori", "安禾"][base] },
    category: puzzleCategories[base],
    rows: side,
    columns: side,
    pieceCount: pieces,
    playCount: 1380 - index * 27,
    visibility: index === 7 ? "private" : "public",
    favorite: index === 0 || index === 4,
    playState,
    progress: playState === "in_progress" ? 42 : undefined,
    createdAt: new Date(Date.UTC(2026, 7, 30 - index)).toISOString(),
  } satisfies PuzzleSummary;
});

export const categories = ["精选", "风景", "艺术", "动物", "插画", "建筑", "日常", "美食", "人物", "节日", "其他"];

export function getPuzzle(id: string) {
  return puzzles.find((puzzle) => puzzle.id === id) ?? puzzles[0];
}

export function listPuzzles(filters: ListFilters = {}) {
  let result = puzzles.filter((puzzle) => puzzle.visibility === "public");
  const terms = filters.q?.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (terms.length) {
    result = result.filter((puzzle) => terms.every((term) =>
      [puzzle.title, puzzle.author.name, puzzle.category].some((field) => field.toLocaleLowerCase().includes(term)),
    ));
  }
  if (filters.category && filters.category !== "精选") result = result.filter((puzzle) => puzzle.category === filters.category);
  if (filters.pieces) {
    const [min, max] = filters.pieces.split("-").map(Number);
    result = result.filter((puzzle) => puzzle.pieceCount >= min && puzzle.pieceCount <= max);
  }
  return [...result].sort((a, b) => filters.sort === "popular"
    ? b.playCount - a.playCount || b.createdAt.localeCompare(a.createdAt)
    : b.createdAt.localeCompare(a.createdAt));
}

export const currentUser: CurrentUser = { id: "user-demo", name: "Maple", email: "maple@example.com" };

type CurrentUser = import("./types").CurrentUser;
