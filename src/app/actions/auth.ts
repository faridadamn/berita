"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  const session = await verifyCredentials(email, password);
  if (!session) return { error: "Email atau password salah." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
