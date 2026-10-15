import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

// Hash bcrypt untuk "studio123" — hanya dipakai di dev bila ADMIN_PASSWORD_HASH kosong.
const DEV_FALLBACK_HASH = "$2b$10$ap0v3LFiHQ6JoVlgYgFeO.Wv1RvqoMxA5jKGOYEkE8TRRnC5tllr2";

/**
 * Cek email + password ke tabel users.
 * Bootstrap: kalau tabel users masih kosong, akun ADMIN_EMAIL + ADMIN_PASSWORD_HASH dari env
 * diterima sekali lalu otomatis dibuat sebagai admin pertama.
 */
export async function verifyCredentials(email: string, password: string): Promise<Session | null> {
  const normalized = email.trim().toLowerCase();
  const { users } = schema;
  const [u] = await db().select().from(users).where(eq(users.email, normalized)).limit(1);
  if (u) {
    if (!u.active || !(await bcrypt.compare(password, u.passwordHash))) return null;
    await db().update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, u.id));
    return { userId: String(u.id), name: u.name, email: u.email, role: u.role };
  }

  const [{ n }] = await db().select({ n: count() }).from(users);
  if (Number(n) > 0) return null;
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
  let hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    if (process.env.NODE_ENV === "production") return null;
    hash = DEV_FALLBACK_HASH;
  }
  if (normalized !== adminEmail || !(await bcrypt.compare(password, hash))) return null;
  const [created] = await db()
    .insert(users)
    .values({ name: "Admin", email: adminEmail, passwordHash: hash, role: "admin", lastSeenAt: new Date() })
    .returning();
  return { userId: String(created.id), name: created.name, email: created.email, role: "admin" };
}

export async function getSession() {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Session valid + akun masih aktif di DB (akun yang dinonaktifkan admin langsung keluar). */
export async function getActiveSession(): Promise<Session | null> {
  const s = await getSession();
  if (!s || !/^\d+$/.test(s.userId)) return null;
  const [u] = await db()
    .select({ active: schema.users.active, role: schema.users.role, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, Number(s.userId)));
  if (!u || !u.active) return null;
  return { ...s, role: u.role, name: u.name };
}

export async function requireSession() {
  const s = await getActiveSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/");
  return s;
}

/** Untuk server action: lempar error, bukan redirect. */
export async function assertAdmin() {
  const s = await getActiveSession();
  if (!s || s.role !== "admin") throw new Error("Khusus admin");
  return s;
}
