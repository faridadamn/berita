import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const g = globalThis as unknown as { __db?: Db };

/**
 * Koneksi Postgres. Bisa Neon (pakai connection string "pooled" + ?sslmode=require)
 * atau Postgres lokal (postgres://user:pass@localhost:5432/berita).
 */
export function db(): Db {
  if (g.__db) return g.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi. Lihat README bagian Database.");
  const client = postgres(url, {
    max: Number(process.env.DB_POOL ?? 5),
    // Neon pooler (pgbouncer) tidak mendukung prepared statement
    prepare: !/neon\.tech/.test(url) || !/-pooler\./.test(url),
    onnotice: () => {},
  });
  g.__db = drizzle(client, { schema });
  return g.__db;
}

export { schema };
