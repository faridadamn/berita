# Berita Studio

Dashboard redaksi konten Instagram berbasis AI. Empat agen menyiapkan draft, tim yang menyetujui:

```
Sumber RSS ─▶ Scout ─▶ Analis (skor ≥ 70) ─▶ Copywriter ─▶ Designer ─▶ Antrian Review ─▶ Jadwal ─▶ Instagram
                                                                            ▲
                                                                 tim approve / edit / tolak
```

Pembaca diarahkan ke artikel asli lewat shortlink `/s/:kode` (klik dihitung) dan halaman publik `/baca` (link di bio).

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Kerangka dashboard, login, skema DB, data dummy | ✅ selesai |
| 2 | Agen Scout + Analis + Copywriter (RSS + LLM), simpan ke Postgres | ⏳ |
| 3 | Render gambar (Designer), auto-post Instagram Graph API, sinkron Insights | ⏳ |

Saat ini semua halaman membaca **data dummy di memori** (`src/lib/mock.ts`), jadi perubahan (approve, jadwal, edit) hilang saat server restart.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local     # isi AUTH_SECRET
npm run dev
```

Buka http://localhost:3000 → login `admin@studio.local` / `studio123` (password default ini **hanya aktif di mode dev**).

## Deploy (production)

Wajib isi env:

- `AUTH_SECRET` — string acak minimal 32 karakter (`openssl rand -base64 32`)
- `ADMIN_PASSWORD_HASH` — buat dengan `npm run hash -- passwordkamu`. Di file `.env`, tanda `$` harus di-escape jadi `\$` (output script sudah menyiapkannya). Di dashboard Vercel/Railway tempel hash apa adanya.
- `ADMIN_EMAIL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_HANDLE`

Tanpa `AUTH_SECRET` dan `ADMIN_PASSWORD_HASH`, login di production sengaja ditolak.

## Database (opsional di tahap 1)

```bash
# isi DATABASE_URL di .env.local (Supabase / Neon / Postgres lokal)
npm run db:push     # buat tabel dari src/db/schema.ts
npm run db:seed     # akun admin + sumber RSS + catatan Brain
```

Begitu `DATABASE_URL` diisi, login memakai tabel `users`. Halaman lain masih dummy sampai fungsi di `src/lib/data.ts` diganti query Drizzle (tahap 2) — tanda tangan fungsinya sudah final, jadi halaman tidak perlu diubah.

## Struktur

```
src/
  app/
    (studio)/          halaman yang butuh login (sidebar + header biaya AI)
      page.tsx         Overview / Ruang Redaksi
      review/          Antrian Review + detail /review/[id]
      radar/ kalender/ analitik/ brain/
      admin/           sumber, tim, pengaturan (khusus admin)
    login/             form login (tanpa daftar publik)
    s/[code]/          shortlink → artikel asli, catat klik
    baca/              halaman publik "link in bio"
    actions/           server actions (auth, approve, jadwal, edit)
  components/          nav, slide-preview (template Stabilo/Putih/Foto), bar-list, dll
  db/schema.ts         tabel: users, sources, topics, posts, clicks, agent_runs, brain_notes, settings
  lib/
    data.ts            SATU-SATUNYA pintu data — ganti isinya di tahap 2
    mock.ts            data dummy
    auth.ts session.ts login & session (JWT di cookie httpOnly)
    config.ts          brand, jam kerja AI, ambang skor
  middleware.ts        proteksi semua rute kecuali /login, /s/*, /baca
```

## Catatan konten

Postingan merangkum berita dari media lain. Selalu tulis ulang dengan sudut pandang sendiri, cantumkan sumber di gambar dan caption, dan arahkan pembaca ke artikel aslinya.
