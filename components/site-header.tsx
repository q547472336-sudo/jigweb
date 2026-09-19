"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { MagnifyingGlass, Plus, UserCircle } from "@phosphor-icons/react";
import { useApp } from "./app-provider";

const categories = ["精选", "风景", "艺术", "动物", "插画", "建筑", "日常", "美食", "人物", "节日", "其他"];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, requestLogin, logout } = useApp();
  const [query, setQuery] = useState("");

  function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="site-header">
      <div className="header-primary shell">
        <Link className="brand" href="/"><span className="brand-symbol">拼</span><span>拼图时光</span></Link>
        <form className="header-search" onSubmit={search} role="search">
          <MagnifyingGlass size={19} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索拼图、作者或关键词" placeholder="搜索拼图、作者或关键词" />
        </form>
        <nav className="header-actions" aria-label="用户导航">
          <Link className="button primary" href={user ? "/create" : "#"} onClick={(event) => { if (!user) { event.preventDefault(); requestLogin(() => router.push("/create")); } }}><Plus size={18} />创建作品</Link>
          <Link className="button ghost" href={user ? "/me" : "#"} onClick={(event) => { if (!user) { event.preventDefault(); requestLogin(() => router.push("/me")); } }}>我的</Link>
          {user ? (
            <button className="avatar-button" onClick={logout} title="点击退出当前演示账号"><span>{user.name.slice(0, 1)}</span><small>{user.name}</small></button>
          ) : (
            <button className="button secondary" onClick={() => requestLogin()}><UserCircle size={19} />登录</button>
          )}
        </nav>
      </div>
      <nav className="category-nav shell" aria-label="作品分类">
        {categories.map((category) => {
          const href = category === "精选" ? "/" : `/category/${encodeURIComponent(category)}`;
          const active = category === "精选" ? pathname === "/" : decodeURIComponent(pathname).includes(`/category/${category}`);
          return <Link key={category} href={href} className={active ? "active" : ""}>{category}</Link>;
        })}
      </nav>
    </header>
  );
}
