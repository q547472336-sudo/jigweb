import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteSnapshot, nextSessionVersion, validatePuzzleSnapshot, validateUploadMetadata } from "./m2-rules.ts";
import type { Puzzle } from "@/lib/server/types";

const puzzle: Puzzle = { id: "p", ownerId: "u", title: "p", description: "", imageUrl: "/p", aspectRatio: 1, author: { id: "u", name: "u" }, category: "其他", categorySlug: "other", rows: 3, columns: 3, pieceCount: 9, playCount: 0, visibility: "private", status: "published", createdAt: "2026-01-01T00:00:00.000Z", favoriteBy: new Set() };
const pieces = Array.from({ length: 9 }, (_, index) => ({ id: `piece-${index}`, tray: "board" as const, fixed: true, x: 0, y: 0 }));

test("snapshot validation rejects missing, duplicated, or malformed pieces", () => {
  assert.equal(validatePuzzleSnapshot({ pieces }, puzzle), true);
  assert.equal(validatePuzzleSnapshot({ pieces: pieces.slice(0, 8) }, puzzle), false);
  assert.equal(validatePuzzleSnapshot({ pieces: [pieces[0], ...pieces.slice(0, 8)] }, puzzle), false);
  assert.equal(validatePuzzleSnapshot({ pieces: [{ ...pieces[0], x: Number.NaN }, ...pieces.slice(1)] }, puzzle), false);
  assert.equal(isCompleteSnapshot({ pieces }), true);
});

test("session version gate is strict", () => {
  assert.deepEqual(nextSessionVersion({ stateVersion: 3 }, 3), { ok: true, version: 4 });
  assert.equal(nextSessionVersion({ stateVersion: 3 }, 2).ok, false);
});

test("upload limits reject animation, type, bytes, pixels and short edges", () => {
  assert.equal(validateUploadMetadata({ mimeType: "image/png", bytes: 100, width: 300, height: 300 }), null);
  assert.equal(validateUploadMetadata({ mimeType: "image/gif", bytes: 100, width: 300, height: 300 }), "INVALID_IMAGE_TYPE");
  assert.equal(validateUploadMetadata({ mimeType: "image/webp", bytes: 100, width: 300, height: 300, animated: true }), "INVALID_IMAGE_TYPE");
  assert.equal(validateUploadMetadata({ mimeType: "image/png", bytes: 10 * 1024 * 1024 + 1, width: 300, height: 300 }), "IMAGE_TOO_LARGE");
  assert.equal(validateUploadMetadata({ mimeType: "image/png", bytes: 100, width: 299, height: 300 }), "IMAGE_DIMENSION_INVALID");
  assert.equal(validateUploadMetadata({ mimeType: "image/png", bytes: 100, width: 5000, height: 5000 }), "IMAGE_DIMENSION_INVALID");
});
