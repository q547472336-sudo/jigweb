import assert from "node:assert/strict";
import test from "node:test";
import { resetDataAdapterForTests, getDataAdapter, supabaseConfigFromEnv } from "./data-adapter.ts";
import { getUser } from "./local-store.ts";

test("Supabase configuration is all-or-nothing", () => {
  assert.equal(supabaseConfigFromEnv({ NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }), null);
  assert.deepEqual(supabaseConfigFromEnv({ NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service" }), { url: "https://example.supabase.co", anonKey: "anon", serviceRoleKey: "service" });
});

test("legacy x-user-id is rejected when Supabase configuration is present", () => {
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"; process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  assert.equal(getUser(new Request("http://local", { headers: { "x-user-id": "forged-user" } })), null);
  if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
  if (previous.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anon;
  if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
  resetDataAdapterForTests();
});

test("missing Supabase configuration selects an explicitly non-production adapter", () => {
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetDataAdapterForTests();
  assert.equal(getDataAdapter().mode, "memory-dev");
  if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
  if (previous.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anon;
  if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
  resetDataAdapterForTests();
});
