# Berita Studio

Dashboard redaksi konten berbasis AI untuk Instagram, Threads, dan X. Agen menyiapkan draft, tim yang menyetujui:

```
Sumber RSS ─▶ Scout ─▶ Analis ─▶ Copywriter ─▶ Designer (JPG) ─▶ Antrian Review ─▶ Jadwal ─▶ Publisher ─▶ Instagram / Threads / X
                                                                       ▲                                └▶ atau salin & posting manual
                                                            tim approve / edit / tolak
```

Pembaca diarahkan ke artikel asli lewat shortlink `/s/:kode` (klik dihitung) dan halaman publik `/baca` (link di bio).

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Dashboard, login, skema DB | ✅ |
| 2 | Postgres (Neon/lokal), AI multi-provider + fallback, agen Scout/Analis/Copywriter, penjadwal, admin (provider, sumber, tim, Brain, pengaturan) | ✅ |
| 3 | Designer (render JPG), auto-post Instagram / Threads / X, salin manual, insights, perpanjang token | ✅ |

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

## Designer (render gambar)

Tiap slide dirender jadi JPEG 1080×1350 dengan template yang sama persis dengan preview (Stabilo / Putih / Foto penuh), memakai foto dari artikel (og:image / RSS). Dibuat otomatis setelah Copywriter, dan diulang kalau isi slide/template diedit (**Simpan & render ulang**). Gambar disimpan di Postgres (tabel `renders`) dan disajikan publik di `/m/<kode>/<n>.jpg`. Di halaman review ada **Download semua** (ZIP + caption) dan per slide.

## Posting: Instagram, Threads, X, atau manual

Sambungkan akun di **Admin → Kanal** (panduan singkat ada di tiap kartu; kredensial terenkripsi, tombol **Tes** memverifikasi akun). Lalu di halaman review: centang platform → **Jadwalkan** atau **Posting sekarang**.

| Platform | Yang diposting | Catatan |
|---|---|---|
| Instagram | Carousel semua slide + caption + hashtag | Akun Business/Creator. Butuh `APP_URL` https publik. Token Instagram Login diperpanjang otomatis |
| Threads | Carousel tanpa slide CTA + teks Threads + shortlink | Butuh `APP_URL` https publik. Token diperpanjang otomatis |
| X | Maks 4 gambar (cover + isi) + teks X + shortlink | OAuth 1.0a (API Key/Secret + Access Token/Secret, izin Read & Write). Batas posting tergantung paket API X |
| Manual | Panel **Salin untuk posting manual**: teks final per platform + download gambar, lalu **Tandai sudah diposting** | Tidak butuh kanal apa pun |

- Teks Threads & X dibuat Copywriter (bisa diedit); shortlink artikel ditambahkan otomatis.
- Satu baris `publications` per post × platform, diklaim atomik → tidak mungkin terposting dobel walau cron & tombol jalan bersamaan. Yang gagal bisa **Coba lagi**; yang macet >15 menit ditandai gagal (cek dulu di platform sebelum coba lagi).
- Post terjadwal diposting oleh penjadwal (`/api/cron`) — di luar jam kerja AI pun tetap jalan. Ketelitian waktu = interval cron (15 menit; set worker 5 menit kalau perlu lebih tepat).
- Insights IG (views, reach, likes, saves, shares, comments) & Threads disinkron tiap jam untuk post 14 hari terakhir.

## Deploy production

Env wajib: `AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `APP_URL`, `ADMIN_PASSWORD_HASH` (`npm run hash -- passwordkamu`), `NEXT_PUBLIC_BRAND_*`.
Render memakai `sharp` (native) — jalan di Vercel, Railway, VPS, dll. Gambar render tersimpan di DB (±150–300 KB per slide); di Neon gratisan cukup untuk ratusan post.
Tanpa `ADMIN_PASSWORD_HASH`, login pertama di production ditolak (password default hanya untuk dev). Satu putaran bisa 1–2 menit; di serverless pastikan batas durasi fungsi cukup (`maxDuration = 300` sudah diset di route cron).

## Struktur

```
src/
  app/
    (studio)/            halaman berlogin: Overview, Review (+detail), Radar, Kalender, Analitik, Brain, Akun, Admin/*
    api/cron/            endpoint penjadwal (ops: publish/render/insights/token + putaran AI)
    s/[code]/ baca/      shortlink & halaman publik link-in-bio
    m/[code]/[n]/        gambar render publik (diambil IG/Threads)
    actions/             server actions (studio.ts, admin.ts, publish.ts, auth.ts)
  components/            nav, slide-preview (template Stabilo/Putih/Foto), forms, dll
  db/schema.ts           users, sources, topics, posts, renders, publications, channels, clicks, agent_runs, ai_providers, brain_notes, settings
  lib/
    ai/providers.ts      klien Gemini / OpenAI-compatible / Claude + fallback, daftar model, parser JSON
    ai/index.ts          rantai provider dari DB (atau env)
    agents/              scout, analis, copywriter, publisher (designer/publish/insights/token), pipeline
    render/              template satori + render JPG (sharp) + font tertanam
    publish/             klien Instagram / Threads / X, OAuth 1.0a, penyusun teks per platform
    channels.ts          kredensial kanal terenkripsi
    data.ts              semua query untuk halaman
    settings.ts          mode, jam kerja, ambang skor, dll (tersimpan di DB)
scripts/                 seed, hash-password, worker
```

## Catatan konten

Postingan merangkum berita dari media lain. Copywriter diinstruksikan menulis ulang dengan sudut pandang sendiri, tidak menambah fakta, dan selalu menyebut sumber; tetap cek fakta sebelum menyetujui.
