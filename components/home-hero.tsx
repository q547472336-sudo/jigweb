"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type HomeHeroSlide = {
  id: string;
  title: string;
  imageUrl: string;
  pieceCount: number;
};

export function HomeHero({ slides }: { slides: HomeHeroSlide[] }) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number } | null>(null);
  const activeSlide = slides[activeIndex] ?? slides[0];

  if (!activeSlide) return null;

  function goTo(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
    setDragOffset(0);
  }

  function startRandomPuzzle() {
    const randomIndex = Math.floor(Math.random() * slides.length);
    router.push(`/puzzle/${slides[randomIndex].id}`);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOffset(event.clientX - drag.startX);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const offset = event.clientX - drag.startX;
    dragRef.current = null;
    setDragging(false);
    if (Math.abs(offset) >= 64) goTo(activeIndex + (offset < 0 ? 1 : -1));
    else setDragOffset(0);
  }

  return <section className="hero" aria-labelledby="home-hero-title">
    <div className="hero-copy">
      <p className="eyebrow">今天想拼点什么</p>
      <h1 id="home-hero-title">把喜欢的画面，慢慢拼完整</h1>
      <p>从星际牛仔的霓虹街景，到飞船上的伙伴们，选一幅喜欢的画面，安静地拼到最后。</p>
      <div className="hero-actions">
        <button className="button primary hero-cta" type="button" onClick={startRandomPuzzle}>开始一幅拼图<ArrowRight /></button>
        <span>随机选图 · 默认 14×14 · {activeSlide.pieceCount} 片</span>
      </div>
      <div className="hero-dots" aria-label="选择 banner 图片">
        {slides.map((slide, index) => <button key={slide.id} type="button" className={index === activeIndex ? "active" : ""} aria-label={`查看第 ${index + 1} 幅图片`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => goTo(index)} />)}
      </div>
    </div>
    <div className={`hero-banner ${dragging ? "is-dragging" : ""}`} aria-label="横向切换拼图封面" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      <div className="hero-track" style={{ transform: `translate3d(calc(-${activeIndex * 100}% + ${dragOffset}px), 0, 0)` }}>
        {slides.map((slide) => <article className="hero-slide" key={slide.id} aria-hidden={slide.id !== activeSlide.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={slide.imageUrl} alt={`${slide.title}拼图封面`} draggable={false} />
          <div className="hero-slide-shade" />
          <div className="hero-slide-copy"><strong>{slide.title}</strong><span>{slide.pieceCount} 片 · 经典凹凸拼图</span></div>
        </article>)}
      </div>
      <div className="hero-nav" onPointerDown={(event) => event.stopPropagation()}>
        <button className="icon-button" type="button" aria-label="上一幅图片" onClick={() => goTo(activeIndex - 1)}><ArrowLeft /></button>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        <button className="icon-button" type="button" aria-label="下一幅图片" onClick={() => goTo(activeIndex + 1)}><ArrowRight /></button>
      </div>
      <span className="hero-swipe-hint">左右滑动切换</span>
    </div>
  </section>;
}
