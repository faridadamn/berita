/**
 * Penjadwal sederhana untuk VPS / lokal: memanggil /api/cron tiap N menit.
 *   APP_URL=http://localhost:3000 CRON_SECRET=xxx npm run worker
 * (Di Vercel tidak perlu — pakai vercel.json atau cron-job.org.)
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const bp = (process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
const appUrl = bp && !base.endsWith(bp) ? base + bp : base;
const secret = process.env.CRON_SECRET;
const everyMin = Number(process.env.WORKER_INTERVAL_MIN ?? 15);
if (!secret) {
  console.error("CRON_SECRET belum diisi");
  process.exit(1);
}

async function tick() {
  const t = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  try {
    const r = await fetch(`${appUrl}/api/cron`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    console.log(`[${t}] ${r.status}`, JSON.stringify(await r.json()));
  } catch (e) {
    console.error(`[${t}] gagal:`, (e as Error).message);
  }
}

console.log(`Worker jalan: ${appUrl}/api/cron tiap ${everyMin} menit`);
tick();
setInterval(tick, everyMin * 60_000);
