import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";

export type Platform = "instagram" | "threads" | "x";
export const PLATFORMS: Platform[] = ["instagram", "threads", "x"];
export const platformLabel: Record<Platform, string> = { instagram: "Instagram", threads: "Threads", x: "X" };

export type InstagramCreds = {
  /** graph.instagram.com (Instagram Login) atau graph.facebook.com (Facebook Login / Page) */
  host: string;
  version: string;
  userId: string;
  accessToken: string;
  apiBase?: string; // override (proxy / tes)
};
export type ThreadsCreds = { userId: string; accessToken: string; apiBase?: string };
export type XCreds = { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string; apiBase?: string };
export type CredsOf = { instagram: InstagramCreds; threads: ThreadsCreds; x: XCreds };

export type Channel<P extends Platform = Platform> = {
  platform: P;
  enabled: boolean;
  creds: CredsOf[P] | null;
  accountName: string | null;
  tokenRefreshedAt: Date | null;
  lastError: string | null;
};

export async function getChannel<P extends Platform>(platform: P): Promise<Channel<P>> {
  const [r] = await db().select().from(schema.channels).where(eq(schema.channels.platform, platform));
  let creds: CredsOf[P] | null = null;
  if (r?.credentialsEnc) {
    try {
      creds = JSON.parse(decrypt(r.credentialsEnc));
    } catch {
      creds = null;
    }
  }
  return {
    platform,
    enabled: !!r?.enabled && !!creds,
    creds,
    accountName: r?.accountName ?? null,
    tokenRefreshedAt: r?.tokenRefreshedAt ?? null,
    lastError: r?.lastError ?? null,
  };
}

export async function getChannels() {
  return Promise.all(PLATFORMS.map((p) => getChannel(p)));
}

export async function saveChannel(
  platform: Platform,
  patch: { creds?: object; enabled?: boolean; accountName?: string | null; lastError?: string | null; tokenRefreshedAt?: Date },
) {
  const set = {
    ...(patch.creds ? { credentialsEnc: encrypt(JSON.stringify(patch.creds)) } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.accountName !== undefined ? { accountName: patch.accountName } : {}),
    ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
    ...(patch.tokenRefreshedAt ? { tokenRefreshedAt: patch.tokenRefreshedAt } : {}),
    updatedAt: new Date(),
  };
  await db()
    .insert(schema.channels)
    .values({ platform, ...set })
    .onConflictDoUpdate({ target: schema.channels.platform, set });
}

/**
 * URL publik aplikasi termasuk basePath (wajib untuk IG & Threads, karena mereka mengambil gambar dari URL).
 * APP_URL boleh diisi domain saja (https://domain.com) atau lengkap (https://domain.com/berita).
 */
export function appUrl() {
  const u = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!u) return null;
  const bp = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  return bp && !u.endsWith(bp) ? u + bp : u;
}

const SECRET_KEYS = new Set(["accessToken", "apiKey", "apiSecret", "accessSecret"]);

/** Bentuk aman untuk dikirim ke browser: field publik apa adanya, rahasia disamarkan. */
export async function getChannelViews() {
  const { mask } = await import("./crypto");
  const list = await getChannels();
  return list.map((c) => {
    const publicFields: Record<string, string> = {};
    const secretMasks: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.creds ?? {})) {
      if (SECRET_KEYS.has(k)) secretMasks[k] = v ? mask(String(v)) : "";
      else publicFields[k] = String(v ?? "");
    }
    return {
      platform: c.platform,
      label: platformLabel[c.platform],
      enabled: c.enabled,
      configured: !!c.creds,
      accountName: c.accountName,
      lastError: c.lastError,
      tokenRefreshedAt: c.tokenRefreshedAt?.toISOString() ?? null,
      publicFields,
      secretMasks,
    };
  });
}
