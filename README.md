# Berita Studio

Dashboard redaksi konten berbasis AI untuk Instagram, Threads, X, dan LinkedIn. Agen menyiapkan draft, tim yang menyetujui:

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
| 4 | LinkedIn, 7 template + jenis slide, gambar per slide, sumber medsos, tutorial/review | ✅ |
| 6 | Video 9:16 lewat engine Gerak (naskah AI, render di server, unduh MP4) | ✅ |
| 5 | Brand Kit, mode jualan (katalog affiliate, konten promo/rekomendasi/perbandingan, link pelacak per kanal, etalase) | ✅ |

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

## Jenis konten

| Jenis | Isi carousel |
|---|---|
| Berita | Cover → 2-4 slide isi → CTA "baca lengkapnya" |
| Tutorial | Cover → yang perlu disiapkan → langkah bernomor (boleh dengan kode/perintah) → CTA |
| Review | Cover → apa itu → daftar fitur → cara mulai (kode) → verdict (nilai /10, kelebihan, kekurangan) → CTA |
| Tips | Cover → 4-7 tips bernomor → CTA |
| Opini | Cover → 3-4 poin argumen → CTA |
| Promo / Racun | Cover (foto produk) → masalah → kenapa worth it → kartu produk → CTA |
| Rekomendasi | Cover → kartu produk bernomor per produk → CTA |
| Perbandingan | Cover → tabel perbandingan → kartu produk pilihan + alasan → CTA |

Analis menyarankan jenis per topik; sumber bisa punya jenis bawaan (mis. GitHub → Review). Di halaman review ada **Tulis ulang dengan AI** untuk mengganti jenis/arahan.

**Buat Konten** (menu): tempel link — artikel, **repo GitHub** (README, bintang, bahasa, lisensi dibaca otomatis), atau **video YouTube** — atau tulis ide saja (tanpa sumber: wajib cek fakta). Draft langsung ditulis & dibuka di halaman review.

## Brand Kit

**Admin → Brand Kit**: nama, handle, deskripsi akun (dipakai AI), 4 warna (utama, kedua, latar, teks + palet siap pakai), font judul & isi (Inter, Plus Jakarta Sans, Poppins, Montserrat, Space Grotesk, Anton, Bebas Neue, DM Serif Display, Playfair Display, atau **upload font sendiri** .ttf/.otf/.woff), logo (PNG/SVG, di header/footer/penutup), tata letak cover, ikon poin, dan sudut membulat. Preview langsung semua jenis slide.

Template **Brand Kit** 100% mengikuti kit. Opsi *terapkan ke semua template* memakai font, warna aksen, dan/atau logo brand di 7 template lain. Setelah kit diubah, post yang terdampak ditandai "perlu render ulang". Nama/handle di kit menggantikan `NEXT_PUBLIC_BRAND_*` (env tetap jadi nilai awal).

## Video 9:16 (Gerak)

