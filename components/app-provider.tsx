"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CurrentUser } from "@/lib/client/types";
import { apiRequest } from "@/lib/client/api";

type AppContextValue = {
  user: CurrentUser | null;
  requestLogin: (continuation?: () => void) => void;
  logout: () => void;
  updateUser: (next: CurrentUser) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => Promise<void>;
};

const SESSION_KEY = "jigsaw-time-user";

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [favorites, setFavorites] = useState(() => new Set<string>());
  const [showLogin, setShowLogin] = useState(false);
  const [continuation, setContinuation] = useState<(() => void) | undefined>();
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) try { setUser(JSON.parse(saved) as CurrentUser); } catch { localStorage.removeItem(SESSION_KEY); }
  }, []);
  useEffect(() => {
    if (!user) { setFavorites(new Set()); return; }
    apiRequest<{ items: Array<{ id: string }> }>("/me/collections/favorites", {}, user.id)
      .then((result) => setFavorites(new Set(result.items.map((item) => item.id))))
      .catch(() => setFavorites(new Set()));
  }, [user]);
  const value = useMemo(() => ({
    user,
    requestLogin(next?: () => void) { setContinuation(() => next); setShowLogin(true); },
    logout() { setUser(null); localStorage.removeItem(SESSION_KEY); },
    updateUser(next: CurrentUser) { setUser(next); localStorage.setItem(SESSION_KEY, JSON.stringify(next)); },
    favorites,
    async toggleFavorite(id: string) {
      if (!user) { setShowLogin(true); return; }
      const add = !favorites.has(id);
      setFavorites((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
      try { await apiRequest(`/puzzles/${id}/favorite`, { method: add ? "POST" : "DELETE" }, user.id); }
      catch { setFavorites((previous) => { const next = new Set(previous); add ? next.delete(id) : next.add(id); return next; }); }
    },
  }), [favorites, user]);

  function completeLogin(nextUser: CurrentUser) {
    setUser(nextUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setShowLogin(false);
    continuation?.();
    setContinuation(undefined);
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      {showLogin ? <LoginModal onClose={() => setShowLogin(false)} onComplete={completeLogin} /> : null}
    </AppContext.Provider>
  );
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}

function LoginModal({ onClose, onComplete }: { onClose: () => void; onComplete: (user: CurrentUser) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    try {
      if (step === "email") {
        const result = await apiRequest<{ developmentCode?: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) });
        setDevelopmentCode(result.developmentCode); setStep("code");
      } else {
        const result = await apiRequest<{ user: CurrentUser }>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, code }) });
        onComplete(result.user);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "请求失败"); }
    finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="关闭">×</button>
        <p className="eyebrow">保存你的拼图时光</p>
        <h2 id="login-title">{step === "email" ? "登录或注册" : "输入验证码"}</h2>
        <p className="muted">{step === "email" ? "使用邮箱验证码登录，无需设置密码。" : `验证码已发送至 ${email}`}</p>
        {step === "email" ? (
          <label className="field"><span>邮箱</span><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        ) : (
          <label className="field"><span>6 位验证码</span><input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" />{developmentCode ? <small className="muted">本地测试验证码：{developmentCode}</small> : null}</label>
        )}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button className="button primary wide" disabled={busy || (step === "email" ? !email.includes("@") : code.length !== 6)} onClick={submit}>{busy ? "请稍候…" : step === "email" ? "获取验证码" : "验证并登录"}</button>
        {step === "code" ? <button className="button ghost wide" onClick={() => setStep("email")}>更换邮箱</button> : null}
      </section>
    </div>
  );
}
