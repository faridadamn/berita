import { createHmac, randomBytes } from "node:crypto";

export type OAuth1Creds = { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * Header Authorization OAuth 1.0a (HMAC-SHA1) untuk X API.
 * Body JSON / multipart tidak ikut ditandatangani (sesuai spesifikasi), hanya query string.
 */
export function oauth1Header(method: string, url: string, c: OAuth1Creds) {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };
  const params: [string, string][] = [...Object.entries(oauth), ...u.searchParams.entries()];
  const paramStr = params
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(paramStr)].join("&");
  const key = `${enc(c.apiSecret)}&${enc(c.accessSecret)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.entries(oauth).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(", ");
}
