import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, inWorkHours } from "../settings";
import { runAnalis } from "./analis";
import { runCopywriter } from "./copywriter";
import { runScout } from "./scout";
import { flagStuck, refreshTokens, runDesigner, runPublisher, syncInsights } from "./publisher";

const LOCK_MS = 10 * 60_000;
const SCOUT_EVERY_MS = 14 * 60_000;

/** Kunci sederhana di tabel settings supaya dua putaran tidak jalan bersamaan (cron + tombol manual). */
async function acquireLock(key = "pipeline_lock", ms = LOCK_MS) {
  const until = new Date(Date.now() + ms).toISOString();
  const rows = await db().execute(sql`
    insert into ${schema.settings} (key, value) values (${key}, ${JSON.stringify({ until })}::jsonb)
    on conflict (key) do update set value = excluded.value
    where (${schema.settings.value}->>'until')::timestamptz < now()
    returning key`);
  return rows.length > 0;
}

async function releaseLock(key = "pipeline_lock") {
  await db()
    .update(schema.settings)
    .set({ value: { until: new Date(0).toISOString() } })
    .where(eq(schema.settings.key, key));
}

export type PipelineResult =
  | { skipped: string }
  | {
      scout?: Awaited<ReturnType<typeof runScout>>;
      analis: Awaited<ReturnType<typeof runAnalis>>;
      copywriter: Awaited<ReturnType<typeof runCopywriter>>;
      designer?: Awaited<ReturnType<typeof runDesigner>>;
    };

/**
 * Satu putaran redaksi: Scout → Analis → Copywriter.
 * `force` (tombol "Cari topik sekarang") mengabaikan jam kerja, mode manual, dan jeda Scout.
 */
export async function runPipeline({ force = false } = {}): Promise<PipelineResult> {
  const s = await getSettings();
  if (s.mode === "off") return { skipped: "Mode AI: mati" };
  if (!force) {
    if (s.mode === "manual") return { skipped: "Mode manual — hanya jalan lewat tombol" };
    if (!inWorkHours(s)) return { skipped: "Di luar jam kerja AI" };
  }
  if (!(await acquireLock())) return { skipped: "Putaran lain masih berjalan" };

  try {
    const [last] = await db()
      .select({ at: schema.agentRuns.at })
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.agent, "scout"))
      .orderBy(desc(schema.agentRuns.at))
      .limit(1);
    const scoutDue = force || !last || Date.now() - last.at.getTime() >= SCOUT_EVERY_MS;
    const scout = scoutDue ? await runScout() : undefined;
    const analis = await runAnalis();
    const copywriter = await runCopywriter();
    const designer = copywriter.drafted ? await runDesigner() : undefined;
    return { scout, analis, copywriter, designer };
  } finally {
    await releaseLock();
  }
}

/**
 * Operasional non-AI, jalan di setiap panggilan cron tanpa peduli jam kerja AI:
 * posting terjadwal, render draft yang diedit, insights (tiap jam), perpanjang token.
 */
export async function runOps() {
  if (!(await acquireLock("ops_lock", 8 * 60_000))) return { skipped: "Operasi lain masih berjalan" };
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (e) {
      out[name] = { error: (e as Error).message };
    }
  };
  try {
    await step("stuck", flagStuck);
    await step("publisher", runPublisher);
    await step("designer", () => runDesigner());
    await step("insights", syncInsights);
    await step("tokens", refreshTokens);
  } finally {
    await releaseLock("ops_lock");
  }
  return out;
}
