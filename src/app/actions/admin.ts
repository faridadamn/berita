"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertAdmin, requireSession } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { saveSettings, type Mode } from "@/lib/settings";
import { completeWithChain, listModels, type ProviderKind } from "@/lib/ai/providers";
import type { ActionState } from "./studio";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, d = 0) => {
  const n = Number(String(f.get(k) ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : d;
};
const fail = (message: string): ActionState => ({ ok: false, message });

/* ───────────── Provider AI ───────────── */

export async function saveProvider(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const id = num(f, "id");
  const kind = str(f, "kind") as ProviderKind;
  if (!["openai", "gemini", "anthropic"].includes(kind)) return fail("Jenis provider tidak valid");
  const name = str(f, "name");
  const model = str(f, "model");
  const baseUrl = str(f, "baseUrl").replace(/\/+$/, "");
  const apiKey = str(f, "apiKey");
  if (!name || !model) return fail("Nama dan model wajib diisi");
  if (baseUrl && !/^https?:\/\//.test(baseUrl)) return fail("Base URL harus diawali http:// atau https://");
  const values = { name, kind, model, baseUrl, priceIn: num(f, "priceIn"), priceOut: num(f, "priceOut") };
  const P = schema.aiProviders;

  if (id) {
    await db().update(P).set({ ...values, ...(apiKey ? { apiKeyEnc: encrypt(apiKey) } : {}) }).where(eq(P.id, id));
  } else {
    if (!apiKey && kind !== "openai") return fail("API key wajib diisi");
    const all = await db().select({ position: P.position }).from(P);
    const position = all.reduce((m, p) => Math.max(m, p.position), -1) + 1;
    await db().insert(P).values({ ...values, apiKeyEnc: apiKey ? encrypt(apiKey) : "", position });
  }
  revalidatePath("/admin/pengaturan");
  return { ok: true, message: "Provider disimpan" };
}

export async function deleteProvider(id: number) {
  await assertAdmin();
  await db().delete(schema.aiProviders).where(eq(schema.aiProviders.id, id));
  revalidatePath("/admin/pengaturan");
}

export async function toggleProvider(id: number, enabled: boolean) {
  await assertAdmin();
  await db().update(schema.aiProviders).set({ enabled }).where(eq(schema.aiProviders.id, id));
  revalidatePath("/admin/pengaturan");
}

/** Geser urutan fallback (dir -1 = naik, 1 = turun). */
export async function moveProvider(id: number, dir: -1 | 1) {
  await assertAdmin();
  const P = schema.aiProviders;
  const list = await db().select({ id: P.id }).from(P).orderBy(asc(P.position), asc(P.id));
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, p] of list.entries()) await db().update(P).set({ position: k }).where(eq(P.id, p.id));
  revalidatePath("/admin/pengaturan");
}

async function providerWithKey(id: number) {
  const [p] = await db().select().from(schema.aiProviders).where(eq(schema.aiProviders.id, id));
  if (!p) throw new Error("Provider tidak ditemukan");
  return { ...p, apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : "" };
}

export async function testProvider(id: number): Promise<ActionState> {
  await assertAdmin();
  try {
    const p = await providerWithKey(id);
    const t0 = Date.now();
    const r = await completeWithChain([p], {
      system: "Jawab singkat.",
      prompt: 'Balas persis dengan JSON {"ok":true}',
      json: true,
      maxTokens: 50,
      temperature: 0,
    });
    return { ok: true, message: `Tersambung · ${Date.now() - t0} ms · ${r.tokensIn}+${r.tokensOut} token · "${r.text.trim().slice(0, 40)}"` };
  } catch (e) {
    return fail((e as Error).message.replace(/^Semua provider gagal — /, ""));
  }
}

export async function fetchModels(id: number): Promise<{ ok: boolean; models?: string[]; message?: string }> {
  await assertAdmin();
  try {
    const p = await providerWithKey(id);
    return { ok: true, models: await listModels(p) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function setProviderModel(id: number, model: string) {
  await assertAdmin();
  if (!model.trim()) return;
  await db().update(schema.aiProviders).set({ model: model.trim() }).where(eq(schema.aiProviders.id, id));
  revalidatePath("/admin/pengaturan");
}

/* ───────────── Pengaturan ───────────── */

export async function saveSettingsAction(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const clampInt = (k: string, min: number, max: number, d: number) => Math.min(max, Math.max(min, Math.round(num(f, k, d))));
  const mode = str(f, "mode") as Mode;
  await saveSettings({
    mode: ["semi", "manual", "off"].includes(mode) ? mode : "semi",
    workStart: clampInt("workStart", 0, 23, 7),
    workEnd: clampInt("workEnd", 1, 24, 22),
    threshold: clampInt("threshold", 0, 100, 70),
    analyzeBatch: clampInt("analyzeBatch", 1, 30, 10),
    draftsPerRun: clampInt("draftsPerRun", 0, 10, 3),
    maxTopicAgeHours: clampInt("maxTopicAgeHours", 1, 336, 48),
    language: str(f, "language").slice(0, 80) || "Bahasa Indonesia santai",
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Pengaturan disimpan" };
}

/* ───────────── Sumber topik ───────────── */

export async function addSource(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const feedUrl = str(f, "feedUrl");
  const name = str(f, "name");
  if (!/^https?:\/\//.test(feedUrl)) return fail("URL feed harus diawali http(s)://");
  if (!name) return fail("Nama media wajib diisi");
  const siteUrl = str(f, "siteUrl") || new URL(feedUrl).origin;
  const category = (str(f, "category") || "AI").toUpperCase().slice(0, 30);
  const r = await db().insert(schema.sources).values({ name, feedUrl, siteUrl, category }).onConflictDoNothing().returning();
  if (!r.length) return fail("Feed ini sudah ada");
  revalidatePath("/admin/sumber");
  return { ok: true, message: `${name} ditambahkan` };
}

export async function toggleSource(id: number, active: boolean) {
  await assertAdmin();
  await db().update(schema.sources).set({ active }).where(eq(schema.sources.id, id));
  revalidatePath("/admin/sumber");
}

export async function deleteSource(id: number) {
  await assertAdmin();
  await db().delete(schema.sources).where(eq(schema.sources.id, id));
  revalidatePath("/admin/sumber");
}

/* ───────────── Tim & akses ───────────── */

export async function addUser(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const email = str(f, "email").toLowerCase();
  const name = str(f, "name");
  const password = str(f, "password");
  const role = str(f, "role") === "admin" ? "admin" : "editor";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return fail("Nama dan email valid wajib diisi");
  if (password.length < 8) return fail("Password minimal 8 karakter");
  const r = await db()
    .insert(schema.users)
    .values({ name, email, role, passwordHash: await bcrypt.hash(password, 10) })
    .onConflictDoNothing()
    .returning();
  if (!r.length) return fail("Email sudah terdaftar");
  revalidatePath("/admin/tim");
  return { ok: true, message: `Akun ${email} dibuat` };
}

/** Pastikan selalu tersisa minimal satu admin aktif. */
async function otherActiveAdmins(id: number) {
  const U = schema.users;
  return db().select({ id: U.id }).from(U).where(and(eq(U.role, "admin"), eq(U.active, true), ne(U.id, id)));
}

export async function setUserActive(id: number, active: boolean): Promise<ActionState> {
  const me = await assertAdmin();
  if (!active && String(id) === me.userId) return fail("Tidak bisa menonaktifkan akun sendiri");
  if (!active && !(await otherActiveAdmins(id)).length) {
    const [u] = await db().select().from(schema.users).where(eq(schema.users.id, id));
    if (u?.role === "admin") return fail("Harus ada minimal satu admin aktif");
  }
  await db().update(schema.users).set({ active }).where(eq(schema.users.id, id));
  revalidatePath("/admin/tim");
  return { ok: true };
}

export async function setUserRole(id: number, role: "admin" | "editor"): Promise<ActionState> {
  await assertAdmin();
  if (role === "editor" && !(await otherActiveAdmins(id)).length) return fail("Harus ada minimal satu admin aktif");
  await db().update(schema.users).set({ role }).where(eq(schema.users.id, id));
  revalidatePath("/admin/tim");
  return { ok: true };
}

export async function resetPassword(id: number, password: string): Promise<ActionState> {
  await assertAdmin();
  if (password.length < 8) return fail("Password minimal 8 karakter");
  await db().update(schema.users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(schema.users.id, id));
  return { ok: true, message: "Password diganti" };
}

/** Ganti password sendiri (semua role). */
export async function changeOwnPassword(_: ActionState, f: FormData): Promise<ActionState> {
  const s = await requireSession();
  const [u] = await db().select().from(schema.users).where(eq(schema.users.id, Number(s.userId)));
  if (!u || !(await bcrypt.compare(str(f, "current"), u.passwordHash))) return fail("Password lama salah");
  const next = str(f, "next");
  if (next.length < 8) return fail("Password baru minimal 8 karakter");
  await db().update(schema.users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(schema.users.id, u.id));
  return { ok: true, message: "Password diganti" };
}

/* ───────────── Brain ───────────── */

export async function saveBrainNote(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const id = num(f, "id");
  const title = str(f, "title");
  const content = str(f, "content");
  const appliesTo = f.getAll("appliesTo").map(String).filter((a) => ["scout", "analis", "copywriter", "designer"].includes(a));
  if (!title || !content) return fail("Judul dan isi wajib diisi");
  const B = schema.brainNotes;
  if (id) await db().update(B).set({ title, content, appliesTo, updatedAt: new Date() }).where(eq(B.id, id));
  else await db().insert(B).values({ title, content, appliesTo });
  revalidatePath("/brain");
  return { ok: true, message: "Tersimpan" };
}

export async function deleteBrainNote(id: number) {
  await assertAdmin();
  await db().delete(schema.brainNotes).where(eq(schema.brainNotes.id, id));
  revalidatePath("/brain");
}
