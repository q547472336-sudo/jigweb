"use client";

import Link from "next/link";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowCounterClockwise,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowUp,
  CloudCheck,
  Eye,
  FrameCorners,
  Pause,
  Play,
  WarningCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import type { PieceState, PuzzleSnapshot, PuzzleSummary } from "@/lib/client/types";
import { readSnapshot, writeSnapshot } from "@/lib/client/local-db";
import { apiRequest } from "@/lib/client/api";
import {
  generatePieces,
  hasDragStarted,
  isEdgePiece,
  layoutUnfixedPieces,
  movePieceToBoard,
  normalizePieces,
  puzzleEdges,
  realPuzzlePiecePath,
  progressPercent,
  resolveDrop,
  snapToNearestNeighbor,
  type PositionedPiece,
} from "@/lib/game/engine";
import { useApp } from "./app-provider";
import { WorkspacePieceCanvas, type CanvasPieceBounds, type WorkspacePieceCanvasHandle } from "./workspace-piece-canvas";

type GameStatus = "loading" | "ready" | "active" | "paused" | "completed";
type PersistedStatus = "active" | "paused" | "completed";
type SaveState = "idle" | "local-saving" | "local-saved" | "cloud-syncing" | "synced" | "local-error" | "cloud-error" | "conflict";

type CloudSession = {
  id: string;
  stateVersion: number;
  status: "ready" | "active" | "paused" | "completed";
  snapshot: { pieces: PieceState[] };
  updatedAt: string;
};

type ConflictCopy = {
  pieces: PositionedPiece[];
  status: "active" | "paused";
  updatedAt: string;
  version: number;
  device: string;
};

type SaveConflict = { local: ConflictCopy; cloud: ConflictCopy };

type PointerDrag = {
  pointerId: number;
  pieceId: string;
  pieceIds: string[];
  elements: HTMLElement[];
  canvas: boolean;
  board: { rect: DOMRect; metrics: { width: number; height: number; rows: number; columns: number } } | null;
  useOverlay: boolean;
  rafId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  grabRatioX: number;
  grabRatioY: number;
  activeX: number;
  activeY: number;
  width: number;
  height: number;
  started: boolean;
};

type DragVisual = { piece: PositionedPiece; left: number; top: number; width: number; height: number };

type KeyboardGrab = {
  pieceId: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  started: boolean;
};

const SAVE_COPY: Record<SaveState, string> = {
  idle: "未开始",
  "local-saving": "正在保存到本机",
  "local-saved": "已保存到本机",
  "cloud-syncing": "同步中",
  synced: "已同步",
  "local-error": "本机保存失败",
  "cloud-error": "同步失败，可重试",
  conflict: "存档冲突，等待选择",
};

class SessionError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

function joinedPieceIds(pieces: PositionedPiece[], startId: string, workspace: DOMRect, size: { width: number; height: number }) {
  const loose = pieces.filter((piece) => !piece.fixed && piece.tray !== "board");
  const byId = new Map(loose.map((piece) => [piece.id, piece]));
  const visited = new Set<string>([startId]);
  const queue = [startId];
  const tolerance = Math.min(size.width, size.height) * .08;
  while (queue.length) {
    const current = byId.get(queue.shift()!);
    if (!current) continue;
    for (const candidate of loose) {
      if (visited.has(candidate.id) || Math.abs(current.row - candidate.row) + Math.abs(current.column - candidate.column) !== 1) continue;
      const actualX = ((candidate.x ?? 0) - (current.x ?? 0)) * workspace.width;
      const actualY = ((candidate.y ?? 0) - (current.y ?? 0)) * workspace.height;
      const expectedX = (candidate.column - current.column) * size.width;
      const expectedY = (candidate.row - current.row) * size.height;
      if (Math.hypot(actualX - expectedX, actualY - expectedY) <= tolerance) {
        visited.add(candidate.id);
        queue.push(candidate.id);
      }
    }
  }
  return [...visited];
}

