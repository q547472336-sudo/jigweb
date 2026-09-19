import type { PieceState } from "@/lib/client/types";

export const DRAG_START_DISTANCE = 3;
export const MAGNETIC_OVERLAP_RATIO = 0.5;
export const MAGNETIC_NEIGHBOR_RATIO = 0.48;

export type PuzzleEdge = -1 | 0 | 1;
export type EdgeProfile = { center: number; width: number; depth: number; shoulder: number; bulge: number; tilt: number };
export type PuzzleEdges = {
  top: PuzzleEdge;
  right: PuzzleEdge;
  bottom: PuzzleEdge;
  left: PuzzleEdge;
  profiles?: Partial<Record<"top" | "right" | "bottom" | "left", EdgeProfile>>;
};

export type PositionedPiece = PieceState & {
  /** Normalized top-left position within the board. */
  x?: number;
  y?: number;
};

export type BoardMetrics = {
  width: number;
  height: number;
  rows: number;
  columns: number;
};

export type DropResult = {
  x: number;
  y: number;
  fixed: boolean;
  slot?: number;
};

export type CanvasPiecePosition = {
  piece: Pick<PositionedPiece, "id" | "row" | "column">;
  x: number;
  y: number;
};

export type NeighborSnap = { x: number; y: number; neighborId: string };

function connector(seed: number): PuzzleEdge {
  return ((seed * 1103515245 + 12345) >>> 16) % 2 === 0 ? 1 : -1;
}

function edgeProfile(seed: number): EdgeProfile {
  const random = (offset: number) => seededUnit(seed + offset * 7919);
  return {
    center: 45 + random(1) * 12,
    width: 25 + random(2) * 17,
    depth: 14 + random(3) * 13,
    shoulder: 4 + random(4) * 8,
    bulge: 3 + random(5) * 9,
    tilt: (random(6) - .5) * 12,
  };
}

/**
 * Returns deterministic, complementary tabs for a traditional jigsaw outline.
 * `1` protrudes from the current piece, `-1` is an inward socket, `0` is flat.
 */
export function puzzleEdges(row: number, column: number, rows: number, columns: number): PuzzleEdges {
  const horizontalSeed = (r: number, c: number) => (r + 17) * 8191 + (c + 31) * 131;
  const verticalSeed = (r: number, c: number) => (r + 47) * 4099 + (c + 7) * 257;
  const horizontal = (r: number, c: number) => connector(horizontalSeed(r, c));
  const vertical = (r: number, c: number) => connector(verticalSeed(r, c));
  return {
    top: row === 0 ? 0 : (-horizontal(row - 1, column) as PuzzleEdge),
    right: column === columns - 1 ? 0 : vertical(row, column),
    bottom: row === rows - 1 ? 0 : horizontal(row, column),
    left: column === 0 ? 0 : (-vertical(row, column - 1) as PuzzleEdge),
    profiles: {
      top: row === 0 ? undefined : edgeProfile(horizontalSeed(row - 1, column)),
      right: column === columns - 1 ? undefined : edgeProfile(verticalSeed(row, column)),
      bottom: row === rows - 1 ? undefined : edgeProfile(horizontalSeed(row, column)),
      left: column === 0 ? undefined : edgeProfile(verticalSeed(row, column - 1)),
    },
  };
}

/** A soft, hand-cut traditional outline with asymmetric, rounded tabs and sockets. */
export function puzzlePiecePath(edges: PuzzleEdges): string {
  const top = edges.top === 0
    ? "H100"
    : `H27 C31 0 34 ${-edges.top * 4} 39 ${-edges.top * 7} C45 ${-edges.top * 11} 43 ${-edges.top * 19} 50 ${-edges.top * 20} C57 ${-edges.top * 21} 55 ${-edges.top * 11} 61 ${-edges.top * 6} C67 ${-edges.top * 2} 71 0 74 0 H100`;
  const right = edges.right === 0
    ? "V100"
    : `V27 C100 31 ${100 + edges.right * 4} 34 ${100 + edges.right * 7} 39 C${100 + edges.right * 11} 45 ${100 + edges.right * 19} 43 ${100 + edges.right * 20} 50 C${100 + edges.right * 21} 57 ${100 + edges.right * 11} 55 ${100 + edges.right * 6} 61 C${100 + edges.right * 2} 67 100 71 100 74 V100`;
  const bottom = edges.bottom === 0
    ? "H0"
    : `H74 C71 100 67 ${100 + edges.bottom * 2} 61 ${100 + edges.bottom * 6} C55 ${100 + edges.bottom * 11} 57 ${100 + edges.bottom * 21} 50 ${100 + edges.bottom * 20} C43 ${100 + edges.bottom * 19} 45 ${100 + edges.bottom * 11} 39 ${100 + edges.bottom * 7} C34 ${100 + edges.bottom * 4} 31 100 27 100 H0`;
  const left = edges.left === 0
    ? "V0"
    : `V74 C0 71 ${-edges.left * 2} 67 ${-edges.left * 6} 61 C${-edges.left * 11} 55 ${-edges.left * 21} 57 ${-edges.left * 20} 50 C${-edges.left * 19} 43 ${-edges.left * 11} 45 ${-edges.left * 7} 39 C${-edges.left * 4} 34 0 31 0 27 V0`;
  return `M0 0 ${top} ${right} ${bottom} ${left} Z`;
}

