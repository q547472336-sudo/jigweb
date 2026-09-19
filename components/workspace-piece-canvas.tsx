"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { PuzzleSummary } from "@/lib/client/types";
import { puzzleEdges, realPuzzlePiecePath, type PositionedPiece } from "@/lib/game/engine";

export type CanvasPieceBounds = { left: number; top: number; width: number; height: number };

export type WorkspacePieceCanvasHandle = {
  clearDrag: () => void;
  getPieceSize: () => { width: number; height: number };
  setDragOffset: (pieceIds: string[], x: number, y: number) => void;
};

type WorkspacePieceCanvasProps = {
  activePieceId: string | null;
  edgeHighlightedIds: ReadonlySet<string>;
  magneticPieceId: string | null;
  onPieceKeyDown: (piece: PositionedPiece, event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPiecePointerDown: (piece: PositionedPiece, event: React.PointerEvent<HTMLDivElement>, bounds: CanvasPieceBounds) => void;
  pieces: PositionedPiece[];
  puzzle: PuzzleSummary;
  selectedIds: ReadonlySet<string>;
  zoom: number;
};

type CanvasGeometry = { width: number; height: number; pixelRatio: number; pieceWidth: number; pieceHeight: number };
type DragPaint = { pieceIds: Set<string>; x: number; y: number };
type DragBounds = { left: number; top: number; right: number; bottom: number };

const EMPTY_DRAG: DragPaint = { pieceIds: new Set(), x: 0, y: 0 };

function canvasPieceDimensions(puzzle: PuzzleSummary) {
  // The board is the source of truth for a fragment's visual size. Reading
  // its rendered rectangle also keeps loose pieces matched while the board
  // zoom changes, including portrait puzzles whose height controls the board.
  const board = document.querySelector<HTMLElement>(".puzzle-board");
  const boardRect = board?.getBoundingClientRect();
  if (boardRect && boardRect.width > 0 && boardRect.height > 0) {
    return { width: boardRect.width / puzzle.columns, height: boardRect.height / puzzle.rows };
  }
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(240, Math.max(44, Math.min(viewportWidth * .64 / puzzle.columns, viewportHeight * .7 / puzzle.columns)));
  return { width, height: width / ((puzzle.aspectRatio * puzzle.rows) / puzzle.columns) };
}

export const WorkspacePieceCanvas = forwardRef<WorkspacePieceCanvasHandle, WorkspacePieceCanvasProps>(function WorkspacePieceCanvas(props, ref) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const geometryRef = useRef<CanvasGeometry>({ width: 0, height: 0, pixelRatio: 1, pieceWidth: 44, pieceHeight: 44 });
  const dragRef = useRef<DragPaint>(EMPTY_DRAG);
  const dragBoundsRef = useRef<DragBounds | null>(null);
  const pathCache = useRef(new Map<string, Path2D>());
  const propsRef = useRef(props);
  const piecesByIdRef = useRef(new Map(props.pieces.map((piece) => [piece.id, piece])));
  propsRef.current = props;
  piecesByIdRef.current = new Map(props.pieces.map((piece) => [piece.id, piece]));

  const getPieceSize = useCallback(() => canvasPieceDimensions(props.puzzle), [props.puzzle, props.zoom]);

  const getPath = useCallback((piece: PositionedPiece) => {
    const key = `${props.puzzle.id}:${props.puzzle.rows}:${props.puzzle.columns}:${piece.row}:${piece.column}`;
    const cached = pathCache.current.get(key);
    if (cached) return cached;
    const path = new Path2D(realPuzzlePiecePath(puzzleEdges(piece.row, piece.column, props.puzzle.rows, props.puzzle.columns)));
    pathCache.current.set(key, path);
    return path;
  }, [props.puzzle.columns, props.puzzle.id, props.puzzle.rows]);

  const drawPiece = useCallback((context: CanvasRenderingContext2D, piece: PositionedPiece, x: number, y: number, dragging = false) => {
    const latest = propsRef.current;
    const geometry = geometryRef.current;
    const image = imageRef.current;
    const scaleX = geometry.pieceWidth / 100;
    const scaleY = geometry.pieceHeight / 100;
    const path = getPath(piece);
    context.save();
    context.translate(x, y);
    context.scale(scaleX, scaleY);
    if (dragging) {
      context.shadowColor = "rgba(35, 23, 12, .3)";
      context.shadowBlur = 6 / Math.max(scaleX, scaleY);
      context.shadowOffsetY = 3 / scaleY;
    }
    context.save();
    context.clip(path);
    if (image?.complete && image.naturalWidth > 0) {
      context.drawImage(image, -piece.column * 100, -piece.row * 100, latest.puzzle.columns * 100, latest.puzzle.rows * 100);
    } else {
      context.fillStyle = "#d7c6a8";
      context.fill(path);
    }
    context.restore();
    context.lineJoin = "round";
    context.lineWidth = 1.15 / Math.max(scaleX, scaleY);
    if (latest.selectedIds.has(piece.id)) {
      context.strokeStyle = "rgba(77, 135, 255, .98)";
      context.lineWidth = 2.8 / Math.max(scaleX, scaleY);
    } else if (latest.magneticPieceId === piece.id) {
      context.strokeStyle = "rgba(255, 241, 164, .96)";
      context.lineWidth = 2.5 / Math.max(scaleX, scaleY);
    } else if (latest.edgeHighlightedIds.has(piece.id)) {
      context.strokeStyle = "rgba(255, 238, 144, .98)";
    } else {
      context.strokeStyle = "rgba(54, 31, 14, .7)";
    }
    context.stroke(path);
    context.restore();
  }, [getPath]);

  const clear = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }, []);

  const drawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const geometry = geometryRef.current;
    clear(canvas);
    const dragging = dragRef.current.pieceIds;
    propsRef.current.pieces.forEach((piece) => {
      if (dragging.has(piece.id)) return;
      drawPiece(context, piece, (piece.x ?? 0) * geometry.width, (piece.y ?? 0) * geometry.height);
    });
  }, [clear, drawPiece]);

  const getDragBounds = useCallback((): DragBounds | null => {
    const geometry = geometryRef.current;
    const drag = dragRef.current;
    if (!drag.pieceIds.size) return null;
    const padding = Math.max(12, Math.max(geometry.pieceWidth, geometry.pieceHeight) * .2);
    let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
    drag.pieceIds.forEach((pieceId) => {
      const piece = piecesByIdRef.current.get(pieceId);
      if (!piece) return;
      const x = (piece.x ?? 0) * geometry.width + drag.x;
      const y = (piece.y ?? 0) * geometry.height + drag.y;
      left = Math.min(left, x - padding);
      top = Math.min(top, y - padding);
      right = Math.max(right, x + geometry.pieceWidth + padding);
      bottom = Math.max(bottom, y + geometry.pieceHeight + padding);
    });
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  }, []);

  const clearDragBounds = useCallback((context: CanvasRenderingContext2D, bounds: DragBounds | null) => {
    if (!bounds) return;
    const { pixelRatio } = geometryRef.current;
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    context.restore();
  }, []);

  const drawDrag = useCallback(() => {
    const canvas = dragCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const geometry = geometryRef.current;
    const drag = dragRef.current;
    const nextBounds = getDragBounds();
    const previousBounds = dragBoundsRef.current;
    const dirtyBounds = previousBounds && nextBounds
      ? {
        left: Math.min(previousBounds.left, nextBounds.left),
        top: Math.min(previousBounds.top, nextBounds.top),
        right: Math.max(previousBounds.right, nextBounds.right),
        bottom: Math.max(previousBounds.bottom, nextBounds.bottom),
      }
      : previousBounds ?? nextBounds;
    clearDragBounds(context, dirtyBounds);
    dragBoundsRef.current = nextBounds;
    if (!drag.pieceIds.size) return;
    drag.pieceIds.forEach((pieceId) => {
      const piece = piecesByIdRef.current.get(pieceId);
      if (!piece) return;
      drawPiece(context, piece, (piece.x ?? 0) * geometry.width + drag.x, (piece.y ?? 0) * geometry.height + drag.y, true);
    });
  }, [clearDragBounds, drawPiece, getDragBounds]);

  const resizeCanvases = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const width = Math.max(1, surface.clientWidth);
    const height = Math.max(1, surface.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const size = getPieceSize();
    geometryRef.current = { width, height, pixelRatio, pieceWidth: size.width, pieceHeight: size.height };
    dragBoundsRef.current = null;
    [baseCanvasRef.current, dragCanvasRef.current].forEach((canvas) => {
      if (!canvas) return;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      const context = canvas.getContext("2d");
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    });
    drawBase();
    drawDrag();
  }, [drawBase, drawDrag, getPieceSize]);

  useImperativeHandle(ref, () => ({
    clearDrag: () => {
      dragRef.current = EMPTY_DRAG;
      dragBoundsRef.current = null;
      clear(dragCanvasRef.current);
      drawBase();
    },
    getPieceSize,
    setDragOffset: (pieceIds, x, y) => {
      const current = dragRef.current;
      const nextIds = new Set(pieceIds);
      const idsChanged = current.pieceIds.size !== nextIds.size || [...nextIds].some((id) => !current.pieceIds.has(id));
      dragRef.current = { pieceIds: nextIds, x, y };
      // The base is repainted once when the dragged set changes. Repainting
      // all pieces on every pointer frame causes visible lag on 196-piece
      // puzzles; the drag canvas alone is enough for subsequent frames.
      if (idsChanged) drawBase();
      drawDrag();
    },
  }), [clear, drawBase, drawDrag, getPieceSize]);

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { drawBase(); drawDrag(); };
    image.src = props.puzzle.imageUrl;
    imageRef.current = image;
    return () => { image.onload = null; imageRef.current = null; };
  }, [drawBase, drawDrag, props.puzzle.imageUrl]);

  useEffect(() => {
    resizeCanvases();
    const surface = surfaceRef.current;
    if (!surface) return;
    const observer = new ResizeObserver(resizeCanvases);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [resizeCanvases]);

  useEffect(() => {
    drawBase();
    drawDrag();
  }, [drawBase, drawDrag, props.edgeHighlightedIds, props.magneticPieceId, props.pieces, props.selectedIds]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const geometry = geometryRef.current;
    const hit = [...propsRef.current.pieces].reverse().find((piece) => {
      const pieceX = (piece.x ?? 0) * geometry.width;
      const pieceY = (piece.y ?? 0) * geometry.height;
      const insetX = geometry.pieceWidth * .24;
      const insetY = geometry.pieceHeight * .24;
      return x >= pieceX - insetX && x <= pieceX + geometry.pieceWidth + insetX && y >= pieceY - insetY && y <= pieceY + geometry.pieceHeight + insetY;
    });
    if (!hit) return;
    propsRef.current.onPiecePointerDown(hit, event, {
      left: rect.left + (hit.x ?? 0) * geometry.width,
      top: rect.top + (hit.y ?? 0) * geometry.height,
      width: geometry.pieceWidth,
      height: geometry.pieceHeight,
    });
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const piece = propsRef.current.pieces.find((item) => item.id === propsRef.current.activePieceId);
    if (piece) propsRef.current.onPieceKeyDown(piece, event);
  }, []);

  return <div ref={surfaceRef} className="workspace-piece-canvas" role="group" aria-label="桌面自由区碎片" tabIndex={0} onPointerDown={onPointerDown} onKeyDown={onKeyDown}>
    <canvas ref={baseCanvasRef} aria-hidden="true" />
    <canvas ref={dragCanvasRef} aria-hidden="true" />
  </div>;
});
