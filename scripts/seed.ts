/**
 * Isi awal database: akun admin, sumber RSS, catatan Brain.
 * Jalankan setelah `npm run db:push`:   npm run db:seed
 * Aman dijalankan berulang (data yang sudah ada tidak digandakan).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const sources = [
  { name: "The Verge", siteUrl: "https://www.theverge.com", feedUrl: "https://www.theverge.com/rss/index.xml", category: "AI" },
  { name: "TechCrunch", siteUrl: "https://techcrunch.com", feedUrl: "https://techcrunch.com/feed/", category: "AI" },
  { name: "Social Media Today", siteUrl: "https://www.socialmediatoday.com", feedUrl: "https://www.socialmediatoday.com/feeds/news/", category: "SOSMED" },
  { name: "HubSpot", siteUrl: "https://blog.hubspot.com", feedUrl: "https://blog.hubspot.com/marketing/rss.xml", category: "MARKETING" },
  { name: "Adweek", siteUrl: "https://www.adweek.com", feedUrl: "https://www.adweek.com/feed/", category: "MARKETING" },
  { name: "Marketing Dive", siteUrl: "https://www.marketingdive.com", feedUrl: "https://www.marketingdive.com/feeds/news/", category: "MARKETING" },
];

const brain = [
  {
    title: "Persona & suara",
    content:
      "Tulis seperti teman yang kerja di marketing: santai, pakai 'kamu', kalimat pendek. Boleh beropini singkat ('menurut aku…'), tapi fakta tetap dari sumber. Hindari clickbait yang menipu. Selalu sebut sumber.",
    appliesTo: ["copywriter"],
  },
  {
    title: "Kriteria skor viral",
    content:
      "Naikkan skor kalau: relevan buat marketer/kreator/UMKM Indonesia, ada dampak praktis yang bisa langsung dipakai, melibatkan platform/brand besar (Instagram, TikTok, Google, OpenAI, Meta). Turunkan kalau: terlalu teknis untuk developer, pendanaan startup tanpa dampak ke pengguna, rumor, atau sudah basi lebih dari 48 jam.",
    appliesTo: ["analis"],
  },
  {
    title: "Aturan visual",
    content:
      "Cover: headline maks 9 kata. Slide terakhir selalu CTA 'baca lengkapnya di link bio'. Cantumkan 'Sumber: <media>' di footer.",
    appliesTo: ["designer", "copywriter"],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  // Admin dibuat hanya kalau SEED_ADMIN_PASSWORD diisi. Kalau tidak, login pertama dengan
  // ADMIN_EMAIL + password (dev: studio123, production: sesuai ADMIN_PASSWORD_HASH) otomatis membuat admin.
  const email = (process.env.ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const [{ n: userCount }] = await db.select({ n: count() }).from(schema.users);
  if (Number(userCount) > 0) console.log("• Users sudah ada, dilewati");
  else if (password) {
    await db.insert(schema.users).values({ name: "Admin", email, passwordHash: await bcrypt.hash(password, 10), role: "admin" });
    console.log(`✓ Admin dibuat: ${email}`);
  } else console.log(`• Admin akan dibuat otomatis saat login pertama (${email})`);

  const added = await db.insert(schema.sources).values(sources).onConflictDoNothing().returning();
  console.log(`✓ ${added.length} sumber RSS ditambahkan`);

  const [{ n: brainCount }] = await db.select({ n: count() }).from(schema.brainNotes);
  if (Number(brainCount) === 0) {
    await db.insert(schema.brainNotes).values(brain);
    console.log(`✓ ${brain.length} catatan Brain ditambahkan`);
  } else console.log("• Brain sudah ada, dilewati");

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
