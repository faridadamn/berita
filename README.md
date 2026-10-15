# Berita Studio

Dashboard redaksi konten Instagram berbasis AI. Agen menyiapkan draft, tim yang menyetujui:

```
Sumber RSS ─▶ Scout ─▶ Analis (skor ≥ ambang) ─▶ Copywriter ─▶ Antrian Review ─▶ Jadwal ─▶ (Instagram, tahap 3)
                                                                     ▲
                                                          tim approve / edit / tolak
```

Pembaca diarahkan ke artikel asli lewat shortlink `/s/:kode` (klik dihitung) dan halaman publik `/baca` (link di bio).

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Dashboard, login, skema DB | ✅ |
| 2 | Postgres (Neon/lokal), AI multi-provider + fallback, agen Scout/Analis/Copywriter, penjadwal, admin (provider, sumber, tim, Brain, pengaturan) | ✅ |
| 3 | Designer (render PNG), auto-post Instagram Graph API, sinkron Insights | ⏳ |

## Mulai cepat (lokal)

```bash
npm install
cp .env.example .env.local        # isi AUTH_SECRET, DATABASE_URL, CRON_SECRET
npm run db:push                   # buat tabel
npm run db:seed                   # sumber RSS + catatan Brain
npm run dev
```

Buka http://localhost:3000 → login `admin@studio.local` / `studio123` (default dev). Login pertama otomatis membuat akun admin.
Lalu **Admin → Pengaturan → Tambah provider**, isi API key, klik **Tes**. Kembali ke Overview → **Cari topik sekarang**.

## Database

**Neon** — buat project, salin *connection string* versi **pooled** (host berisi `-pooler`), tambahkan `?sslmode=require`.

**Postgres lokal** — mis. lewat Docker:
```bash
docker run -d --name berita-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=berita -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/berita
```

Setiap kali `src/db/schema.ts` berubah: `npm run db:push`.

## Provider AI (multi + fallback)

Dikelola di **Admin → Pengaturan**. Bisa banyak; urutannya = rantai fallback. Kalau provider teratas error / kena limit (429, timeout, dll), agen otomatis memakai yang berikutnya, dan log aktivitas mencatat "via … (… gagal)".

| Jenis | Contoh |
|---|---|
| Gemini | API key dari Google AI Studio |
| OpenAI-compatible | OpenAI, DeepSeek, OpenRouter, Groq, Together, 9router, Ollama / LM Studio lokal — cukup ganti Base URL |
| Claude (Anthropic) | API key Anthropic |

- API key disimpan **terenkripsi** (AES-256-GCM, kunci dari `AUTH_SECRET`). Ganti `AUTH_SECRET` = semua key harus diisi ulang.
- **Daftar model** mengambil model yang tersedia langsung dari provider.
- Isi **harga per 1 juta token** (dari halaman harga provider) supaya biaya di pojok kanan atas akurat; kosong = 0.
- Kalau tabel provider kosong, `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` di env dipakai sebagai cadangan.

## Penjadwal (agen jalan otomatis)

Satu putaran = Scout (tiap ±15 menit) → Analis → Copywriter, hanya di jam kerja & mode **Semi-otomatis**. Ada kunci supaya dua putaran tidak tabrakan. Panggil endpoint ini tiap 15 menit:

```
POST /api/cron        header: Authorization: Bearer <CRON_SECRET>
```

Pilih salah satu:
- **VPS / lokal**: `APP_URL=http://localhost:3000 npm run worker` (jalankan dengan pm2/systemd)
- **cron-job.org** (gratis): URL `https://domainkamu/api/cron?secret=<CRON_SECRET>`, tiap 15 menit
- **Vercel Cron**: tambah `vercel.json` `{"crons":[{"path":"/api/cron","schedule":"*/15 * * * *"}]}` — cek batas frekuensi cron di paket Vercel kamu

Tombol **Cari topik sekarang** menjalankan satu putaran langsung (abaikan jam kerja).

## Deploy production

Env wajib: `AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `ADMIN_PASSWORD_HASH` (`npm run hash -- passwordkamu`), `NEXT_PUBLIC_BRAND_*`.
Tanpa `ADMIN_PASSWORD_HASH`, login pertama di production ditolak (password default hanya untuk dev). Satu putaran bisa 1–2 menit; di serverless pastikan batas durasi fungsi cukup (`maxDuration = 300` sudah diset di route cron).

## Struktur

```
src/
  app/
    (studio)/            halaman berlogin: Overview, Review (+detail), Radar, Kalender, Analitik, Brain, Akun, Admin/*
    api/cron/            endpoint penjadwal
    s/[code]/ baca/      shortlink & halaman publik link-in-bio
    actions/             server actions (studio.ts, admin.ts, auth.ts)
  components/            nav, slide-preview (template Stabilo/Putih/Foto), forms, dll
  db/schema.ts           users, sources, topics, posts, clicks, agent_runs, ai_providers, brain_notes, settings
  lib/
    ai/providers.ts      klien Gemini / OpenAI-compatible / Claude + fallback, daftar model, parser JSON
    ai/index.ts          rantai provider dari DB (atau env)
    agents/              scout (RSS/Atom), analis (skor), copywriter (draft carousel), pipeline (kunci + urutan)
    data.ts              semua query untuk halaman
    settings.ts          mode, jam kerja, ambang skor, dll (tersimpan di DB)
scripts/                 seed, hash-password, worker
```

## Catatan konten

Postingan merangkum berita dari media lain. Copywriter diinstruksikan menulis ulang dengan sudut pandang sendiri, tidak menambah fakta, dan selalu menyebut sumber; tetap cek fakta sebelum menyetujui.
