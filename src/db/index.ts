import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db | null = null;

/** Mengembalikan koneksi DB, atau null kalau DATABASE_URL belum diisi (mode data dummy). */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!db) db = drizzle(postgres(url, { max: 5 }), { schema });
  return db;
}
