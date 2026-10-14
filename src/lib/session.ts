import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "studio_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export type Role = "admin" | "editor";
export type Session = { userId: string; name: string; email: string; role: Role };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET wajib diisi (min 32 karakter) di production.");
    }
    return new TextEncoder().encode("dev-only-secret-jangan-dipakai-di-production!!");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
