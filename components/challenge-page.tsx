"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Pause, Play, Trophy, WifiHigh, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { Challenge, ChallengeAttempt, PuzzleSummary } from "@/lib/client/types";
import { generatePieces, movePieceToBoard, normalizePieces, puzzleEdges, puzzlePiecePath, resolveDrop, type PositionedPiece } from "@/lib/game/engine";
import { useApp } from "./app-provider";
import { PuzzlePieceArtwork } from "./puzzle-game";

type ChallengeData = { challenge: Challenge | null; puzzle: PuzzleSummary | null; attempt: ChallengeAttempt | null };

export function ChallengePage() {
  const { user, requestLogin } = useApp();
  const [data, setData] = useState<ChallengeData>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formalAfterLogin, setFormalAfterLogin] = useState(false);

  const load = useCallback(() => {
    setError("");
    return apiRequest<ChallengeData>("/challenge/today", {}, user?.id).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "挑战加载失败"));
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  async function begin(mode: "formal" | "practice") {
    if (!data?.challenge) return;
    if (mode === "formal" && !user) { setFormalAfterLogin(true); requestLogin(() => undefined); return; }
    setBusy(true); setError("");
    try {
      const created = await apiRequest<{ attempt: ChallengeAttempt }>("/challenge/attempts", { method: "POST", body: JSON.stringify({ challengeId: data.challenge.id, mode }) }, user?.id);
      const started = await apiRequest<{ attempt: ChallengeAttempt }>(`/challenge/attempts/${created.attempt.id}/start`, { method: "POST" }, user?.id);
      setData((current) => current ? { ...current, attempt: started.attempt } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "挑战启动失败"); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (formalAfterLogin && user) { setFormalAfterLogin(false); void begin("formal"); }
    // begin intentionally reads the latest user after the login continuation has completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formalAfterLogin, user]);

  if (error && !data) return <main className="reserved-page"><WarningCircle size={42} /><p className="eyebrow">今日挑战</p><h1>{error}</h1><button className="button primary" onClick={() => void load()}>重试</button></main>;
  if (!data) return <main className="reserved-page"><Clock size={42} /><p className="eyebrow">今日挑战</p><h1>正在准备挑战…</h1></main>;
  if (!data.challenge || !data.puzzle) return <main className="reserved-page"><Clock size={42} /><p className="eyebrow">今日挑战</p><h1>今日挑战暂未开放</h1><p>题目准备好后会在这里出现，不会随机替换其他作品。</p><Link className="button primary" href="/">返回发现</Link></main>;
  if (data.attempt && ["active", "paused", "completed"].includes(data.attempt.status)) return <ChallengeGame puzzle={data.puzzle} challenge={data.challenge} attempt={data.attempt} onUpdate={(attempt) => setData((current) => current ? { ...current, attempt } : current)} onReload={() => void load()} />;
  return <main className="challenge-page">
    <header className="challenge-header"><Link href="/" className="icon-button" aria-label="返回发现"><ArrowLeft /></Link><div><p className="eyebrow">{data.challenge.businessDate} · 今日挑战</p><h1>{data.puzzle.title}</h1></div><Link className="button secondary" href="/leaderboard"><Trophy />排行榜</Link></header>
    <section className="challenge-intro"><div className="challenge-intro-copy"><span className="challenge-mark"><Clock /></span><p className="eyebrow">同一幅图 · 同一套排列</p><h2>和今天的玩家，比拼一段专注时间</h2><p>登录后开始正式挑战，成绩会进入今日排行榜；游客可以先用练习模式熟悉题目。</p><div className="challenge-actions"><button className="button primary" disabled={busy} onClick={() => void begin("formal")}>{busy ? "正在准备…" : user ? "开始正式挑战" : "登录后挑战"}</button><button className="button secondary" disabled={busy} onClick={() => void begin("practice")}>练习模式</button></div>{error ? <p className="field-error" role="alert">{error}</p> : null}</div><div className="challenge-preview"><img src={data.puzzle.imageUrl} alt="" /><div><b>{data.puzzle.pieceCount} 片</b><span>{user ? "正式成绩可入榜" : "练习不计榜"}</span></div></div></section>
  </main>;
}

function ChallengeGame({ puzzle, challenge, attempt, onUpdate, onReload }: { puzzle: PuzzleSummary; challenge: Challenge; attempt: ChallengeAttempt; onUpdate: (attempt: ChallengeAttempt) => void; onReload: () => void }) {
  const { user } = useApp();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [pieces, setPieces] = useState<PositionedPiece[]>(() => challengePieces(puzzle, attempt));
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serverElapsed, setServerElapsed] = useState(attempt.elapsedMs);
  const syncedAt = useRef(Date.now());
  const currentAttempt = useRef(attempt);
  currentAttempt.current = attempt;

  useEffect(() => {
    setPieces(challengePieces(puzzle, attempt)); setServerElapsed(attempt.elapsedMs); syncedAt.current = Date.now(); currentAttempt.current = attempt;
  }, [attempt, puzzle]);

  useEffect(() => {
    if (attempt.status !== "active") return;
    const timer = window.setInterval(() => setServerElapsed(attempt.elapsedMs + Date.now() - syncedAt.current), 100);
    return () => window.clearInterval(timer);
  }, [attempt.elapsedMs, attempt.status]);

  useEffect(() => {
    if (attempt.status !== "active") return;
    const timer = window.setInterval(() => {
      apiRequest<{ attempt: ChallengeAttempt }>(`/challenge/attempts/${attempt.id}`, {}, user?.id).then((result) => { onUpdate(result.attempt); syncedAt.current = Date.now(); }).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [attempt.id, attempt.status, onUpdate, user?.id]);

  const persist = useCallback(async (nextPieces: PositionedPiece[]) => {
    setSaving(true); setError("");
    try {
      const response = await apiRequest<{ attempt: ChallengeAttempt }>(`/challenge/attempts/${currentAttempt.current.id}`, { method: "PUT", body: JSON.stringify({ stateVersion: currentAttempt.current.stateVersion, pieces: nextPieces }) }, user?.id);
      onUpdate(response.attempt); syncedAt.current = Date.now();
      if (nextPieces.every((piece) => piece.fixed)) {
        const completed = await apiRequest<{ attempt: ChallengeAttempt }>(`/challenge/attempts/${currentAttempt.current.id}/complete`, { method: "POST", body: JSON.stringify({ pieces: nextPieces }) }, user?.id);
        onUpdate(completed.attempt);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "进度同步失败"); onReload(); }
    finally { setSaving(false); }
  }, [onReload, onUpdate, user?.id]);

  useEffect(() => {
    function move(event: PointerEvent) {
      const drag = dragRef.current; const board = boardRef.current; if (!drag || !board || drag.pointerId !== event.pointerId) return;
      const rect = board.getBoundingClientRect(); const item = pieces.find((piece) => piece.id === drag.id); if (!item) return;
      const width = rect.width / puzzle.columns; const height = rect.height / puzzle.rows;
      const x = event.clientX - drag.offsetX - rect.left; const y = event.clientY - drag.offsetY - rect.top;
      const next = pieces.map((piece) => piece.id === item.id ? { ...piece, tray: "board" as const, x: Math.max(0, Math.min(1 - 1 / puzzle.columns, x / rect.width)), y: Math.max(0, Math.min(1 - 1 / puzzle.rows, y / rect.height)) } : piece);
      setPieces(next);
      void width; void height;
    }
    async function release(event: PointerEvent) {
      const drag = dragRef.current; const board = boardRef.current; if (!drag || !board || drag.pointerId !== event.pointerId) return;
      dragRef.current = null; setDragging(null); const rect = board.getBoundingClientRect(); const item = pieces.find((piece) => piece.id === drag.id); if (!item) return;
      const width = rect.width / puzzle.columns; const height = rect.height / puzzle.rows; const topLeft = { x: event.clientX - drag.offsetX - rect.left, y: event.clientY - drag.offsetY - rect.top };
      const drop = resolveDrop(item, topLeft, { width: rect.width, height: rect.height, rows: puzzle.rows, columns: puzzle.columns });
      const next = pieces.map((piece) => piece.id === item.id ? { ...piece, tray: "board" as const, x: drop.x, y: drop.y, fixed: drop.fixed, slot: drop.slot } : piece);
      setPieces(next); void width; void height; await persist(next);
    }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
  }, [persist, pieces, puzzle.columns, puzzle.rows]);

  async function togglePause() {
    setError("");
    try { const action = attempt.status === "paused" ? "resume" : "pause"; const result = await apiRequest<{ attempt: ChallengeAttempt }>(`/challenge/attempts/${attempt.id}/pause`, { method: "POST", body: JSON.stringify({ action }) }, user?.id); onUpdate(result.attempt); syncedAt.current = Date.now(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "状态更新失败"); }
  }

  const displayTime = formatDuration(serverElapsed);
  return <main className="challenge-shell">
    <header className="challenge-play-header"><Link href="/" className="icon-button" aria-label="退出挑战"><ArrowLeft /></Link><div><p className="eyebrow">{attempt.mode === "formal" ? "正式挑战" : "练习模式"} · {challenge.businessDate}</p><h1>{puzzle.title}</h1></div><div className="challenge-timer" aria-label={`用时 ${displayTime}`}><Clock /><b>{displayTime}</b></div><span className={`challenge-sync ${saving ? "saving" : ""}`}><WifiHigh />{saving ? "同步中" : "已同步"}</span><button className="button secondary" disabled={attempt.status === "completed"} onClick={() => void togglePause()}>{attempt.status === "paused" ? <Play /> : <Pause />}{attempt.status === "paused" ? "继续" : "暂停"}</button><Link className="button ghost" href="/leaderboard"><Trophy />榜单</Link></header>
    {attempt.status === "paused" ? <div className="challenge-pause"><Pause size={30} /><b>挑战已暂停</b><span>服务端计时已停下，继续后才会恢复。</span><button className="button primary" onClick={() => void togglePause()}>继续挑战</button></div> : null}
    <section className="challenge-playfield" aria-label="今日挑战棋盘"><div className="challenge-target"><div ref={boardRef} className="challenge-board" style={{ aspectRatio: String(puzzle.aspectRatio) }}><div className="target-grid" style={{ gridTemplateColumns: `repeat(${puzzle.columns}, 1fr)`, gridTemplateRows: `repeat(${puzzle.rows}, 1fr)` }}>{pieces.map((piece) => <span key={piece.id} />)}</div>{pieces.filter((piece) => piece.tray === "board").map((piece) => <button key={piece.id} type="button" className={`puzzle-piece on-board ${piece.fixed ? "fixed" : ""} ${dragging === piece.id ? "dragging-source" : ""}`} style={{ left: `${(piece.fixed ? piece.column / puzzle.columns : piece.x ?? 0) * 100}%`, top: `${(piece.fixed ? piece.row / puzzle.rows : piece.y ?? 0) * 100}%`, width: `${100 / puzzle.columns}%`, height: `${100 / puzzle.rows}%` }} onPointerDown={(event) => beginChallengeDrag(piece, event, boardRef, dragRef, setDragging)} disabled={piece.fixed}><PuzzlePieceArtwork piece={piece} puzzle={puzzle} /></button>)}</div></div><div className="challenge-loose-pieces">{pieces.filter((piece) => piece.tray !== "board").map((piece) => <button key={piece.id} type="button" className={`puzzle-piece workspace-piece ${dragging === piece.id ? "dragging-source" : ""}`} style={{ left: `${(piece.x ?? 0) * 100}%`, top: `${(piece.y ?? 0) * 100}%` }} onPointerDown={(event) => beginChallengeDrag(piece, event, boardRef, dragRef, setDragging)}><PuzzlePieceArtwork piece={piece} puzzle={puzzle} /></button>)}</div></section>
    {attempt.status === "completed" ? <div className="challenge-complete"><Trophy size={34} /><p className="eyebrow">挑战完成</p><h2>这次专注了 {displayTime}</h2><p>{attempt.mode === "formal" ? "成绩已提交，去排行榜看看吧。" : "练习完成；登录后开始正式挑战即可参与排名。"}</p><Link className="button primary" href="/leaderboard">查看排行榜</Link></div> : null}
    {error ? <p className="challenge-error" role="alert"><WarningCircle />{error}</p> : null}
  </main>;
}

function beginChallengeDrag(piece: PositionedPiece, event: React.PointerEvent<HTMLButtonElement>, boardRef: React.RefObject<HTMLDivElement | null>, dragRef: React.MutableRefObject<{ id: string; pointerId: number; offsetX: number; offsetY: number } | null>, setDragging: (id: string | null) => void) {
  if (piece.fixed) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); dragRef.current = { id: piece.id, pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }; setDragging(piece.id); void boardRef;
}

function challengePieces(puzzle: PuzzleSummary, attempt: ChallengeAttempt) {
  const generated = normalizePieces(generatePieces(puzzle.id, puzzle.rows, puzzle.columns).map((piece) => { const server = attempt.pieces.find((item) => item.index === piece.index); return server ? { ...piece, ...server, id: server.id } : piece; }), puzzle.rows, puzzle.columns);
  return generated.map((piece) => piece.id.startsWith("piece-") ? piece : { ...piece, id: `piece-${piece.index}` });
}

function formatDuration(value: number) { const safe = Math.max(0, value); const minutes = Math.floor(safe / 60000).toString().padStart(2, "0"); const seconds = Math.floor(safe / 1000 % 60).toString().padStart(2, "0"); const milliseconds = Math.floor(safe % 1000).toString().padStart(3, "0"); return `${minutes}:${seconds}.${milliseconds}`; }