Panel **Video** di halaman review mengubah post jadi video Reels / TikTok / Shopee Video / Shorts memakai engine [Gerak](https://github.com/faridadamn/gerak):

1. **Tulis naskah video dengan AI** — isi post diubah jadi 4–7 shot (maks 5 kata per shot, kata yang distabilo, label). Bisa diedit, diurutkan, ditambah shot produk/perbandingan. Kalau AI gagal, naskah dibuat dari slide.
2. **Render video** — gaya "satu papan" ala Brand Kit (warna, font, logo): kamera pindah antar shot dan berganti ukuran (close-up ↔ wide), foto sampul / foto produk ikut melompat, rute kuas tergambar, harga produk dihitung + stempel diskon + lingkaran tangan, penutup extreme wide + handle. Musik & SFX sintetis bebas hak cipta (bisa dimatikan); motion blur opsional.
3. Hasil MP4 1080×1920 bisa diputar & **diunduh**, plus link publik `/m/<kode>/video.mp4`.

Render jalan di proses server sebagai child process (`scripts/video/gerak-build.mjs`), satu per satu (antrean), progres terlihat langsung. Di VPS 2 core, video ±20 detik selesai ±1–1,5 menit (motion blur ±3× lebih lama).

Syarat di server: **FFmpeg**, Node 22.6+, dan Gerak — isi `GERAK_PATH` dengan folder repo gerak yang sudah `npm install` (mis. `/home/ubuntu/gerak`), atau pasang sebagai paket di `node_modules/gerak`. Tidak cocok untuk serverless (Vercel) karena render butuh CPU & waktu.

## Mode jualan (affiliate)

Menu **Jualan**:

- **Katalog produk** — tambah dari link (Tokopedia, Blibli, Amazon, toko Shopify/WooCommerce biasanya terbaca otomatis lewat JSON-LD; Shopee & TikTok Shop sering memblokir bot → isi manual), atau **impor CSV** (`nama, link, link affiliate, harga, harga coret, rating, terjual, gambar, kategori, catatan, promo`). Isi *catatan untuk AI* dengan pengalaman pribadi & hal yang wajib/dilarang disebut.
- **Konten jualan** — centang produk lalu pilih **Promo/Racun** (1 produk), **Rekomendasi** (2–7), atau **Perbandingan** (2–3). Slide baru: **kartu produk** (foto, harga, coret + badge diskon, rating, terjual, toko) dan **tabel perbandingan** (dengan "pilihan kami"). Harga & rating diambil dari katalog saat render — bukan ditulis AI — jadi ubah harga di katalog → slide ikut ditandai perlu render ulang.
- **Teks per kanal** — IG, Threads, X, LinkedIn (auto-post seperti biasa) plus salin manual **TikTok / Shopee Video / Reels** dan **WhatsApp / Telegram** (sudah berisi link produk).
- **Link pelacak** — tiap produk punya `/p/<kode>?c=<kanal>` → link affiliate; klik dicatat per kanal (bio, instagram, threads, x, linkedin, tiktok, wa, telegram, …) dan per post. Shortlink post jualan `/s/<kode>` → langsung ke produk (1 produk) atau ke halaman daftar `/baca/<kode>` (beberapa produk). `/baca` punya tab **Etalase** berisi semua produk aktif.
- **Pengungkapan affiliate** otomatis ditambahkan ke caption (bisa diubah di halaman Jualan, admin).

## Sumber topik

RSS/Atom biasa, plus preset: **Reddit**, **YouTube**, **Hacker News**, **Product Hunt**, **Bluesky**, **Mastodon**, **Telegram** (kanal publik), **GitHub naik daun** (repo baru yang cepat dapat bintang, via GitHub Search API), dan **X / Instagram / TikTok lewat RSSHub** (sebaiknya instance sendiri). Setiap sumber bisa diberi jenis konten bawaan. Post Telegram yang menautkan artikel akan membaca artikelnya.

## Designer (render gambar)

Tiap slide dirender jadi JPEG 1080×1350 (4:5 — pas untuk IG, LinkedIn, Threads). 8 template: **Brand Kit, Stabilo, Putih editorial, Foto penuh, Minimal (LinkedIn), Gelap tech, Split, Koran**, dan 9 jenis slide: cover, isi, langkah, daftar, kode, verdict, CTA, kartu produk, perbandingan produk. Preview di dashboard memakai renderer yang sama, dan pemilih template menampilkan thumbnail asli tiap template.

**Gambar per slide**: tiap post punya pustaka gambar (otomatis dari artikel: og:image + gambar di dalam artikel; gambar OpenGraph repo GitHub; thumbnail YouTube). Di editor kamu bisa memilih gambar berbeda untuk tiap slide, **mengunggah** gambar sendiri, menempel URL, **Ambil dari artikel**, atau **cari foto stok Pexels** (`PEXELS_API_KEY`). Dibuat otomatis setelah Copywriter, dan diulang kalau isi slide/template diedit (**Simpan & render ulang**). Gambar disimpan di Postgres (tabel `renders`) dan disajikan publik di `/m/<kode>/<n>.jpg`. Di halaman review ada **Download semua** (ZIP + caption) dan per slide.

## Posting: Instagram, Threads, X, atau manual

Sambungkan akun di **Admin → Kanal** (panduan singkat ada di tiap kartu; kredensial terenkripsi, tombol **Tes** memverifikasi akun). Lalu di halaman review: centang platform → **Jadwalkan** atau **Posting sekarang**.

| Platform | Yang diposting | Catatan |
|---|---|---|
| Instagram | Carousel semua slide + caption + hashtag | Akun Business/Creator. Butuh `APP_URL` https publik. Token Instagram Login diperpanjang otomatis |
| Threads | Carousel tanpa slide CTA + teks Threads + shortlink | Butuh `APP_URL` https publik. Token diperpanjang otomatis |
| X | Maks 4 gambar (cover + isi) + teks X + shortlink | OAuth 1.0a (API Key/Secret + Access Token/Secret, izin Read & Write). Batas posting tergantung paket API X |
| LinkedIn | **Carousel PDF (dokumen)** atau galeri gambar + teks LinkedIn + shortlink | Token scope `openid profile w_member_social` (profil). Halaman perusahaan: `w_organization_social` (Community Management API). Token 60 hari, perbarui manual. Ada tombol unduh PDF untuk posting manual |
| Manual | Panel **Salin untuk posting manual**: teks final per platform + download gambar, lalu **Tandai sudah diposting** | Tidak butuh kanal apa pun |

- Teks Threads & X dibuat Copywriter (bisa diedit); shortlink artikel ditambahkan otomatis.
- Satu baris `publications` per post × platform, diklaim atomik → tidak mungkin terposting dobel walau cron & tombol jalan bersamaan. Yang gagal bisa **Coba lagi**; yang macet >15 menit ditandai gagal (cek dulu di platform sebelum coba lagi).
- Post terjadwal diposting oleh penjadwal (`/api/cron`) — di luar jam kerja AI pun tetap jalan. Ketelitian waktu = interval cron (15 menit; set worker 5 menit kalau perlu lebih tepat).
- Insights IG (views, reach, likes, saves, shares, comments) & Threads disinkron tiap jam untuk post 14 hari terakhir.

## Log & error

Halaman **Log** mencatat semua aktivitas agen, posting, dan error sistem (badge merah di menu = jumlah error 24 jam). Klik baris untuk melihat provider/model, token, biaya, **jawaban mentah AI** yang gagal diproses, topik/post terkait, stack trace, dan saran perbaikan.

Jawaban JSON dari AI dibuat tahan banting: mode JSON dikirim ke provider OpenAI-compatible (otomatis dimatikan kalau provider menolak), JSON rusak diperbaiki dengan `jsonrepair` (kutip tak di-escape, koma, terpotong), dan kalau masih gagal diminta ulang sekali dengan instruksi lebih ketat & jatah token lebih besar.

## Tema

Gelap (default), Terang, atau Ikuti sistem — tombol di bawah menu (desktop) / pojok kanan atas (HP). Pilihan disimpan di cookie per perangkat.

## Deploy production

Env wajib: `AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `APP_URL`, `ADMIN_PASSWORD_HASH` (`npm run hash -- passwordkamu`), `NEXT_PUBLIC_BRAND_*`.
Render memakai `sharp` (native) — jalan di Vercel, Railway, VPS, dll. Gambar render tersimpan di DB (±150–300 KB per slide); di Neon gratisan cukup untuk ratusan post.
Tanpa `ADMIN_PASSWORD_HASH`, login pertama di production ditolak (password default hanya untuk dev). Satu putaran bisa 1–2 menit; di serverless pastikan batas durasi fungsi cukup (`maxDuration = 300` sudah diset di route cron).

### Deploy di subpath (mis. `domain.com/berita`)

- Set `BASE_PATH=/berita` **saat build** (`BASE_PATH=/berita npm run build`), lalu reverse proxy meneruskan `/berita/*` ke app apa adanya (jangan di-strip).
- `APP_URL` boleh `https://domain.com` atau `https://domain.com/berita` — basePath ditambahkan otomatis.
- Semua URL publik ikut subpath: cron `https://domain.com/berita/api/cron`, link bio `https://domain.com/berita/baca`, gambar `…/berita/m/…`.
- Worker: `APP_URL=https://domain.com BASE_PATH=/berita CRON_SECRET=… npm run worker`.

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