export function PuzzleGame({ puzzle }: { puzzle: PuzzleSummary }) {
  const { user, requestLogin } = useApp();
  const router = useRouter();
  const [pieces, setPieces] = useState<PositionedPiece[]>(() => generatePieces(puzzle.id, puzzle.rows, puzzle.columns));
  const [status, setStatus] = useState<GameStatus>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [ghost, setGhost] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referencePosition, setReferencePosition] = useState({ x: 0, y: 0 });
  const [immersive, setImmersive] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);
  const [draggingActive, setDraggingActive] = useState(false);
  const [snapTarget, setSnapTarget] = useState<number | null>(null);
  const [magneticPieceId, setMagneticPieceId] = useState<string | null>(null);
  const [magneticallyJoinedIds, setMagneticallyJoinedIds] = useState<Set<string>>(() => new Set());
  const [keyboardGrab, setKeyboardGrab] = useState<KeyboardGrab | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [conflict, setConflict] = useState<SaveConflict | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const workspaceCanvasRef = useRef<WorkspacePieceCanvasHandle>(null);
  const playSurfaceRef = useRef<HTMLDivElement>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const pauseContinueRef = useRef<HTMLButtonElement>(null);
  const piecesRef = useRef(pieces);
  const statusRef = useRef<GameStatus>(status);
  const dragRef = useRef<PointerDrag | null>(null);
  const viewZoomRef = useRef(zoom);
  const dragReference = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const cloudSession = useRef<{ id: string; stateVersion: number } | undefined>(undefined);
  const pendingCloud = useRef<{ pieces: PositionedPiece[]; status: PersistedStatus } | undefined>(undefined);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSyncing = useRef(false);
  const magneticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const snapTargetRef = useRef<number | null>(null);

  const progress = progressPercent(pieces);
  piecesRef.current = pieces;
  statusRef.current = status;
  viewZoomRef.current = zoom;

  const applyPieces = useCallback((next: PositionedPiece[]) => {
    piecesRef.current = next;
    setPieces(next);
  }, []);

  const playSnapSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioContext.current ?? new AudioCtor();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    gain.connect(context.destination);
    [520, 760].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start + index * 0.014);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + 0.11);
      oscillator.connect(gain);
      oscillator.start(start + index * 0.014);
      oscillator.stop(start + 0.13);
    });
  }, []);

  const markMagneticSnap = useCallback((pieceId: string) => {
    if (magneticTimer.current) clearTimeout(magneticTimer.current);
    setMagneticPieceId(pieceId);
    magneticTimer.current = setTimeout(() => setMagneticPieceId(null), 360);
  }, []);

  const getBoardMetrics = useCallback(() => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return { rect, metrics: { width: rect.width, height: rect.height, rows: puzzle.rows, columns: puzzle.columns } };
  }, [puzzle.columns, puzzle.rows]);

  const getWorkspaceMetrics = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return null;
    return { rect: workspace.getBoundingClientRect() };
  }, []);

  const getLooseLayoutMetrics = useCallback(() => {
    const workspace = workspaceRef.current;
    const board = boardRef.current;
    if (!workspace || !board) return null;
    const workspaceRect = workspace.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const fallbackWidth = Math.min(240, Math.max(44, Math.min(window.innerWidth * .64 / puzzle.columns, window.innerHeight * .7 / puzzle.columns)));
    const pieceSize = workspaceCanvasRef.current?.getPieceSize() ?? {
      width: fallbackWidth,
      height: fallbackWidth / ((puzzle.aspectRatio * puzzle.rows) / puzzle.columns),
    };
    const workspaceWidth = Math.max(1, workspace.clientWidth || workspaceRect.width);
    const workspaceHeight = Math.max(1, workspace.clientHeight || workspaceRect.height);
    const toWorkspaceX = (screenX: number) => screenX - workspaceRect.left;
    const toWorkspaceY = (screenY: number) => screenY - workspaceRect.top;
    const obstacle = (selector: string) => {
      const element = workspace.querySelector<HTMLElement>(selector);
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      return { left: toWorkspaceX(rect.left), top: toWorkspaceY(rect.top), right: toWorkspaceX(rect.right), bottom: toWorkspaceY(rect.bottom) };
    };
    return {
      workspaceWidth,
      workspaceHeight,
      visibleLeft: 0,
      visibleTop: 0,
      visibleRight: workspaceWidth,
      visibleBottom: workspaceHeight,
      boardLeft: toWorkspaceX(boardRect.left),
      boardTop: toWorkspaceY(boardRect.top),
      boardRight: toWorkspaceX(boardRect.right),
      boardBottom: toWorkspaceY(boardRect.bottom),
      pieceWidth: pieceSize.width,
      pieceHeight: pieceSize.height,
      obstacles: [".game-dock", ".reference-restore", ".reference-image"].map(obstacle).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    };
  }, [puzzle.aspectRatio, puzzle.columns, puzzle.rows]);

  const reflowLoosePieces = useCallback((mode: "arranged" | "scattered", seed = 1) => {
    const metrics = getLooseLayoutMetrics();
    if (!metrics) return undefined;
    const next = layoutUnfixedPieces(piecesRef.current, mode, metrics, seed);
    applyPieces(next);
    return next;
  }, [applyPieces, getLooseLayoutMetrics]);

  const openConflict = useCallback((local: ConflictCopy, cloud: ConflictCopy) => {
    setConflict({ local, cloud });
    setSaveState("conflict");
  }, []);

  const fetchLatestCloud = useCallback(async (): Promise<CloudSession | undefined> => {
    if (!cloudSession.current || !user) return undefined;
    return apiRequest<CloudSession>(`/sessions/${cloudSession.current.id}`, {}, user.id);
  }, [user]);

  const updateCloud = useCallback(async (next: PositionedPiece[], nextStatus: PersistedStatus, expectedVersion: number) => {
    if (!cloudSession.current || !user) return expectedVersion;
    const response = await fetch(`/api/v1/sessions/${cloudSession.current.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        stateVersion: expectedVersion,
        status: nextStatus === "completed" ? "active" : nextStatus,
        snapshot: { pieces: next },
      }),
    });
    const payload = await response.json() as { data?: { version: number }; error?: { code: string; message: string } };
    if (!response.ok || payload.error) throw new SessionError(payload.error?.code ?? "SAVE_FAILED", payload.error?.message ?? "同步失败");
    const nextVersion = payload.data?.version ?? expectedVersion + 1;
    cloudSession.current.stateVersion = nextVersion;
    if (nextStatus === "completed") await apiRequest(`/sessions/${cloudSession.current.id}/complete`, { method: "POST" }, user.id);
    return nextVersion;
  }, [user]);

  const syncPendingCloud = useCallback(async () => {
    const pending = pendingCloud.current;
    if (!pending || !cloudSession.current || !user || cloudSyncing.current || conflict) return;
    pendingCloud.current = undefined;
    cloudSyncing.current = true;
    setSaveState("cloud-syncing");
    try {
      const nextVersion = await updateCloud(pending.pieces, pending.status, cloudSession.current.stateVersion);
      cloudSession.current.stateVersion = nextVersion;
      setSaveState("synced");
    } catch (reason) {
      if (reason instanceof SessionError && reason.code === "VERSION_CONFLICT") {
        const latest = await fetchLatestCloud().catch(() => undefined);
        if (latest && (latest.status === "active" || latest.status === "paused")) {
          cloudSession.current.stateVersion = latest.stateVersion;
          openConflict(
            { pieces: pending.pieces, status: pending.status === "completed" ? "active" : pending.status, updatedAt: new Date().toISOString(), version: Date.now(), device: "当前浏览器" },
            { pieces: normalizePieces(latest.snapshot.pieces, puzzle.rows, puzzle.columns), status: latest.status, updatedAt: latest.updatedAt, version: latest.stateVersion, device: "另一设备或标签页" },
          );
        } else setSaveState("cloud-error");
      } else {
        pendingCloud.current = pending;
        setSaveState("cloud-error");
      }
    } finally {
      cloudSyncing.current = false;
      if (pendingCloud.current && !conflict) {
        if (cloudTimer.current) clearTimeout(cloudTimer.current);
        cloudTimer.current = setTimeout(() => void syncPendingCloud(), 2000);
      }
    }
  }, [conflict, fetchLatestCloud, openConflict, puzzle.columns, puzzle.rows, updateCloud, user]);

  const persist = useCallback(async (next: PositionedPiece[], nextStatus: PersistedStatus, immediateCloud = false) => {
    setSaveState("local-saving");
    const snapshot: PuzzleSnapshot = {
      sessionId: `local-${puzzle.id}`,
      puzzleId: puzzle.id,
      version: Date.now(),
      status: nextStatus,
      pieces: next,
      updatedAt: new Date().toISOString(),
    };
    try {
      await writeSnapshot(snapshot);
      setSaveState("local-saved");
    } catch {
      setSaveState("local-error");
      return;
    }
    if (!cloudSession.current || !user || conflict) return;
    pendingCloud.current = { pieces: next, status: nextStatus };
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    if (immediateCloud) void syncPendingCloud();
    else cloudTimer.current = setTimeout(() => void syncPendingCloud(), 2000);
  }, [conflict, puzzle.id, syncPendingCloud, user]);

  useEffect(() => {
    let cancelled = false;
    const cloudPromise = user
      ? apiRequest<CloudSession>("/sessions", { method: "POST", body: JSON.stringify({ puzzleId: puzzle.id }) }, user.id)
      : Promise.resolve(undefined);
    Promise.allSettled([readSnapshot(puzzle.id), cloudPromise]).then(([localResult, cloudResult]) => {
      if (cancelled) return;
      const local = localResult.status === "fulfilled" ? localResult.value : undefined;
      const cloud = cloudResult.status === "fulfilled" ? cloudResult.value : undefined;
      const expectedPieceCount = puzzle.rows * puzzle.columns;
      if (cloud && cloud.snapshot.pieces.length === expectedPieceCount) cloudSession.current = { id: cloud.id, stateVersion: cloud.stateVersion };
      const localPlayable = local && local.pieces.length === expectedPieceCount && (local.status === "active" || local.status === "paused") ? local : undefined;
      const cloudPlayable = cloud && cloud.snapshot.pieces.length === expectedPieceCount && (cloud.status === "active" || cloud.status === "paused") ? cloud : undefined;

      if (localPlayable && cloudPlayable) {
        const localPieces = normalizePieces(localPlayable.pieces, puzzle.rows, puzzle.columns);
        const cloudPieces = normalizePieces(cloudPlayable.snapshot.pieces, puzzle.rows, puzzle.columns);
        const localStatus = localPlayable.status === "paused" ? "paused" : "active";
        const cloudStatus = cloudPlayable.status === "paused" ? "paused" : "active";
        applyPieces(localPieces);
        setStatus(localStatus);
        openConflict(
          { pieces: localPieces, status: localStatus, updatedAt: localPlayable.updatedAt, version: localPlayable.version, device: "当前浏览器" },
          { pieces: cloudPieces, status: cloudStatus, updatedAt: cloudPlayable.updatedAt, version: cloudPlayable.stateVersion, device: "云端存档" },
        );
      } else if (cloudPlayable) {
        applyPieces(normalizePieces(cloudPlayable.snapshot.pieces, puzzle.rows, puzzle.columns));
        setStatus(cloudPlayable.status);
        setSaveState("synced");
      } else if (localPlayable) {
        applyPieces(normalizePieces(localPlayable.pieces, puzzle.rows, puzzle.columns));
        setStatus(localPlayable.status);
        setSaveState("local-saved");
      } else {
        setStatus("ready");
        setSaveState(localResult.status === "rejected" ? "local-error" : "idle");
      }
    });
    return () => { cancelled = true; };
  }, [applyPieces, openConflict, puzzle.columns, puzzle.id, puzzle.rows, reflowLoosePieces, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (statusRef.current === "loading" || statusRef.current === "ready") reflowLoosePieces("arranged", puzzle.id.length * 7919);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [puzzle.id, reflowLoosePieces]);

  useEffect(() => () => {
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    if (magneticTimer.current) clearTimeout(magneticTimer.current);
  }, []);

  useEffect(() => {
    if (status === "paused") pauseContinueRef.current?.focus();
    if (status === "active" && !dragRef.current) setImmersive(true);
    if (status !== "active") setImmersive(false);
  }, [status]);

  useEffect(() => {
    if ((status === "ready" || status === "active") && pieces.length > 0 && pieces.every((piece) => piece.fixed)) {
      statusRef.current = "completed";
      setStatus("completed");
      setAnnouncement("拼图完成");
    }
  }, [pieces, status]);

  useEffect(() => {
    function moveReference(event: PointerEvent) {
      if (!dragReference.current) return;
      setReferencePosition({
        x: dragReference.current.x + event.clientX - dragReference.current.startX,
        y: dragReference.current.y + event.clientY - dragReference.current.startY,
      });
    }
    function releaseReference() { dragReference.current = null; }
    window.addEventListener("pointermove", moveReference);
    window.addEventListener("pointerup", releaseReference);
    return () => {
      window.removeEventListener("pointermove", moveReference);
      window.removeEventListener("pointerup", releaseReference);
    };
  }, []);

  useEffect(() => {
    function setDragElementsTransform(drag: PointerDrag, x: number, y: number) {
      if (drag.canvas) {
        workspaceCanvasRef.current?.setDragOffset(drag.pieceIds, x, y);
        return;
      }
      const scale = drag.useOverlay ? viewZoomRef.current : 1;
      const transform = `translate3d(${x / scale}px, ${y / scale}px, 0)`;
      drag.elements.forEach((element) => { element.style.transform = transform; });
      if (drag.useOverlay && drag.pieceIds.length === 1 && dragOverlayRef.current) {
        dragOverlayRef.current.style.transform = transform;
      }
    }

    function clearDragElementsTransform(drag: PointerDrag) {
      if (drag.canvas) {
        workspaceCanvasRef.current?.clearDrag();
        return;
      }
      drag.elements.forEach((element) => { element.style.transform = ""; element.classList.remove("pointer-dragging"); });
    }

    function updateDragPosition(drag: PointerDrag, clientX: number, clientY: number) {
      if (!drag.started && hasDragStarted({ x: drag.startX, y: drag.startY }, { x: clientX, y: clientY })) {
        drag.started = true;
        drag.activeX = clientX;
        drag.activeY = clientY;
        setDraggingActive(true);
        if (drag.useOverlay && drag.pieceIds.length === 1) {
          const piece = piecesRef.current.find((item) => item.id === drag.pieceId);
          if (piece) setDragVisual({ piece, left: clientX - drag.grabRatioX * drag.width, top: clientY - drag.grabRatioY * drag.height, width: drag.width, height: drag.height });
        }
        if (statusRef.current === "ready") {
          statusRef.current = "active";
          setStatus("active");
        }
      }
      if (!drag.started) return;
      setDragElementsTransform(drag, clientX - drag.startX, clientY - drag.startY);
    }

    function move(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (drag.rafId !== null) return;
      drag.rafId = window.requestAnimationFrame(() => {
        drag.rafId = null;
        const activeDrag = dragRef.current;
        if (!activeDrag || activeDrag.pointerId !== drag.pointerId) return;
        updateDragPosition(activeDrag, activeDrag.lastX, activeDrag.lastY);
      });
    }

    function release(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (event.type !== "pointercancel") updateDragPosition(drag, event.clientX, event.clientY);
      dragRef.current = null;
      if (event.type !== "pointercancel" && drag.started && statusRef.current === "active") setImmersive(true);
      if (drag.rafId !== null) window.cancelAnimationFrame(drag.rafId);
      clearDragElementsTransform(drag);
      setDraggingActive(false);
      setDragVisual(null);
      setSnapTarget(null);
      snapTargetRef.current = null;
      if (event.type === "pointercancel") return;
      if (!drag.started) {
        setSelected(drag.pieceId);
        return;
      }
      const board = getBoardMetrics();
      const workspace = getWorkspaceMetrics();
      const moving = piecesRef.current.find((item) => item.id === drag.pieceId);
      if (!board || !workspace || !moving) return;
      const cellWidth = board.rect.width / puzzle.columns;
      const cellHeight = board.rect.height / puzzle.rows;
      const topLeft = {
        x: event.clientX - drag.grabRatioX * drag.width - board.rect.left,
        y: event.clientY - drag.grabRatioY * drag.height - board.rect.top,
      };
      const centerX = topLeft.x + cellWidth / 2;
      const centerY = topLeft.y + cellHeight / 2;
      const insideBoard = centerX >= 0 && centerX <= board.rect.width && centerY >= 0 && centerY <= board.rect.height;
      const boardDrop = insideBoard ? resolveDrop(moving, topLeft, board.metrics) : undefined;
      if (boardDrop?.fixed && drag.pieceIds.length === 1) {
        const next = movePieceToBoard(piecesRef.current, moving.id, topLeft, board.metrics);
        const placed = next.find((item) => item.id === moving.id)!;
        const allFixed = next.every((piece) => piece.fixed);
        applyPieces(next);
        setSelected(null);
        setSelectedGroupIds([]);
        setStatus(allFixed ? "completed" : "active");
        statusRef.current = allFixed ? "completed" : "active";
        markMagneticSnap(placed.id);
        playSnapSound();
        setAnnouncement(`碎片 ${placed.index + 1} 已固定到主图`);
        void persist(next, allFixed ? "completed" : "active");
        return;
      }

      const looseTopLeft = moving.tray !== "board"
        ? {
          x: (moving.x ?? 0) * workspace.rect.width + event.clientX - drag.startX,
          y: (moving.y ?? 0) * workspace.rect.height + event.clientY - drag.startY,
        }
        : {
          x: event.clientX - drag.grabRatioX * drag.width - workspace.rect.left,
          y: event.clientY - drag.grabRatioY * drag.height - workspace.rect.top,
        };
      const candidates = piecesRef.current.filter((piece) => !drag.pieceIds.includes(piece.id)).map((piece) => {
        if (piece.tray === "board") {
          const x = (board.rect.left - workspace.rect.left) + (piece.fixed ? piece.column / puzzle.columns : piece.x ?? 0) * board.rect.width;
          const y = (board.rect.top - workspace.rect.top) + (piece.fixed ? piece.row / puzzle.rows : piece.y ?? 0) * board.rect.height;
          return { piece, x, y };
        }
        return { piece, x: (piece.x ?? 0) * workspace.rect.width, y: (piece.y ?? 0) * workspace.rect.height };
      });
      const neighbor = snapToNearestNeighbor(moving, looseTopLeft, candidates, { width: drag.width, height: drag.height });
      const finalTopLeft = neighbor ? { x: neighbor.x, y: neighbor.y } : looseTopLeft;
      const targetTopLeft = {
        x: board.rect.left - workspace.rect.left + moving.column / puzzle.columns * board.rect.width,
        y: board.rect.top - workspace.rect.top + moving.row / puzzle.rows * board.rect.height,
      };
      const snappedIntoTarget = Boolean(neighbor && Math.hypot(finalTopLeft.x - targetTopLeft.x, finalTopLeft.y - targetTopLeft.y) <= 2);
      if (snappedIntoTarget && drag.pieceIds.length === 1) {
        const next = piecesRef.current.map((piece) => piece.id === moving.id ? {
          ...piece,
          tray: "board" as const,
          x: moving.column / puzzle.columns,
          y: moving.row / puzzle.rows,
          fixed: true,
          slot: moving.index,
        } : piece);
        const allFixed = next.every((piece) => piece.fixed);
        applyPieces(next);
        setSelected(null);
        setSelectedGroupIds([]);
        setStatus(allFixed ? "completed" : "active");
        statusRef.current = allFixed ? "completed" : "active";
        markMagneticSnap(moving.id);
        playSnapSound();
        setAnnouncement(allFixed ? "拼图完成" : `碎片 ${moving.index + 1} 已吸附并固定到主图`);
        void persist(next, allFixed ? "completed" : "active");
        return;
      }
      if (neighbor) {
        const neighborPiece = piecesRef.current.find((piece) => piece.id === neighbor.neighborId);
        const neighborGroupIds = neighborPiece && !neighborPiece.fixed && neighborPiece.tray !== "board"
          ? joinedPieceIds(piecesRef.current, neighborPiece.id, workspace.rect, { width: drag.width, height: drag.height })
          : [neighbor.neighborId];
        const mergedGroupIds = Array.from(new Set([...drag.pieceIds, ...neighborGroupIds]));
        setMagneticallyJoinedIds((current) => {
          const next = new Set(current);
          drag.pieceIds.forEach((id) => next.add(id));
          next.add(neighbor.neighborId);
          return next;
        });
        setSelectedGroupIds(mergedGroupIds);
        markMagneticSnap(moving.id);
        playSnapSound();
      }
      if (insideBoard && !neighbor && drag.pieceIds.length === 1) {
        const next = movePieceToBoard(piecesRef.current, moving.id, topLeft, board.metrics);
        const placed = next.find((item) => item.id === moving.id)!;
        applyPieces(next);
        setSelected(placed.id);
        setSelectedGroupIds([placed.id]);
        setStatus("active");
        statusRef.current = "active";
        setAnnouncement(`碎片 ${placed.index + 1} 已留在主图区域`);
        void persist(next, "active");
        return;
      }
      const workspacePosition = (piece: PositionedPiece) => piece.tray === "board"
        ? {
          x: board.rect.left - workspace.rect.left + (piece.fixed ? piece.column / puzzle.columns : piece.x ?? 0) * board.rect.width,
          y: board.rect.top - workspace.rect.top + (piece.fixed ? piece.row / puzzle.rows : piece.y ?? 0) * board.rect.height,
        }
        : { x: (piece.x ?? 0) * workspace.rect.width, y: (piece.y ?? 0) * workspace.rect.height };
      const movingOrigin = workspacePosition(moving);
      const delta = { x: finalTopLeft.x - movingOrigin.x, y: finalTopLeft.y - movingOrigin.y };
      const groupIds = new Set(drag.pieceIds);
      const next = piecesRef.current.map((piece) => {
        if (!groupIds.has(piece.id)) return piece;
        const origin = workspacePosition(piece);
        const nextX = (origin.x + delta.x) / workspace.rect.width;
        const nextY = (origin.y + delta.y) / workspace.rect.height;
        return {
          ...piece,
          tray: nextX < .5 ? "left" as const : "right" as const,
          x: nextX,
          y: nextY,
          fixed: false,
          slot: undefined,
        };
      });
      applyPieces(next);
      setSelected(moving.id);
      if (!neighbor) setSelectedGroupIds(drag.pieceIds);
      setStatus("active");
      statusRef.current = "active";
      setAnnouncement(neighbor ? `碎片 ${moving.index + 1} 已与相邻碎片吸附` : `碎片 ${moving.index + 1} 已放在桌面自由区`);
      void persist(next, "active");
    }

    window.addEventListener("pointermove", move, { passive: true });
    const commitRelease = (event: PointerEvent) => flushSync(() => release(event));
    window.addEventListener("pointerup", commitRelease);
    window.addEventListener("pointercancel", commitRelease);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", commitRelease);
      window.removeEventListener("pointercancel", commitRelease);
    };
  }, [applyPieces, getBoardMetrics, getWorkspaceMetrics, markMagneticSnap, persist, playSnapSound, puzzle.columns, puzzle.rows]);

  const beginPointerDrag = useCallback((piece: PositionedPiece, event: React.PointerEvent<HTMLButtonElement>) => {
    if (piece.fixed || statusRef.current === "paused" || statusRef.current === "completed" || conflict) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const board = getBoardMetrics();
    const workspace = getWorkspaceMetrics();
    const pieceIds = workspace && piece.tray !== "board"
      ? joinedPieceIds(piecesRef.current, piece.id, workspace.rect, { width: rect.width, height: rect.height })
      : [piece.id];
    const pieceIdSet = new Set(pieceIds);
    const elements = [...document.querySelectorAll<HTMLElement>("[data-piece-id]")]
      .filter((element) => element.dataset.pieceId && pieceIdSet.has(element.dataset.pieceId));
    elements.forEach((element) => element.classList.add("pointer-dragging"));
    dragRef.current = {
      pointerId: event.pointerId,
      pieceId: piece.id,
      pieceIds,
      elements,
      canvas: false,
      board,
      useOverlay: piece.tray === "board",
      rafId: null,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      grabRatioX: (event.clientX - rect.left) / rect.width,
      grabRatioY: (event.clientY - rect.top) / rect.height,
      activeX: event.clientX,
      activeY: event.clientY,
      width: rect.width,
      height: rect.height,
      started: false,
    };
    setSelected(piece.id);
    setSelectedGroupIds(pieceIds);
  }, [conflict, getBoardMetrics, getWorkspaceMetrics]);

  const beginCanvasPointerDrag = useCallback((piece: PositionedPiece, event: React.PointerEvent<HTMLDivElement>, bounds: CanvasPieceBounds) => {
    if (statusRef.current === "paused" || statusRef.current === "completed" || conflict) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const workspace = getWorkspaceMetrics();
    if (!workspace) return;
    const pieceIds = joinedPieceIds(piecesRef.current, piece.id, workspace.rect, { width: bounds.width, height: bounds.height });
    dragRef.current = {
      pointerId: event.pointerId,
      pieceId: piece.id,
      pieceIds,
      elements: [],
      canvas: true,
      board: getBoardMetrics(),
      useOverlay: false,
      rafId: null,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      grabRatioX: (event.clientX - bounds.left) / bounds.width,
      grabRatioY: (event.clientY - bounds.top) / bounds.height,
      activeX: event.clientX,
      activeY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      started: false,
    };
    // Remove the source from the base layer immediately, before the first
    // pointermove, so the drag never shows two copies of the same fragment.
    workspaceCanvasRef.current?.setDragOffset(pieceIds, 0, 0);
    setSelected(piece.id);
    setSelectedGroupIds(pieceIds);
  }, [conflict, getBoardMetrics, getWorkspaceMetrics]);

  function handleWorkspaceWheel(event: React.WheelEvent<HTMLElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const currentZoom = viewZoomRef.current;
    const nextZoom = Math.max(.65, Math.min(2, currentZoom * (event.deltaY < 0 ? 1.12 : .89)));
    viewZoomRef.current = nextZoom;
    setZoom(nextZoom);
  }

  const handlePieceKey = useCallback((piece: PositionedPiece, event: React.KeyboardEvent<HTMLElement>) => {
    if (piece.fixed || status === "paused" || status === "completed" || conflict) return;
    const board = getBoardMetrics();
    if (!board) return;
    const activeGrab = keyboardGrab?.pieceId === piece.id ? keyboardGrab : null;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!activeGrab) {
        const startX = piece.tray === "board" && typeof piece.x === "number" ? piece.x : (1 - 1 / puzzle.columns) / 2;
        const startY = piece.tray === "board" && typeof piece.y === "number" ? piece.y : (1 - 1 / puzzle.rows) / 2;
        setKeyboardGrab({ pieceId: piece.id, x: startX, y: startY, startX, startY, started: false });
        setSelected(piece.id);
        const workspace = getWorkspaceMetrics();
        const rect = event.currentTarget.getBoundingClientRect();
        const groupIds = workspace && piece.tray !== "board"
          ? joinedPieceIds(piecesRef.current, piece.id, workspace.rect, { width: rect.width, height: rect.height })
          : [piece.id];
        setSelectedGroupIds(groupIds);
        setAnnouncement(`已抓取碎片 ${piece.index + 1}，使用方向键移动，回车放下，Esc 取消`);
      } else if (!activeGrab.started) {
        setKeyboardGrab(null);
        setAnnouncement(`碎片 ${piece.index + 1} 未移动，已取消抓取`);
      } else {
        const next = movePieceToBoard(piecesRef.current, piece.id, { x: activeGrab.x * board.rect.width, y: activeGrab.y * board.rect.height }, board.metrics);
        const placed = next.find((item) => item.id === piece.id)!;
        const allFixed = next.every((item) => item.fixed);
        applyPieces(next);
        setKeyboardGrab(null);
        setSelected(placed.fixed ? null : placed.id);
        setSelectedGroupIds(placed.fixed ? [] : [placed.id]);
        setStatus(allFixed ? "completed" : "active");
        statusRef.current = allFixed ? "completed" : "active";
        if (placed.fixed) { markMagneticSnap(placed.id); playSnapSound(); }
        setAnnouncement(placed.fixed ? `碎片 ${piece.index + 1} 已固定` : `碎片 ${piece.index + 1} 已放在画布上`);
        void persist(next, allFixed ? "completed" : "active");
      }
      return;
    }
    if (event.key === "Escape" && activeGrab) {
      event.preventDefault();
      setKeyboardGrab(null);
      setAnnouncement(`碎片 ${piece.index + 1} 已回到抓取前位置`);
      if (activeGrab.started) void persist(piecesRef.current, "active");
      return;
    }
    if (!activeGrab && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && event.currentTarget.closest(".workspace-pieces, .workspace-piece-canvas")) {
      event.preventDefault();
      const workspaceItems = piecesRef.current.filter((item) => !item.fixed && item.tray !== "board");
      const currentIndex = workspaceItems.findIndex((item) => item.id === piece.id);
      const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next = workspaceItems[(currentIndex + direction + workspaceItems.length) % workspaceItems.length];
      if (next) {
        const nextId = next.id;
        setSelected(nextId);
        const workspace = getWorkspaceMetrics();
        const size = workspaceCanvasRef.current?.getPieceSize() ?? { width: board.rect.width / puzzle.columns, height: board.rect.height / puzzle.rows };
        setSelectedGroupIds(workspace
          ? joinedPieceIds(piecesRef.current, nextId, workspace.rect, size)
          : [nextId]);
      }
      return;
    }
    if (!activeGrab || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const stepX = (event.shiftKey ? 1 : 0.1) / puzzle.columns;
    const stepY = (event.shiftKey ? 1 : 0.1) / puzzle.rows;
    let x = activeGrab.x;
    let y = activeGrab.y;
    if (event.key === "ArrowLeft") x -= stepX;
    if (event.key === "ArrowRight") x += stepX;
    if (event.key === "ArrowUp") y -= stepY;
    if (event.key === "ArrowDown") y += stepY;
    x = Math.max(0, Math.min(1 - 1 / puzzle.columns, x));
    y = Math.max(0, Math.min(1 - 1 / puzzle.rows, y));
    const started = activeGrab.started || hasDragStarted(
      { x: activeGrab.startX * board.rect.width, y: activeGrab.startY * board.rect.height },
      { x: x * board.rect.width, y: y * board.rect.height },
    );
    setKeyboardGrab({ ...activeGrab, x, y, started });
    if (started && statusRef.current === "ready") {
      statusRef.current = "active";
      setStatus("active");
    }
  }, [applyPieces, conflict, getBoardMetrics, getWorkspaceMetrics, keyboardGrab, markMagneticSnap, persist, playSnapSound, puzzle.columns, puzzle.rows, status]);

  function organizePieces() {
    if (status === "paused" || status === "completed") return;
    const next = reflowLoosePieces("arranged");
    if (!next) return;
    setMagneticallyJoinedIds(new Set());
    setSelected(null);
    setSelectedGroupIds([]);
    setKeyboardGrab(null);
    if (status === "active") void persist(next, "active");
    setAnnouncement("未固定碎片已整理在主图四周");
  }

  function resetUnfixedPieces() {
    if (status === "paused" || status === "completed") return;
    const metrics = getLooseLayoutMetrics();
    if (!metrics) return;
    const cleared = piecesRef.current.map((piece) => piece.fixed ? piece : {
      ...piece,
      tray: "left" as const,
      x: undefined,
      y: undefined,
      slot: undefined,
      fixed: false,
    });
    const next = layoutUnfixedPieces(cleared, "arranged", metrics);
    applyPieces(next);
    setMagneticallyJoinedIds(new Set());
    setSelected(null);
    setSelectedGroupIds([]);
    setKeyboardGrab(null);
    if (status === "active") void persist(next, "active");
    setAnnouncement("未固定碎片已复位到主图外");
  }

  async function createRoom() {
    if (!user) { requestLogin(); return; }
    try {
      const result = await apiRequest<{ inviteUrl: string }>("/rooms", { method: "POST", body: JSON.stringify({ puzzleId: puzzle.id, sourceSessionId: cloudSession.current?.id ?? null }) }, user.id);
      router.push(result.inviteUrl);
    } catch (reason) {
      setAnnouncement(reason instanceof Error ? reason.message : "房间创建失败");
    }
  }

  async function chooseConflict(copy: "local" | "cloud") {
    if (!conflict) return;
    const chosen = conflict[copy];
    applyPieces(chosen.pieces);
    setStatus(chosen.status);
    statusRef.current = chosen.status;
    setConflict(null);
    if (copy === "cloud") {
      if (cloudSession.current) cloudSession.current.stateVersion = conflict.cloud.version;
      await writeSnapshot({ sessionId: `local-${puzzle.id}`, puzzleId: puzzle.id, version: Date.now(), status: chosen.status, pieces: chosen.pieces, updatedAt: new Date().toISOString() }).catch(() => undefined);
      setSaveState("synced");
      setAnnouncement("已采用云端存档");
      return;
    }
    if (cloudSession.current) cloudSession.current.stateVersion = conflict.cloud.version;
    setSaveState("cloud-syncing");
    setAnnouncement("已保留本机存档，正在同步到云端");
    try {
      const nextVersion = await updateCloud(chosen.pieces, chosen.status, conflict.cloud.version);
      if (cloudSession.current) cloudSession.current.stateVersion = nextVersion;
      setSaveState("synced");
    } catch {
      pendingCloud.current = { pieces: chosen.pieces, status: chosen.status };
      setSaveState("cloud-error");
    }
  }

  const workspacePieces = useMemo(() => pieces.filter((piece) => !piece.fixed && piece.tray !== "board"), [pieces]);

  const boardPieces = useMemo(() => pieces.filter((piece) => piece.tray === "board"), [pieces]);
  const selectedPieceIds = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const workspaceEdgeHighlightedIds = useMemo(() => new Set(
    edgesOnly
      ? workspacePieces.filter((piece) => !magneticallyJoinedIds.has(piece.id) && isEdgePiece(piece, puzzle.rows, puzzle.columns)).map((piece) => piece.id)
      : [],
  ), [edgesOnly, magneticallyJoinedIds, puzzle.columns, puzzle.rows, workspacePieces]);
  const keyboardPiece = keyboardGrab ? pieces.find((piece) => piece.id === keyboardGrab.pieceId) : undefined;
  const targetSlots = useMemo(() => Array.from({ length: pieces.length }, (_, slot) => <span key={slot} />), [pieces.length]);

  return <main className={`game-shell ${immersive ? "is-playing" : ""} ${draggingActive ? "is-dragging" : ""}`}>
    <div className="game-header-reveal" aria-hidden="true" />
    <header className="game-header">
      <Link href="/" className="icon-button" aria-label="返回发现"><ArrowLeft /></Link>
      <div className="game-title"><h1>{puzzle.title}</h1><span>{puzzle.pieceCount} 片</span></div>
      <div className="game-progress" aria-label={`拼图进度 ${progress}%`}><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b></div>
      <SaveStatus state={saveState} onRetry={status === "active" || status === "paused" ? () => void persist(piecesRef.current, statusRef.current === "paused" ? "paused" : "active", true) : undefined} />
      <button className="button secondary game-action game-pause" aria-label={status === "paused" ? "继续拼图" : "暂停拼图"} title={status === "paused" ? "继续拼图" : "暂停拼图"} disabled={status === "loading" || status === "ready" || status === "completed"} onClick={() => {
        if (status === "paused") { setStatus("active"); statusRef.current = "active"; void persist(pieces, "active", true); }
        else { setStatus("paused"); statusRef.current = "paused"; void persist(pieces, "paused", true); }
      }}>{status === "paused" ? <Play /> : <Pause />}</button>
      {puzzle.visibility === "public" ? <button className="button primary game-action game-room" aria-label="一起拼吧" title="一起拼吧" onClick={() => void createRoom()}><UsersThree /></button> : null}
    </header>

    {keyboardGrab ? <div className="keyboard-help">方向键移动 1/10 格，Shift + 方向键移动一格，Enter 放下，Esc 取消</div> : null}

    <section
      ref={workspaceRef}
      className={`game-workspace ${keyboardGrab ? "has-keyboard-help" : ""}`}
      style={{ "--piece-columns": puzzle.columns } as React.CSSProperties}
      aria-label="拼图工作区"
      onWheel={handleWorkspaceWheel}
    >
      <div className="play-surface" style={{ transform: `scale(${zoom})` }}>
      <div className="board-wrap">
        <div className="board-stage">
          <div
            ref={boardRef}
            className={`puzzle-board ${ghost ? "ghost" : ""}`}
            style={{
              aspectRatio: String(puzzle.aspectRatio),
              width: puzzle.aspectRatio >= 1 ? "min(64vw, 70vh)" : "auto",
              height: puzzle.aspectRatio < 1 ? "min(72dvh, calc(100dvh - 180px))" : "auto",
            }}
            role="grid"
            aria-label={`${puzzle.rows} 行 ${puzzle.columns} 列拼图画布`}
          >
            {ghost ? <div className="board-underlay" style={{ backgroundImage: `url(${puzzle.imageUrl})` }} aria-hidden="true" /> : null}
            <div className="target-grid" style={{ gridTemplateColumns: `repeat(${puzzle.columns}, 1fr)`, gridTemplateRows: `repeat(${puzzle.rows}, 1fr)` }} aria-hidden="true">
              {targetSlots}
            </div>
            {boardPieces.map((piece) => <BoardPiece key={piece.id} piece={piece} puzzle={puzzle} selected={selectedPieceIds.has(piece.id)} edgeHighlighted={edgesOnly && !piece.fixed && !magneticallyJoinedIds.has(piece.id) && isEdgePiece(piece, puzzle.rows, puzzle.columns)} magnetic={magneticPieceId === piece.id} hidden={draggingActive && dragRef.current?.useOverlay === true && dragRef.current?.pieceIds.length === 1 && dragRef.current?.pieceId === piece.id || keyboardGrab?.pieceId === piece.id} onPointerDown={beginPointerDrag} onKeyDown={handlePieceKey} />)}
            {keyboardPiece && keyboardGrab ? <BoardPiece piece={{ ...keyboardPiece, tray: "board", x: keyboardGrab.x, y: keyboardGrab.y }} puzzle={puzzle} selected={selectedPieceIds.has(keyboardPiece.id)} magnetic={magneticPieceId === keyboardPiece.id} keyboardGrabbed onPointerDown={beginPointerDrag} onKeyDown={handlePieceKey} /> : null}
          </div>
        </div>
      </div>
      </div>
      <WorkspacePieceCanvas
        ref={workspaceCanvasRef}
        activePieceId={selected}
        pieces={workspacePieces}
        puzzle={puzzle}
        selectedIds={selectedPieceIds}
        edgeHighlightedIds={workspaceEdgeHighlightedIds}
        magneticPieceId={magneticPieceId}
        onPiecePointerDown={beginCanvasPointerDrag}
        onPieceKeyDown={handlePieceKey}
        zoom={zoom}
      />

      {referenceOpen ? <div className="reference-image" style={{ transform: `translate(${referencePosition.x}px, ${referencePosition.y}px)` }}>
        <div className="reference-head" onPointerDown={(event) => { dragReference.current = { ...referencePosition, startX: event.clientX, startY: event.clientY }; }}>
          <span>原图</span>
          <div>
            <button onPointerDown={(event) => event.stopPropagation()} onClick={() => setReferencePosition({ x: 0, y: 0 })} aria-label="复位原图" title="复位原图"><ArrowsClockwise /></button>
            <button onPointerDown={(event) => event.stopPropagation()} onClick={() => setReferenceOpen(false)} aria-label="折叠原图" title="折叠原图"><X /></button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={puzzle.imageUrl} alt={`${puzzle.title}原图`} draggable={false} />
      </div> : <button className="reference-restore button secondary" onClick={() => setReferenceOpen(true)}><Eye />显示原图</button>}

      <div className="game-dock" role="toolbar" aria-label="拼图工具">
        <button aria-label="整理碎片" title="整理碎片" onClick={organizePieces}><ArrowsClockwise /></button>
        <button aria-label="高亮边框碎片" title="高亮边框碎片" aria-pressed={edgesOnly} className={edgesOnly ? "active" : ""} onClick={() => setEdgesOnly((value) => !value)}><FrameCorners /></button>
        <button aria-label="复位碎片" title="复位碎片" onClick={resetUnfixedPieces}><ArrowCounterClockwise /></button>
        <button aria-label="显示或隐藏底板" title="显示或隐藏底板" aria-pressed={ghost} className={ghost ? "active" : ""} onClick={() => setGhost((value) => !value)}><Eye /></button>
      </div>
    </section>

    {dragVisual ? <div
      ref={dragOverlayRef}
      className={`drag-piece ${snapTarget === dragVisual.piece.index ? "snap-ready" : ""}`}
      style={{ left: dragVisual.left, top: dragVisual.top, width: dragVisual.width, height: dragVisual.height }}
      aria-hidden="true"
    ><PuzzlePieceArtwork piece={dragVisual.piece} puzzle={puzzle} /></div> : null}

    <p className="sr-only" aria-live="polite">{announcement}</p>

    {status === "paused" ? <div className="game-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <p className="eyebrow">已暂停</p><h2 id="pause-title">{progress}% 已完成</h2><p className="muted">棋盘和托盘已遮挡，进度已保存到当前浏览器。</p>
      <button ref={pauseContinueRef} className="button primary wide" onClick={() => { setStatus("active"); statusRef.current = "active"; void persist(pieces, "active", true); }}><Play />继续拼图</button>
      <Link className="button ghost wide" href="/" onClick={() => void persist(pieces, "paused", true)}>保存并退出</Link>
    </section></div> : null}

    {status === "completed" ? <div className="game-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <p className="eyebrow">拼图完成</p><h2 id="complete-title">每一片都回到了正确的位置</h2><p className="muted">{puzzle.title} · {puzzle.pieceCount} 片</p>
      <button className="button primary wide" onClick={() => { const next = generatePieces(puzzle.id, puzzle.rows, puzzle.columns); applyPieces(next); setMagneticallyJoinedIds(new Set()); setStatus("ready"); statusRef.current = "ready"; setSaveState("idle"); }}>再拼一次</button>
      <Link className="button ghost wide" href="/">返回发现</Link>
    </section></div> : null}

    {conflict ? <SaveConflictModal conflict={conflict} onChoose={(copy) => void chooseConflict(copy)} /> : null}
  </main>;
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  if (state === "idle") return null;
  const failed = state === "local-error" || state === "cloud-error" || state === "conflict";
  const icon = state === "synced" ? <CloudCheck /> : state === "cloud-syncing" ? <CloudArrowUp /> : failed ? <WarningCircle /> : state === "local-saved" ? <CheckCircle /> : null;
  if ((state === "cloud-error" || state === "local-error") && onRetry) return <button className="save-status error" onClick={onRetry} title="点击重试保存">{icon}<span>{SAVE_COPY[state]}</span></button>;
  return <span className={`save-status ${failed ? "error" : ""}`} aria-live="polite">{icon}<span>{SAVE_COPY[state]}</span></span>;
}

function SaveConflictModal({ conflict, onChoose }: { conflict: SaveConflict; onChoose: (copy: "local" | "cloud") => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLButtonElement>("button");
    first?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
      if (!controls.length) return;
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl.focus(); }
      else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl.focus(); }
    }
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, []);
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal save-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-description">
    <p className="eyebrow">需要你的选择</p><h2 id="conflict-title">发现两份拼图进度</h2>
    <p id="conflict-description" className="muted">选择前不会覆盖任何一份存档。未选版本会由服务端按规则保留备份。</p>
    <div className="conflict-options">
      <ConflictOption title="本机版本" copy={conflict.local} onClick={() => onChoose("local")} />
      <ConflictOption title="云端版本" copy={conflict.cloud} onClick={() => onChoose("cloud")} />
    </div>
  </section></div>;
}

function ConflictOption({ title, copy, onClick }: { title: string; copy: ConflictCopy; onClick: () => void }) {
  const percent = progressPercent(copy.pieces);
  return <article className="conflict-option"><div><b>{title}</b><span>{copy.device}</span></div><strong>{percent}%</strong><div className="conflict-progress"><i style={{ width: `${percent}%` }} /></div><time dateTime={copy.updatedAt}>{formatTime(copy.updatedAt)}</time><button className="button secondary wide" onClick={onClick}>继续此版本</button></article>;
}

const WorkspacePiece = memo(function WorkspacePiece({ piece, puzzle, selected, hidden, magnetic, edgeHighlighted, dragOffset, onPointerDown, onKeyDown }: {
  piece: PositionedPiece;
  puzzle: PuzzleSummary;
  selected: boolean;
  hidden?: boolean;
  magnetic?: boolean;
  edgeHighlighted?: boolean;
  dragOffset?: { x: number; y: number };
  onPointerDown: (piece: PositionedPiece, event: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (piece: PositionedPiece, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return <PieceButton
    piece={piece}
    puzzle={puzzle}
    selected={selected}
    hidden={hidden}
    magnetic={magnetic}
    edgeHighlighted={edgeHighlighted}
    workspace
    workspacePosition={{ left: `${(piece.x ?? 0) * 100}%`, top: `${(piece.y ?? 0) * 100}%`, aspectRatio: String((puzzle.aspectRatio * puzzle.rows) / puzzle.columns), transform: dragOffset ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined }}
    onPointerDown={onPointerDown}
    onKeyDown={onKeyDown}
  />;
});

const BoardPiece = memo(function BoardPiece({ piece, puzzle, selected, hidden, keyboardGrabbed, magnetic, edgeHighlighted, dragOffset, onPointerDown, onKeyDown }: {
  piece: PositionedPiece;
  puzzle: PuzzleSummary;
  selected: boolean;
  hidden?: boolean;
  keyboardGrabbed?: boolean;
  magnetic?: boolean;
  edgeHighlighted?: boolean;
  dragOffset?: { x: number; y: number };
  onPointerDown: (piece: PositionedPiece, event: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (piece: PositionedPiece, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return <PieceButton piece={piece} puzzle={puzzle} selected={selected} hidden={hidden} keyboardGrabbed={keyboardGrabbed} magnetic={magnetic} edgeHighlighted={edgeHighlighted} board boardOffset={dragOffset} onPointerDown={onPointerDown} onKeyDown={onKeyDown} />;
});

const PieceButton = memo(function PieceButton({ piece, puzzle, selected, hidden, board, workspace, workspacePosition, boardOffset, keyboardGrabbed, magnetic, edgeHighlighted, onPointerDown, onKeyDown }: {
  piece: PositionedPiece;
  puzzle: PuzzleSummary;
  selected: boolean;
  hidden?: boolean;
  board?: boolean;
  workspace?: boolean;
  workspacePosition?: React.CSSProperties;
  boardOffset?: { x: number; y: number };
  keyboardGrabbed?: boolean;
  magnetic?: boolean;
  edgeHighlighted?: boolean;
  onPointerDown: (piece: PositionedPiece, event: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (piece: PositionedPiece, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const position = workspace ? workspacePosition ?? {} : board ? {
    left: `${((typeof piece.x === "number" ? piece.x : piece.column / puzzle.columns)) * 100}%`,
    top: `${((typeof piece.y === "number" ? piece.y : piece.row / puzzle.rows)) * 100}%`,
    width: `${100 / puzzle.columns}%`,
    height: `${100 / puzzle.rows}%`,
    transform: boardOffset ? `translate3d(${boardOffset.x}px, ${boardOffset.y}px, 0)` : undefined,
  } : { aspectRatio: String((puzzle.aspectRatio * puzzle.rows) / puzzle.columns) };
  return <button
    type="button"
    onPointerDown={(event) => onPointerDown(piece, event)}
    onKeyDown={(event) => onKeyDown(piece, event)}
    data-piece-button
    data-piece-id={piece.id}
    className={`puzzle-piece ${board ? "on-board" : ""} ${workspace ? "workspace-piece" : ""} ${piece.fixed ? "fixed" : ""} ${selected ? "selected" : ""} ${hidden ? "dragging-source" : ""} ${keyboardGrabbed ? "keyboard-grabbed" : ""} ${magnetic ? "magnetic-snap" : ""} ${edgeHighlighted ? "edge-highlighted" : ""}`}
    style={position}
    aria-label={`碎片 ${piece.index + 1}${piece.fixed ? "，已固定" : keyboardGrabbed ? "，已抓取" : ""}`}
    aria-disabled={piece.fixed}
    disabled={piece.fixed}
  ><PuzzlePieceArtwork piece={piece} puzzle={puzzle} /></button>;
});

export const PuzzlePieceArtwork = memo(function PuzzlePieceArtwork({ piece, puzzle }: { piece: PositionedPiece; puzzle: PuzzleSummary }) {
  const clipId = `puzzle-clip-${useId().replaceAll(":", "")}`;
  const path = realPuzzlePiecePath(puzzleEdges(piece.row, piece.column, puzzle.rows, puzzle.columns));
  return <svg className="puzzle-piece-art" viewBox="-24 -24 148 148" preserveAspectRatio="none" focusable="false" aria-hidden="true">
    <defs><clipPath id={clipId}><path d={path} /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      <image href={puzzle.imageUrl} x={-piece.column * 100} y={-piece.row * 100} width={puzzle.columns * 100} height={puzzle.rows * 100} preserveAspectRatio="none" />
      <path d={path} className="puzzle-piece-sheen" />
    </g>
    <path d={path} className="puzzle-piece-highlight" />
    <path d={path} className="puzzle-piece-outline" />
  </svg>;
});

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "更新时间未知" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
