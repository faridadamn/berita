/**
 * Isi database awal: akun admin, sumber topik, dan catatan Brain.
 * Jalankan setelah `npm run db:push`:  npm run db:seed
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import * as mock from "../src/lib/mock";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const email = (process.env.ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "studio123";
  await db
    .insert(schema.users)
    .values({ name: "Admin", email, passwordHash: await bcrypt.hash(password, 10), role: "admin" })
    .onConflictDoNothing();

  for (const s of mock.sources) {
    await db
      .insert(schema.sources)
      .values({ name: s.name, siteUrl: s.siteUrl, feedUrl: s.feedUrl, category: s.category, active: s.active })
      .onConflictDoNothing();
  }

  for (const b of mock.brain) {
    await db.insert(schema.brainNotes).values({ title: b.title, content: b.content, appliesTo: b.appliesTo });
  }

  console.log(`Seed selesai. Login: ${email} / ${password}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
