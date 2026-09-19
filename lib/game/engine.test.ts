import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePieces,
  hasDragStarted,
  isEdgePiece,
  layoutUnfixedPieces,
  movePieceToBoard,
  placePiece,
  progressPercent,
  puzzleEdges,
  puzzlePiecePath,
  resolveDrop,
  scatteredPiecePosition,
  shuffleUnfixed,
  snapToNearestNeighbor,
} from "./engine.ts";

test("generation is deterministic and supports the 500-piece ceiling", () => {
  const first = generatePieces("demo", 20, 25);
  const second = generatePieces("demo", 20, 25);
  assert.deepEqual(first, second);
  assert.equal(first.length, 500);
  assert.equal(first.filter((piece) => piece.tray === "left").length, 250);
  assert.equal(first.every((piece) => Number.isFinite(piece.x) && Number.isFinite(piece.y)), true);
});

test("effective drag starts at three CSS pixels", () => {
  assert.equal(hasDragStarted({ x: 10, y: 10 }, { x: 12.9, y: 10 }), false);
  assert.equal(hasDragStarted({ x: 10, y: 10 }, { x: 13, y: 10 }), true);
  assert.equal(hasDragStarted({ x: 0, y: 0 }, { x: 2.2, y: 2.2 }), true);
});

test("magnetic placement completes when more than half of the piece overlaps its target", () => {
  const piece = generatePieces("demo", 3, 4).find((item) => item.index === 5)!;
  const metrics = { width: 800, height: 600, rows: 3, columns: 4 };
  const targetTopLeft = { x: 200, y: 200 };
  assert.equal(resolveDrop(piece, { x: targetTopLeft.x + 99, y: targetTopLeft.y }, metrics).fixed, true);
  assert.equal(resolveDrop(piece, { x: targetTopLeft.x + 100, y: targetTopLeft.y }, metrics).fixed, false);
});

test("snap decision remains the same after zoom", () => {
  const piece = generatePieces("demo", 3, 4).find((item) => item.index === 5)!;
  const normal = resolveDrop(piece, { x: 299, y: 200 }, { width: 800, height: 600, rows: 3, columns: 4 });
  const zoomed = resolveDrop(piece, { x: 448.5, y: 300 }, { width: 1200, height: 900, rows: 3, columns: 4 });
  assert.equal(normal.fixed, zoomed.fixed);
  assert.equal(normal.fixed, true);
});

test("wrong board drop keeps a clamped free position and correct drop fixes", () => {
  const pieces = generatePieces("demo", 3, 3);
  const moving = pieces.find((piece) => piece.index === 4)!;
  const wrong = movePieceToBoard(pieces, moving.id, { x: -40, y: 20 }, { width: 600, height: 600, rows: 3, columns: 3 });
  const wrongPiece = wrong.find((piece) => piece.id === moving.id)!;
  assert.equal(wrongPiece.fixed, false);
  assert.equal(wrongPiece.tray, "board");
  assert.equal(wrongPiece.x, 0);
  const fixed = placePiece(wrong, moving.id, moving.index);
  assert.equal(fixed.find((piece) => piece.id === moving.id)?.fixed, true);
});

test("progress stays below 100 until every piece is fixed", () => {
  let pieces = generatePieces("demo", 3, 3);
  for (const piece of pieces.slice(0, -1)) pieces = placePiece(pieces, piece.id, piece.index);
  assert.equal(progressPercent(pieces), 89);
  const last = pieces.find((piece) => !piece.fixed)!;
  assert.equal(progressPercent(placePiece(pieces, last.id, last.index)), 100);
});

test("shuffle preserves fixed pieces and returns every movable piece to a tray", () => {
  let pieces = generatePieces("demo", 3, 3);
  pieces = placePiece(pieces, pieces[0].id, pieces[0].index);
  const fixedId = pieces.find((piece) => piece.fixed)!.id;
  pieces = movePieceToBoard(pieces, pieces.find((piece) => !piece.fixed)!.id, { x: 0, y: 0 }, { width: 600, height: 600, rows: 3, columns: 3 });
  const shuffled = shuffleUnfixed(pieces);
  assert.equal(shuffled.find((piece) => piece.id === fixedId)?.fixed, true);
  assert.equal(shuffled.filter((piece) => !piece.fixed && piece.tray === "board").length, 0);
});

test("edge detection follows rows and columns", () => {
  const pieces = generatePieces("demo", 4, 4);
  assert.equal(isEdgePiece(pieces.find((piece) => piece.index === 0)!, 4, 4), true);
  assert.equal(isEdgePiece(pieces.find((piece) => piece.index === 5)!, 4, 4), false);
});