function horizontalRandomEdge(y: number, direction: number, edge: PuzzleEdge, data: EdgeProfile, reverse = false) {
  const start = Math.max(8, data.center - data.width / 2);
  const end = Math.min(92, data.center + data.width / 2);
  const shoulder = Math.min(data.shoulder, (end - start) / 4);
  const center = data.center + data.tilt;
  const left = start + shoulder;
  const right = end - shoulder;
  const outward = direction * edge;
  const peak = y + outward * data.depth;
  const bulge = Math.max(3, data.bulge);
  const segments = [
    { from: [start, y], c1: [start + shoulder * .35, y], c2: [start + shoulder * .7, y + outward * data.depth * .24], to: [left, y + outward * data.depth * .4] },
    { from: [left, y + outward * data.depth * .4], c1: [left + (center - left) * .25, y + outward * data.depth * .62], c2: [center - bulge, peak - outward * bulge], to: [center, peak] },
    { from: [center, peak], c1: [center + bulge, peak - outward * bulge], c2: [right - (right - center) * .25, y + outward * data.depth * .62], to: [right, y + outward * data.depth * .4] },
    { from: [right, y + outward * data.depth * .4], c1: [end - shoulder * .7, y + outward * data.depth * .24], c2: [end - shoulder * .35, y], to: [end, y] },
  ];
  const commands = reverse
    ? [...segments].reverse().map((segment) => `C${segment.c2[0]} ${segment.c2[1]} ${segment.c1[0]} ${segment.c1[1]} ${segment.from[0]} ${segment.from[1]}`).join(" ")
    : segments.map((segment) => `C${segment.c1[0]} ${segment.c1[1]} ${segment.c2[0]} ${segment.c2[1]} ${segment.to[0]} ${segment.to[1]}`).join(" ");
  return `L${reverse ? end : start} ${y} ${commands}`;
}

function verticalRandomEdge(x: number, direction: number, edge: PuzzleEdge, data: EdgeProfile, reverse = false) {
  const start = Math.max(8, data.center - data.width / 2);
  const end = Math.min(92, data.center + data.width / 2);
  const shoulder = Math.min(data.shoulder, (end - start) / 4);
  const center = data.center + data.tilt;
  const top = start + shoulder;
  const bottom = end - shoulder;
  const outward = direction * edge;
  const peak = x + outward * data.depth;
  const bulge = Math.max(3, data.bulge);
  const segments = [
    { from: [x, start], c1: [x, start + shoulder * .35], c2: [x + outward * data.depth * .24, start + shoulder * .7], to: [x + outward * data.depth * .4, top] },
    { from: [x + outward * data.depth * .4, top], c1: [x + outward * data.depth * .62, top + (center - top) * .25], c2: [peak - outward * bulge, center - bulge], to: [peak, center] },
    { from: [peak, center], c1: [peak - outward * bulge, center + bulge], c2: [x + outward * data.depth * .62, bottom - (bottom - center) * .25], to: [x + outward * data.depth * .4, bottom] },
    { from: [x + outward * data.depth * .4, bottom], c1: [x + outward * data.depth * .24, end - shoulder * .7], c2: [x, end - shoulder * .35], to: [x, end] },
  ];
  const commands = reverse
    ? [...segments].reverse().map((segment) => `C${segment.c2[0]} ${segment.c2[1]} ${segment.c1[0]} ${segment.c1[1]} ${segment.from[0]} ${segment.from[1]}`).join(" ")
    : segments.map((segment) => `C${segment.c1[0]} ${segment.c1[1]} ${segment.c2[0]} ${segment.c2[1]} ${segment.to[0]} ${segment.to[1]}`).join(" ");
  return `${reverse ? `L${x} ${end}` : `L${x} ${start}`} ${commands}`;
}

