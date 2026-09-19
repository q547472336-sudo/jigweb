/**
 * M2 persistence boundary.
 *
 * Routes may use the memory adapter only when Supabase is not configured.
 * The Supabase adapter intentionally uses server-side REST so this project
 * does not need to ship a service-role key or SDK to the browser.
 */
export type PersistenceMode = "memory-dev" | "supabase";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export interface M2DataAdapter {
  readonly mode: PersistenceMode;
  getUserId(request: Request): Promise<string | null>;
  requestEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, code: string): Promise<{ userId: string; email: string; accessToken: string; refreshToken?: string }>;
  table<T = unknown>(table: string, query?: string, request?: Request): Promise<T[]>;
  insert<T = unknown>(table: string, values: unknown, request?: Request): Promise<T[]>;
  update<T = unknown>(table: string, query: string, values: unknown, request?: Request): Promise<T[]>;
  remove<T = unknown>(table: string, query: string, request?: Request): Promise<T[]>;
  rpc<T = unknown>(name: string, args: Record<string, unknown>, request?: Request): Promise<T>;
  createSignedUpload(path: string, contentType: string, request: Request): Promise<{ signedUrl: string; token: string; path: string }>;
}

export function supabaseConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;
}

function bearer(request?: Request) {
  const value = request?.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

class SupabaseRestAdapter implements M2DataAdapter {
  readonly mode = "supabase" as const;
  private readonly config: SupabaseConfig;
  constructor(config: SupabaseConfig) { this.config = config; }

  private async fetchJson<T>(path: string, init: RequestInit = {}, request?: Request): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.config.anonKey);
    headers.set("Authorization", bearer(request) ? `Bearer ${bearer(request)}` : `Bearer ${this.config.serviceRoleKey}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(`${this.config.url}${path}`, { ...init, headers, cache: "no-store" });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
    return payload as T;
  }

  async getUserId(request: Request) {
    const token = bearer(request);
    if (!token) return null;
    const user = await this.fetchJson<{ id?: string }>("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } }, request);
    return typeof user.id === "string" ? user.id : null;
  }

  async requestEmailOtp(email: string) {
    await this.fetchJson("/auth/v1/otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, create_user: true }) });
  }

  async verifyEmailOtp(email: string, code: string) {
    const result = await this.fetchJson<{ user?: { id?: string; email?: string }; access_token?: string; refresh_token?: string }>("/auth/v1/verify", { method: "POST", body: JSON.stringify({ type: "email", email, token: code }) });
    if (!result.user?.id || !result.access_token) throw new Error("Supabase Auth returned no user session");
    return { userId: result.user.id, email: result.user.email ?? email, accessToken: result.access_token, refreshToken: result.refresh_token };
  }

  table<T = unknown>(table: string, query = "", request?: Request) {
    return this.fetchJson<T[]>(`/rest/v1/${table}?select=*${query ? `&${query}` : ""}`, { method: "GET" }, request);
  }

  insert<T = unknown>(table: string, values: unknown, request?: Request) {
    return this.fetchJson<T[]>(`/rest/v1/${table}?select=*`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) }, request);
  }

  update<T = unknown>(table: string, query: string, values: unknown, request?: Request) {
    return this.fetchJson<T[]>(`/rest/v1/${table}?${query}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) }, request);
  }

  remove<T = unknown>(table: string, query: string, request?: Request) {
    return this.fetchJson<T[]>(`/rest/v1/${table}?${query}`, { method: "DELETE", headers: { Prefer: "return=representation" } }, request);
  }

  rpc<T = unknown>(name: string, args: Record<string, unknown>, request?: Request) {
    return this.fetchJson<T>(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }, request);
  }

  async createSignedUpload(path: string, contentType: string, request: Request) {
    if (!/^[0-9a-f-]+\/(?:[0-9a-f-]+)\/(?:original|cropped|game|thumbnail)$/.test(path)) throw new Error("invalid private storage path");
    const result = await this.fetchJson<{ url?: string; token?: string }>(`/storage/v1/object/upload/sign/puzzle-assets/${encodeURIComponent(path)}`, { method: "POST", headers: { "content-type": contentType } }, request);
    if (!result.url || !result.token) throw new Error("Supabase did not return a signed upload URL");
    return { signedUrl: result.url, token: result.token, path };
  }
}

class MemoryDevAdapter implements M2DataAdapter {
  readonly mode = "memory-dev" as const;
  async getUserId(request: Request) { return request.headers.get("x-user-id"); }
  async requestEmailOtp() { return; }
  async verifyEmailOtp(_email: string, _code: string): Promise<{ userId: string; email: string; accessToken: string; refreshToken?: string }> { throw new Error("memory adapter uses local OTP route"); }
  async table<T = unknown>() { return [] as T[]; }
  async insert<T = unknown>() { return [] as T[]; }
  async update<T = unknown>() { return [] as T[]; }
  async remove<T = unknown>() { return [] as T[]; }
  async rpc<T = unknown>() { return null as T; }
  async createSignedUpload(_path: string, _contentType: string, _request: Request): Promise<{ signedUrl: string; token: string; path: string }> { throw new Error("signed upload is unavailable in memory dev adapter"); }
}

let adapter: M2DataAdapter | undefined;
export function getDataAdapter(): M2DataAdapter {
  if (!adapter) adapter = supabaseConfigFromEnv() ? new SupabaseRestAdapter(supabaseConfigFromEnv()!) : new MemoryDevAdapter();
  return adapter!;
}

export async function getRequestUserId(request: Request) {
  const data = getDataAdapter();
  return data.mode === "supabase" ? data.getUserId(request) : request.headers.get("x-user-id");
}

export function resetDataAdapterForTests() { adapter = undefined; }
