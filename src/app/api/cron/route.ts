import { NextResponse } from "next/server";
import { runOps, runPipeline } from "@/lib/agents/pipeline";
import { logRun } from "@/lib/agents/common";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dipanggil penjadwal tiap ~15 menit:
 *  - Vercel Cron (vercel.json) — otomatis mengirim header Authorization: Bearer $CRON_SECRET
 *  - cron-job.org / crontab VPS / `npm run worker`
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET belum diisi" }, { status: 500 });
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // posting terjadwal didahulukan supaya tidak menunggu putaran AI yang lama
    const ops = await runOps();
    const ai = await runPipeline({ force: url.searchParams.get("force") === "1" });
    return NextResponse.json({ ok: true, ops, ai });
  } catch (e) {
    await logRun("system", `Penjadwal error: ${(e as Error).message}`, { ok: false, detail: { error: (e as Error).message, stack: (e as Error).stack } }).catch(() => {});
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
