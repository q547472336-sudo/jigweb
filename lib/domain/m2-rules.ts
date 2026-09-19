import type { Piece, Puzzle, Session } from "@/lib/server/types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export const MIN_IMAGE_EDGE = 300;
export const SESSION_VERSION_CONFLICT = "VERSION_CONFLICT" as const;

export type UploadMetadata = {
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  animated?: boolean;
};

export function validateUploadMetadata(input: UploadMetadata) {
  const mimeType = input.mimeType.toLowerCase();
  if (!("image/jpeg" === mimeType || "image/png" === mimeType || "image/webp" === mimeType)) return "INVALID_IMAGE_TYPE";
  if (!Number.isInteger(input.bytes) || input.bytes < 1 || input.bytes > MAX_IMAGE_BYTES) return "IMAGE_TOO_LARGE";
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < MIN_IMAGE_EDGE || input.height < MIN_IMAGE_EDGE || input.width * input.height > MAX_IMAGE_PIXELS) return "IMAGE_DIMENSION_INVALID";
  if (input.animated === true) return "INVALID_IMAGE_TYPE";
  return null;
}

export function validatePuzzleSnapshot(snapshot: { pieces?: unknown }, puzzle: Puzzle) {
  if (!Array.isArray(snapshot.pieces) || snapshot.pieces.length !== puzzle.pieceCount) return false;
  const ids = new Set<string>();
  for (const candidate of snapshot.pieces) {
    const piece = candidate as Partial<Piece>;
    if (typeof piece.id !== "string" || ids.has(piece.id) || !/^piece-\d+$/.test(piece.id)) return false;
    if (typeof piece.fixed !== "boolean" || !["left", "right", "board"].includes(piece.tray ?? "")) return false;
    if (!Number.isFinite(piece.x) || !Number.isFinite(piece.y)) return false;
    ids.add(piece.id);
  }
  return ids.size === puzzle.pieceCount;
}

export function isCompleteSnapshot(snapshot: { pieces?: unknown }) {
  return Array.isArray(snapshot.pieces) && snapshot.pieces.length > 0 && snapshot.pieces.every((piece) => (piece as Partial<Piece>).fixed === true);
}

export function nextSessionVersion(session: Pick<Session, "stateVersion">, expectedVersion: number) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== session.stateVersion) return { ok: false as const, error: SESSION_VERSION_CONFLICT };
  return { ok: true as const, version: session.stateVersion + 1 };
}