test("traditional jigsaw edges are flat at the outer boundary and complementary inside", () => {
  const first = puzzleEdges(1, 1, 4, 4);
  const right = puzzleEdges(1, 2, 4, 4);
  const below = puzzleEdges(2, 1, 4, 4);
  const corner = puzzleEdges(0, 0, 4, 4);
  assert.equal(first.right, -right.left);
  assert.equal(first.bottom, -below.top);
  assert.equal(corner.top, 0);
  assert.equal(corner.left, 0);
  assert.match(puzzlePiecePath(first), /^M0 0/);
});

test("scattered pieces stay outside the centered main image", () => {
  for (let index = 0; index < 30; index += 1) {
    const position = scatteredPiecePosition(index, 30, 1234);
    assert.equal(position.x > .18 && position.x < .83 && position.y > .14 && position.y < .85, false);
  }
});

test("arranged and scattered layouts fit the visible workspace and avoid controls", () => {
  const pieces = generatePieces("demo", 14, 14);
  const metrics = {
    workspaceWidth: 1280,
    workspaceHeight: 664,
    visibleLeft: 0,
    visibleTop: 0,
    visibleRight: 1280,
    visibleBottom: 664,
    boardLeft: 388,
    boardTop: 139,
    boardRight: 892,
    boardBottom: 475,
    pieceWidth: 44,
    pieceHeight: 29.333,
    obstacles: [{ left: 504, top: 586, right: 776, bottom: 646 }, { left: 1133, top: 18, right: 1258, bottom: 58 }],
  };
  for (const mode of ["arranged", "scattered"] as const) {
    const laidOut = layoutUnfixedPieces(pieces, mode, metrics, 1234);
    assert.equal(laidOut.length, pieces.length);
    assert.equal(new Set(laidOut.map((piece) => `${piece.x}:${piece.y}`)).size, pieces.length);
    assert.ok(laidOut.some((piece) => (piece.y ?? 0) * metrics.workspaceHeight - 7.04 >= metrics.boardBottom));
    for (const piece of laidOut) {
      const left = piece.x! * metrics.workspaceWidth;
      const top = piece.y! * metrics.workspaceHeight;
      const art = { left: left - 10.56, top: top - 7.04, right: left + 54.56, bottom: top + 36.373 }; 
      assert.ok(art.left >= 0 && art.top >= 0 && art.right <= metrics.workspaceWidth && art.bottom <= metrics.workspaceHeight);
      assert.equal(art.left < metrics.boardRight && art.right > metrics.boardLeft && art.top < metrics.boardBottom && art.bottom > metrics.boardTop, false);
      assert.equal(metrics.obstacles.some((obstacle) => art.left < obstacle.right && art.right > obstacle.left && art.top < obstacle.bottom && art.bottom > obstacle.top), false);
    }
  }
});

test("layout preserves an unfixed piece already placed on the board", () => {
  const pieces = generatePieces("demo", 3, 3);
  const boardPiece = { ...pieces[0], tray: "board" as const, x: .21, y: .37, slot: undefined };
  const next = layoutUnfixedPieces([boardPiece, ...pieces.slice(1)], "arranged", {
    workspaceWidth: 900,
    workspaceHeight: 600,
    visibleLeft: 0,
    visibleTop: 0,
    visibleRight: 900,
    visibleBottom: 600,
    boardLeft: 270,
    boardTop: 120,
    boardRight: 630,
    boardBottom: 480,
    pieceWidth: 80,
    pieceHeight: 80,
    obstacles: [],
  });

  assert.deepEqual(next.find((piece) => piece.id === boardPiece.id), boardPiece);
});

test("only a close, correctly-sided nearest original neighbor can magnetically connect", () => {
  const moving = { id: "moving", row: 1, column: 1 };
  const unrelatedNearest = { piece: { id: "unrelated", row: 0, column: 0 }, x: 102, y: 100 };
  const matchingFurther = { piece: { id: "right", row: 1, column: 2 }, x: 220, y: 100 };
  assert.equal(snapToNearestNeighbor(moving, { x: 120, y: 100 }, [unrelatedNearest, matchingFurther], { width: 100, height: 100 }), undefined);

  const matchingNearest = { piece: { id: "right", row: 1, column: 2 }, x: 200, y: 100 };
  assert.equal(snapToNearestNeighbor(moving, { x: 8, y: 285 }, [matchingNearest], { width: 100, height: 100 }), undefined);
  assert.equal(snapToNearestNeighbor(moving, { x: 205, y: 105 }, [matchingNearest], { width: 100, height: 100 }), undefined);
  assert.deepEqual(snapToNearestNeighbor(moving, { x: 109, y: 105 }, [matchingNearest], { width: 100, height: 100 }), { x: 100, y: 100, neighborId: "right" });
});
