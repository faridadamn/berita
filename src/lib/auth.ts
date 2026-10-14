import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

// Hash bcrypt untuk "studio123" — hanya dipakai di dev bila ADMIN_PASSWORD_HASH kosong.
const DEV_FALLBACK_HASH = "$2b$10$ap0v3LFiHQ6JoVlgYgFeO.Wv1RvqoMxA5jKGOYEkE8TRRnC5tllr2";

/** Cek email + password. Pakai tabel users kalau DATABASE_URL ada, kalau tidak pakai akun admin dari env. */
export async function verifyCredentials(email: string, password: string): Promise<Session | null> {
  const normalized = email.trim().toLowerCase();
  const db = getDb();

  if (db) {
    const [u] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    if (!u || !u.active) return null;
    const ok = await bcrypt.compare(password, u.passwordHash);
    return ok ? { userId: String(u.id), name: u.name, email: u.email, role: u.role } : null;
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
  let hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    if (process.env.NODE_ENV === "production") return null;
    hash = DEV_FALLBACK_HASH;
  }
  if (normalized !== adminEmail) return null;
  const ok = await bcrypt.compare(password, hash);
  return ok ? { userId: "admin", name: "Admin", email: adminEmail, role: "admin" } : null;
}

export async function getSession() {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/");
  return s;
}