/** A deterministic real-jigsaw outline. Shared profiles make neighboring edges exact mirrors. */
export function realPuzzlePiecePath(edges: PuzzleEdges): string {
  const profiles = edges.profiles ?? {};
  const top = edges.top === 0 ? "H100" : `${horizontalRandomEdge(0, -1, edges.top, profiles.top ?? edgeProfile(11))} L100 0`;
  const right = edges.right === 0 ? "V100" : `${verticalRandomEdge(100, 1, edges.right, profiles.right ?? edgeProfile(17))} L100 100`;
  const bottom = edges.bottom === 0 ? "H0" : `${horizontalRandomEdge(100, 1, edges.bottom, profiles.bottom ?? edgeProfile(23), true)} L0 100`;
  const left = edges.left === 0 ? "V0" : `${verticalRandomEdge(0, -1, edges.left, profiles.left ?? edgeProfile(29), true)} L0 0`;
  return `M0 0 ${top} ${right} ${bottom} ${left} Z`;
}

/** A tidy, evenly spaced ring around the centered main image. */
export function arrangedPiecePosition(index: number, count: number): { x: number; y: number } {
  const side = index % 4;
  const step = Math.floor(index / 4);
  const perSide = Math.max(1, Math.ceil(count / 4));
  const ratio = (step + .5) / perSide;
  if (side === 0) return { x: .14 + ratio * .72, y: .025 };
  if (side === 1) return { x: .14 + ratio * .72, y: .765 };
  if (side === 2) return { x: .018, y: .12 + ratio * .68 };
  return { x: .885, y: .12 + ratio * .68 };
}

/** Backwards-compatible default for new / legacy free pieces. */
export function freePiecePosition(index: number, count = 24): { x: number; y: number } {
  return arrangedPiecePosition(index, count);
}

