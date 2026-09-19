"use client";

import { FormEvent, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { apiRequest } from "@/lib/client/api";

export default function SettingsPage() {
  const { user, updateUser } = useApp();
  const [name, setName] = useState(user?.name ?? ""); const [bio, setBio] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState(""); const [emailStep, setEmailStep] = useState<"idle" | "verify">("idle");
  const [oldCode, setOldCode] = useState(""); const [newCode, setNewCode] = useState(""); const [developmentCode, setDevelopmentCode] = useState("");
  useEffect(() => { if (user) apiRequest<{ name: string; bio: string }>("/me", {}, user.id).then((profile) => { setName(profile.name); setBio(profile.bio); }); }, [user]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!user) return; setError(""); setMessage("");
    try { const profile = await apiRequest<{ name: string; email: string }>("/me", { method: "PATCH", body: JSON.stringify({ displayName: name, bio }) }, user.id); updateUser({ ...user, name: profile.name, email: profile.email }); setMessage("资料已保存"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
  }
  async function requestEmailChange() {
    if (!user) return; setError(""); setMessage("");
    try { const result = await apiRequest<{ developmentOldCode?: string }>("/me/email/change/request", { method: "POST", body: JSON.stringify({ newEmail }) }, user.id); setDevelopmentCode(result.developmentOldCode ?? ""); setEmailStep("verify"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "请求失败"); }
  }
  async function confirmEmailChange() {
    if (!user) return; setError("");
    try { const result = await apiRequest<{ email: string }>("/me/email/change/confirm", { method: "POST", body: JSON.stringify({ oldCode, newCode }) }, user.id); updateUser({ ...user, email: result.email }); setEmailStep("idle"); setNewEmail(""); setMessage("登录邮箱已更换"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "验证失败"); }
  }
  return <><header className="page-heading"><div><h1>账号设置</h1><p>管理个人资料与登录邮箱</p></div></header><form className="settings-form" onSubmit={saveProfile}><section className="form-section"><h2>个人资料</h2><label className="field"><span>昵称</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} /></label><label className="field"><span>简介</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={200} placeholder="介绍一下自己" /></label><button className="button primary">保存资料</button></section><section className="form-section"><h2>登录邮箱</h2><label className="field"><span>当前邮箱</span><input value={user?.email ?? ""} readOnly /></label>{emailStep === "idle" ? <><label className="field"><span>新邮箱</span><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new@example.com" /></label><button type="button" className="button secondary" disabled={!newEmail.includes("@")} onClick={requestEmailChange}>验证并更换</button></> : <><p className="muted">验证码已分别发送至当前邮箱和新邮箱。{developmentCode ? ` 本地测试码：${developmentCode}` : ""}</p><label className="field"><span>当前邮箱验证码</span><input inputMode="numeric" maxLength={6} value={oldCode} onChange={(event) => setOldCode(event.target.value.replace(/\D/g, ""))} /></label><label className="field"><span>新邮箱验证码</span><input inputMode="numeric" maxLength={6} value={newCode} onChange={(event) => setNewCode(event.target.value.replace(/\D/g, ""))} /></label><button type="button" className="button secondary" disabled={oldCode.length !== 6 || newCode.length !== 6} onClick={confirmEmailChange}>确认更换</button></>}</section>{message ? <p className="save-status">{message}</p> : null}{error ? <p className="field-error" role="alert">{error}</p> : null}</form></>;
}
