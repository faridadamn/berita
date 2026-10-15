import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, inWorkHours } from "../settings";
import { runAnalis } from "./analis";
import { runCopywriter } from "./copywriter";
import { runScout } from "./scout";

const LOCK_MS = 10 * 60_000;
const SCOUT_EVERY_MS = 14 * 60_000;

/** Kunci sederhana di tabel settings supaya dua putaran tidak jalan bersamaan (cron + tombol manual). */
async function acquireLock() {
  const until = new Date(Date.now() + LOCK_MS).toISOString();
  const rows = await db().execute(sql`
    insert into ${schema.settings} (key, value) values ('pipeline_lock', ${JSON.stringify({ until })}::jsonb)
    on conflict (key) do update set value = excluded.value
    where (${schema.settings.value}->>'until')::timestamptz < now()
    returning key`);
  return rows.length > 0;
}

async function releaseLock() {
  await db()
    .update(schema.settings)
    .set({ value: { until: new Date(0).toISOString() } })
    .where(eq(schema.settings.key, "pipeline_lock"));
}

export type PipelineResult =
  | { skipped: string }
  | { scout?: Awaited<ReturnType<typeof runScout>>; analis: Awaited<ReturnType<typeof runAnalis>>; copywriter: Awaited<ReturnType<typeof runCopywriter>> };

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
    return { scout, analis, copywriter };
  } finally {
    await releaseLock();
  }
}