function seededUnit(seed: number) {
  return ((seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** Randomized, non-overlapping slots that deliberately stay outside the main image frame. */
export function scatteredPiecePosition(index: number, count: number, seed: number): { x: number; y: number } {
  const perSide = Math.max(1, Math.ceil(count / 4));
  const permutation = (index * 7 + Math.floor(seededUnit(seed) * perSide * 4)) % (perSide * 4);
  const side = permutation % 4;
  const step = Math.floor(permutation / 4);
  const ratio = (step + .5) / perSide;
  const jitterX = (seededUnit(seed + index * 37 + 5) - .5) * .025;
  const jitterY = (seededUnit(seed + index * 53 + 9) - .5) * .018;
  if (side === 0) return { x: .08 + ratio * .76 + jitterX, y: .015 + jitterY };
  if (side === 1) return { x: .08 + ratio * .76 + jitterX, y: .86 + jitterY };
  if (side === 2) return { x: .018 + jitterX, y: .12 + ratio * .68 + jitterY };
  return { x: .88 + jitterX, y: .12 + ratio * .68 + jitterY };
}

export type LooseLayoutMetrics = {
  workspaceWidth: number;
  workspaceHeight: number;
  visibleLeft: number;
  visibleTop: number;
  visibleRight: number;
  visibleBottom: number;
  boardLeft: number;
  boardTop: number;
  boardRight: number;
  boardBottom: number;
  pieceWidth: number;
  pieceHeight: number;
  obstacles?: Array<{ left: number; top: number; right: number; bottom: number }>;
};

type LooseSlot = { x: number; y: number };

function looseSlotObstacles(metrics: LooseLayoutMetrics) {
  return [
    { left: metrics.boardLeft - 4, top: metrics.boardTop - 4, right: metrics.boardRight + 4, bottom: metrics.boardBottom + 4 },
    ...(metrics.obstacles ?? []),
  ];
}

function looseSlotIntersectsObstacle(metrics: LooseLayoutMetrics, x: number, y: number) {
  const { pieceWidth, pieceHeight } = metrics;
  const artLeft = pieceWidth * .24;
  const artTop = pieceHeight * .24;
  const artRight = pieceWidth * 1.24;
  const artBottom = pieceHeight * 1.24;
  return looseSlotObstacles(metrics).some((obstacle) => x - artLeft < obstacle.right && x + artRight > obstacle.left && y - artTop < obstacle.bottom && y + artBottom > obstacle.top);
}

function looseSlots(metrics: LooseLayoutMetrics, gap: number, spacing = 1): LooseSlot[] {
  const { pieceWidth, pieceHeight } = metrics;
  const artLeft = pieceWidth * .24;
  const artTop = pieceHeight * .24;
  const artRight = pieceWidth * 1.24;
  const artBottom = pieceHeight * 1.24;
  const minX = metrics.visibleLeft + artLeft + 4;
  const maxX = metrics.visibleRight - artRight - 4;
  const minY = metrics.visibleTop + artTop + 4;
  const maxY = metrics.visibleBottom - artBottom - 4;
  // When the screen is densely populated, a smaller step keeps every piece at
  // a distinct, visible position instead of reusing a coordinate and hiding it
  // entirely under another fragment.
  const stepX = Math.max(2, (artLeft + artRight) * spacing + gap);
  const stepY = Math.max(2, (artTop + artBottom) * spacing + gap);
  const slots: LooseSlot[] = [];

  if (maxX < minX || maxY < minY) return slots;
  for (let y = minY; y <= maxY + .5; y += stepY) {
    for (let x = minX; x <= maxX + .5; x += stepX) {
      if (!looseSlotIntersectsObstacle(metrics, x, y)) slots.push({ x, y });
    }
  }
  return slots;
}

function shuffledSlots(slots: LooseSlot[], seed: number) {
  const next = [...slots];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededUnit(seed + index * 997) * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

/**
 * Takes the usable positions from all four sides in turn. A row-major walk
 * concentrates a large puzzle along the top and side edges even when the
 * lower area is free, which makes the board feel unbalanced at small zoom.
 */
function distributeAroundBoard(slots: LooseSlot[], metrics: LooseLayoutMetrics) {
  const top: LooseSlot[] = [];
  const bottom: LooseSlot[] = [];
  const left: LooseSlot[] = [];
  const right: LooseSlot[] = [];
  const artLeft = metrics.pieceWidth * .24;
  const artTop = metrics.pieceHeight * .24;
  const artRight = metrics.pieceWidth * 1.24;
  const artBottom = metrics.pieceHeight * 1.24;

  for (const slot of slots) {
    if (slot.y + artBottom <= metrics.boardTop) top.push(slot);
    else if (slot.y - artTop >= metrics.boardBottom) bottom.push(slot);
    else if (slot.x + artRight <= metrics.boardLeft) left.push(slot);
    else right.push(slot);
  }
  top.sort((a, b) => a.x - b.x);
  bottom.sort((a, b) => a.x - b.x);
  left.sort((a, b) => a.y - b.y);
  right.sort((a, b) => a.y - b.y);

  const queues = [top, bottom, left, right];
  const distributed: LooseSlot[] = [];
  while (distributed.length < slots.length) {
    let added = false;
    for (const queue of queues) {
      const slot = queue.shift();
      if (slot) {
        distributed.push(slot);
        added = true;
      }
    }
    if (!added) break;
  }
  return distributed;
}

/**
 * Packs unfixed pieces that remain outside the board into the visible area
 * around it. Pieces already moved onto the board keep their current position.
 * The grid spacing is based on the rendered artwork footprint rather than the
 * button box, so high-piece-count layouts stay complete without a second row
 * of pieces hiding underneath the first one.
 */
export function layoutUnfixedPieces(
  pieces: PositionedPiece[],
  mode: "arranged" | "scattered",
  metrics: LooseLayoutMetrics,
  seed = 1,
): PositionedPiece[] {
  const movable = pieces.filter((piece) => !piece.fixed && piece.tray !== "board");
  if (!movable.length) return pieces;
  const gaps = [Math.max(2, Math.min(metrics.pieceWidth, metrics.pieceHeight) * .08), 1, 0];
  let slots = gaps.map((gap) => looseSlots(metrics, gap)).find((candidate) => candidate.length >= movable.length) ?? looseSlots(metrics, 0);
  if (slots.length < movable.length) {
    for (const spacing of [.72, .52, .36, .22, .12]) {
      const fallback = looseSlots(metrics, 0, spacing);
      if (fallback.length > slots.length) slots = fallback;
      if (slots.length >= movable.length) break;
    }
  }
  const balancedSlots = distributeAroundBoard(slots, metrics);
  const selected = Array.from({ length: movable.length }, (_, index) => balancedSlots[index] ?? balancedSlots[index % Math.max(1, balancedSlots.length)] ?? { x: metrics.visibleLeft, y: metrics.visibleTop });
  const ordered = mode === "scattered" ? shuffledSlots(selected, seed) : selected;
  const jitterX = Math.min(metrics.pieceWidth * .2, 8);
  const jitterY = Math.min(metrics.pieceHeight * .2, 8);
  const safeX = (x: number) => Math.max(metrics.visibleLeft + metrics.pieceWidth * .24 + 2, Math.min(metrics.visibleRight - metrics.pieceWidth * 1.24 - 2, x));
  const safeY = (y: number) => Math.max(metrics.visibleTop + metrics.pieceHeight * .24 + 2, Math.min(metrics.visibleBottom - metrics.pieceHeight * 1.24 - 2, y));
  const nextPositions = ordered.map((slot, index) => {
    if (mode === "arranged") return slot;
    const candidate = {
      x: safeX(slot.x + (seededUnit(seed + index * 31) - .5) * jitterX * 2),
      y: safeY(slot.y + (seededUnit(seed + index * 47 + 11) - .5) * jitterY * 2),
    };
    return looseSlotIntersectsObstacle(metrics, candidate.x, candidate.y) ? slot : candidate;
  });
  const movableById = new Map(movable.map((piece, index) => [piece.id, nextPositions[index]]));
  return pieces.map((piece) => {
    const position = movableById.get(piece.id);
    if (!position) return piece;
    const x = position.x / metrics.workspaceWidth;
    const y = position.y / metrics.workspaceHeight;
    return { ...piece, tray: x < .5 ? "left" as const : "right" as const, x, y, slot: undefined };
  });
}

export function generatePieces(puzzleId: string, rows: number, columns: number): PositionedPiece[] {
  const count = rows * columns;
  return Array.from({ length: count }, (_, index) => ({
    id: `${puzzleId}-${index}`,
    index,
    row: Math.floor(index / columns),
    column: index % columns,
    tray: (index % 2 ? "right" : "left") as "left" | "right",
    fixed: false,
    ...freePiecePosition(index, count),
  })).sort((a, b) => ((a.index * 17 + 11) % count) - ((b.index * 17 + 11) % count));
}

export function normalizePieces(pieces: PieceState[], rows: number, columns: number): PositionedPiece[] {
  return pieces.map((piece) => {
    const positioned = piece as PositionedPiece;
    if (piece.fixed) {
      return { ...positioned, tray: "board", slot: piece.index, x: piece.column / columns, y: piece.row / rows };
    }
    if (piece.tray === "board") {
      return {
        ...positioned,
        x: typeof positioned.x === "number" ? positioned.x : Math.max(0, Math.min(1 - 1 / columns, piece.column / columns)),
        y: typeof positioned.y === "number" ? positioned.y : Math.max(0, Math.min(1 - 1 / rows, piece.row / rows)),
      };
    }
    const fallback = freePiecePosition(piece.index, rows * columns);
    const hasSavedFreePosition = typeof positioned.x === "number" && typeof positioned.y === "number" && (positioned.x !== 0 || positioned.y !== 0);
    return {
      ...positioned,
      x: hasSavedFreePosition ? positioned.x : fallback.x,
      y: hasSavedFreePosition ? positioned.y : fallback.y,
    };
  });
}

export function hasDragStarted(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = DRAG_START_DISTANCE,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function resolveDrop(
  piece: Pick<PositionedPiece, "index" | "row" | "column">,
  topLeft: { x: number; y: number },
  metrics: BoardMetrics,
): DropResult {
  const cellWidth = metrics.width / metrics.columns;
  const cellHeight = metrics.height / metrics.rows;
  const clampedX = Math.max(0, Math.min(metrics.width - cellWidth, topLeft.x));
  const clampedY = Math.max(0, Math.min(metrics.height - cellHeight, topLeft.y));
  const targetX = piece.column * cellWidth;
  const targetY = piece.row * cellHeight;
  const overlapWidth = Math.max(0, Math.min(topLeft.x + cellWidth, targetX + cellWidth) - Math.max(topLeft.x, targetX));
  const overlapHeight = Math.max(0, Math.min(topLeft.y + cellHeight, targetY + cellHeight) - Math.max(topLeft.y, targetY));
  const overlapRatio = overlapWidth * overlapHeight / (cellWidth * cellHeight);
  const fixed = overlapRatio > MAGNETIC_OVERLAP_RATIO;

  return fixed
    ? { x: piece.column / metrics.columns, y: piece.row / metrics.rows, fixed: true, slot: piece.index }
    : { x: clampedX / metrics.width, y: clampedY / metrics.height, fixed: false };
}

export function movePieceToBoard(
  pieces: PositionedPiece[],
  pieceId: string,
  topLeft: { x: number; y: number },
  metrics: BoardMetrics,
): PositionedPiece[] {
  const moving = pieces.find((piece) => piece.id === pieceId);
  if (!moving || moving.fixed) return pieces;
  const drop = resolveDrop(moving, topLeft, metrics);
  return pieces.map((piece) => piece.id === pieceId ? {
    ...piece,
    tray: "board",
    x: drop.x,
    y: drop.y,
    fixed: drop.fixed,
    slot: drop.slot,
  } : piece);
}

/** Retained for exact-slot API fixtures and compatibility tests. */
export function placePiece(pieces: PositionedPiece[], pieceId: string, slot: number): PositionedPiece[] {
  const moving = pieces.find((piece) => piece.id === pieceId);
  if (!moving || moving.fixed || slot < 0 || slot >= pieces.length) return pieces;
  return pieces.map((piece) => piece.id === pieceId ? {
    ...piece,
    tray: "board",
    slot: piece.index === slot ? slot : undefined,
    fixed: piece.index === slot,
  } : piece);
}

export function shuffleUnfixed(pieces: PositionedPiece[]): PositionedPiece[] {
  const movable = pieces.filter((piece) => !piece.fixed);
  let movableIndex = 0;
  return pieces.map((piece) => piece.fixed ? piece : {
    ...piece,
    tray: (movableIndex++ % 2 ? "right" : "left") as "left" | "right",
    slot: undefined,
    ...arrangedPiecePosition(movableIndex - 1, movable.length),
  });
}

export function scatterUnfixed(pieces: PositionedPiece[], seed = Date.now()): PositionedPiece[] {
  const movable = pieces.filter((piece) => !piece.fixed);
  let movableIndex = 0;
  return pieces.map((piece) => piece.fixed ? piece : {
    ...piece,
    tray: (movableIndex++ % 2 ? "right" : "left") as "left" | "right",
    slot: undefined,
    ...scatteredPiecePosition(movableIndex - 1, movable.length, seed),
  });
}

/**
 * Finds the single closest loose piece. It attracts only when it is an original
 * neighbor, the release lands on the matching side, and it is close enough to
 * the matching slot. A closer unrelated piece blocks any automatic snap.
 */
export function snapToNearestNeighbor(
  piece: Pick<PositionedPiece, "id" | "row" | "column">,
  topLeft: { x: number; y: number },
  candidates: CanvasPiecePosition[],
  size: { width: number; height: number },
): NeighborSnap | undefined {
  const movingCenter = { x: topLeft.x + size.width / 2, y: topLeft.y + size.height / 2 };
  const nearest = candidates
    .filter((candidate) => candidate.piece.id !== piece.id)
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(candidate.x + size.width / 2 - movingCenter.x, candidate.y + size.height / 2 - movingCenter.y),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return undefined;
  const rowDelta = piece.row - nearest.candidate.piece.row;
  const columnDelta = piece.column - nearest.candidate.piece.column;
  if (Math.abs(rowDelta) + Math.abs(columnDelta) !== 1) return undefined;
  const x = nearest.candidate.x + columnDelta * size.width;
  const y = nearest.candidate.y + rowDelta * size.height;
  const neighborCenter = { x: nearest.candidate.x + size.width / 2, y: nearest.candidate.y + size.height / 2 };
  const matchingSide = columnDelta < 0 ? movingCenter.x < neighborCenter.x
    : columnDelta > 0 ? movingCenter.x > neighborCenter.x
      : rowDelta < 0 ? movingCenter.y < neighborCenter.y
        : movingCenter.y > neighborCenter.y;
  if (!matchingSide) return undefined;
  const intendedDistance = Math.hypot(topLeft.x - x, topLeft.y - y);
  return intendedDistance <= Math.min(size.width, size.height) * MAGNETIC_NEIGHBOR_RATIO
    ? { x, y, neighborId: nearest.candidate.piece.id }
    : undefined;
}

export function progressPercent(pieces: PositionedPiece[]): number {
  const fixed = pieces.filter((piece) => piece.fixed).length;
  if (fixed === pieces.length) return 100;
  return Math.min(99, Math.round(fixed / pieces.length * 100));
}

export function isEdgePiece(piece: PieceState, rows: number, columns: number): boolean {
  return piece.row === 0 || piece.column === 0 || piece.row === rows - 1 || piece.column === columns - 1;
}
