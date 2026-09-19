import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(process.cwd(), "supabase");

test("M2 migration is repeatable and contains the private-data safety rails", async () => {
  const core = await readFile(join(root, "migrations", "202609130001_m2_core.sql"), "utf8");
  const rls = await readFile(join(root, "migrations", "202609130002_m2_rls.sql"), "utf8");
  for (const table of ["profiles", "puzzles", "puzzle_assets", "favorites", "play_sessions", "completion_records", "recent_plays", "notifications", "feedback", "reports", "idempotency_keys", "otp_challenges", "email_change_requests"]) assert.match(core, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(core, /play_sessions_user_active_unique/);
  assert.match(core, /play_sessions_guest_active_unique/);
  assert.match(core, /create or replace function public\.set_updated_at/);
  assert.match(core, /create or replace function public\.save_play_session/);
  assert.match(core, /create or replace function public\.complete_play_session/);
  assert.match(core, /create or replace function public\.upsert_completion/);
  assert.match(core, /create or replace function public\.touch_recent_play/);
  assert.match(core, /on conflict \(id\) do update set public = false/);
  assert.match(rls, /puzzles_public_or_owner_read/);
  assert.match(rls, /assets_public_or_owner_read/);
  assert.match(rls, /puzzle_assets_private_storage_read/);
  assert.match(rls, /-- OTP 只由服务端 service role 访问/);
});

test("seed is repeatable and contains the complete M2 category set", async () => {
  const seed = await readFile(join(root, "seed.sql"), "utf8");
  assert.match(seed, /on conflict \(slug\) do update/);
  for (const slug of ["landscape", "art", "animal", "illustration", "architecture", "daily", "food", "people", "festival", "other"]) assert.match(seed, new RegExp(`'${slug}'`));
});
