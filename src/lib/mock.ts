/**
 * DATA DUMMY — tahap 1.
 * Semua halaman membaca lewat src/lib/data.ts. Saat tahap 2, ganti isi fungsi di data.ts
 * dengan query Drizzle; bentuk datanya sudah sama dengan tipe di types.ts.
 */
import type { Activity, Agent, BrainNote, Post, PostStatus, Source, TeamMember, Topic } from "./types";

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const ahead = (min: number) => new Date(now + min * 60_000).toISOString();

export const sources: Source[] = [
  { id: 1, name: "The Verge", siteUrl: "https://www.theverge.com", feedUrl: "https://www.theverge.com/rss/index.xml", category: "AI", active: true, lastFetchedAt: ago(15), topics24h: 21 },
  { id: 2, name: "TechCrunch", siteUrl: "https://techcrunch.com", feedUrl: "https://techcrunch.com/feed/", category: "AI", active: true, lastFetchedAt: ago(15), topics24h: 18 },
  { id: 3, name: "Social Media Today", siteUrl: "https://www.socialmediatoday.com", feedUrl: "https://www.socialmediatoday.com/feeds/news/", category: "SOSMED", active: true, lastFetchedAt: ago(15), topics24h: 14 },
  { id: 4, name: "HubSpot Blog", siteUrl: "https://blog.hubspot.com", feedUrl: "https://blog.hubspot.com/marketing/rss.xml", category: "MARKETING", active: true, lastFetchedAt: ago(16), topics24h: 9 },
  { id: 5, name: "Adweek", siteUrl: "https://www.adweek.com", feedUrl: "https://www.adweek.com/feed/", category: "MARKETING", active: true, lastFetchedAt: ago(16), topics24h: 8 },
  { id: 6, name: "Marketing Dive", siteUrl: "https://www.marketingdive.com", feedUrl: "https://www.marketingdive.com/feeds/news/", category: "MARKETING", active: true, lastFetchedAt: ago(17), topics24h: 6 },
  { id: 7, name: "detikInet", siteUrl: "https://inet.detik.com", feedUrl: "https://rss.detik.com/index.php/inet", category: "AI", active: false, lastFetchedAt: ago(60 * 26), topics24h: 0 },
];

type Seed = {
  headline: string;
  cat: "AI" | "SOSMED" | "MARKETING";
  src: number;
  status: PostStatus;
  score: number;
  mins: number;
  hue: number;
  template?: "stabilo" | "putih" | "foto";
};

const seeds: Seed[] = [
  { headline: "Asisten AI sekarang bisa kerja lintas aplikasi di HP kamu", cat: "AI", src: 1, status: "review", score: 73, mins: 52, hue: 330, template: "stabilo" },
  { headline: "Platform X rilis fitur pantau brand otomatis", cat: "SOSMED", src: 3, status: "review", score: 74, mins: 420, hue: 210, template: "putih" },
  { headline: "Konten kamu sudah dikutip chatbot AI atau belum?", cat: "MARKETING", src: 4, status: "review", score: 73, mins: 240, hue: 25, template: "foto" },
  { headline: "Agen AI sekarang bisa jalanin tugas bisnis sendiri", cat: "AI", src: 2, status: "review", score: 77, mins: 250, hue: 200, template: "putih" },
  { headline: "Pembeli riset dulu di AI, brand kamu ikut muncul?", cat: "MARKETING", src: 6, status: "review", score: 75, mins: 300, hue: 330, template: "stabilo" },
  { headline: "Reddit makin serius buat lead gen ads", cat: "MARKETING", src: 5, status: "review", score: 71, mins: 330, hue: 55, template: "stabilo" },
  { headline: "Kreator top kini pilih sedikit brand, minta saham", cat: "SOSMED", src: 3, status: "review", score: 72, mins: 360, hue: 160, template: "putih" },
  { headline: "Chatbot sekarang jawab pakai grafik, form, dan tombol", cat: "AI", src: 1, status: "review", score: 76, mins: 380, hue: 260, template: "foto" },
  { headline: "Iklan video pendek naik, budget TV makin tergerus", cat: "MARKETING", src: 5, status: "review", score: 70, mins: 400, hue: 15, template: "foto" },
  { headline: "Model AI gratis kini bisa edit foto lewat chat", cat: "AI", src: 2, status: "review", score: 78, mins: 410, hue: 290, template: "stabilo" },
  { headline: "Fitur belanja di live streaming makin agresif", cat: "SOSMED", src: 3, status: "review", score: 72, mins: 440, hue: 340, template: "putih" },
  { headline: "Brand kecil mulai pakai AI buat riset pesaing", cat: "MARKETING", src: 4, status: "review", score: 71, mins: 470, hue: 120, template: "foto" },
  { headline: "Aplikasi editing populer kini bisa bikin carousel otomatis", cat: "SOSMED", src: 3, status: "review", score: 73, mins: 500, hue: 50, template: "stabilo" },
  { headline: "Mesin pencari AI mulai tampilkan iklan", cat: "AI", src: 1, status: "review", score: 74, mins: 530, hue: 230, template: "putih" },
  { headline: "Kalau AI nggak nyebut brand kamu, kamu invisible", cat: "MARKETING", src: 6, status: "review", score: 79, mins: 560, hue: 60, template: "stabilo" },
  { headline: "Google bikin agen AI yang bisa kerja di banyak app", cat: "AI", src: 1, status: "posted", score: 80, mins: 60 * 26, hue: 330, template: "stabilo" },
  { headline: "Brand bisnis 2x lipat budget buat AI di paid media", cat: "MARKETING", src: 5, status: "posted", score: 76, mins: 60 * 27, hue: 0, template: "putih" },
  { headline: "Facebook mulai bisa langsung ke Reels di beranda", cat: "SOSMED", src: 3, status: "posted", score: 72, mins: 60 * 28, hue: 215, template: "putih" },
  { headline: "Endorsement selebriti kini diukur pakai AI", cat: "MARKETING", src: 5, status: "posted", score: 75, mins: 60 * 29, hue: 330, template: "stabilo" },
  { headline: "Brand aktif di sosmed lebih sering muncul di jawaban AI", cat: "SOSMED", src: 3, status: "posted", score: 77, mins: 60 * 30, hue: 250, template: "foto" },
  { headline: "Chatbot kini bisa tampilkan visual interaktif", cat: "AI", src: 1, status: "posted", score: 74, mins: 60 * 31, hue: 205, template: "putih" },
  { headline: "Asisten belanja AI kini checkout dalam satu klik", cat: "AI", src: 2, status: "posted", score: 78, mins: 60 * 32, hue: 320, template: "stabilo" },
  { headline: "Model AI ringan kini gratis buat developer", cat: "AI", src: 2, status: "posted", score: 73, mins: 60 * 33, hue: 270, template: "foto" },
  { headline: "Situs pembuat video AI makin mudah dipakai brand", cat: "AI", src: 2, status: "posted", score: 71, mins: 60 * 34, hue: 230, template: "foto" },
  { headline: "Platform rilis fitur caption otomatis buat Reels", cat: "SOSMED", src: 3, status: "posted", score: 70, mins: 60 * 35, hue: 50, template: "stabilo" },
  { headline: "Survei: marketer pakai AI tiap hari naik tajam", cat: "MARKETING", src: 4, status: "posted", score: 72, mins: 60 * 36, hue: 10, template: "putih" },
  { headline: "Iklan di aplikasi chat AI resmi dibuka", cat: "AI", src: 1, status: "posted", score: 79, mins: 60 * 37, hue: 300, template: "stabilo" },
  { headline: "Algoritma feed kini prioritaskan konten carousel", cat: "SOSMED", src: 3, status: "posted", score: 76, mins: 60 * 38, hue: 340, template: "stabilo" },
  { headline: "Gagal upload: video terlalu panjang", cat: "SOSMED", src: 3, status: "failed", score: 70, mins: 600, hue: 0, template: "putih" },
];

function captionFor(h: string, src: string) {
  return `${h}.\n\nIni penting buat kamu yang kerja di marketing & sosmed — geser buat lihat poin-poinnya.\n\nBaca artikel lengkapnya di link bio (sumber: ${src}).`;
}

function slidesFor(h: string, src: string) {
  return [
    { kind: "cover" as const, headline: h, body: "Menurut aku ini arah serius industri. Geser buat lihat detailnya." },
    { kind: "body" as const, headline: "Apa yang berubah?", body: "Ringkasan singkat poin utama dari artikel sumber, ditulis ulang dengan sudut pandang sendiri." },
    { kind: "cta" as const, headline: "Baca lengkapnya di link bio", body: `Klik link di bio, pilih postingan ini. Kamu langsung diarahkan ke artikel aslinya di ${src}.` },
  ];
}

export const posts: Post[] = seeds.map((s, i) => {
  const id = 37 - i;
  const src = sources.find((x) => x.id === s.src)!;
  const posted = s.status === "posted";
  const reach = posted ? 70 + ((id * 37) % 90) : 0;
  return {
    id,
    topicId: 100 + id,
    kicker: s.cat === "SOSMED" ? "Sosmed" : s.cat === "AI" ? "AI" : "Marketing",
    category: s.cat,
    headline: s.headline,
    headlineAlternatives: [
      s.headline.replace(/sekarang|kini/i, "akhirnya"),
      `Bye bye cara lama: ${s.headline.toLowerCase()}`,
    ],
    caption: captionFor(s.headline, src.name),
    hashtags: ["#marketingdigital", "#sosmed", "#ai", "#kontenkreator"],
    template: s.template ?? "stabilo",
    format: "carousel",
    slides: slidesFor(s.headline, src.name),
    status: s.status,
    score: s.score,
    sourceName: src.name,
    sourceUrl: `${src.siteUrl}/artikel-contoh-${id}`,
    shortCode: `a${(id * 7919).toString(36).slice(-4)}`,
    scheduledAt: s.status === "scheduled" ? ahead(180) : posted ? ago(s.mins + 30) : null,
    postedAt: posted ? ago(s.mins) : null,
    igPermalink: posted ? "https://www.instagram.com/" : null,
    createdAt: ago(s.mins + 40),
    views: posted ? Math.round(reach * 2.9) : 0,
    reach,
    likes: posted ? (id % 5) : 0,
    comments: 0,
    shares: posted ? id % 2 : 0,
    saves: 0,
    clicks: posted ? (id * 3) % 17 : 0,
    hue: s.hue,
  };
});

export const topics: Topic[] = Array.from({ length: 24 }, (_, i) => {
  const src = sources[i % 6];
  const score = i % 4 === 0 ? null : 40 + ((i * 17) % 45);
  const status: Topic["status"] =
    score === null ? "new" : score >= 70 ? (i % 3 === 0 ? "drafted" : "passed") : "rejected";
  const titles = [
    "Platform video pendek uji fitur langganan kreator",
    "Startup AI galang dana untuk agen customer service",
    "Laporan: belanja iklan digital Asia Tenggara naik",
    "Fitur baru memungkinkan jadwal posting dari desktop",
    "Model bahasa terbuka baru diklaim saingi model besar",
    "Brand fashion pakai model virtual untuk kampanye",
    "Aplikasi chat tambah fitur komunitas berbayar",
    "Riset: Gen Z cari produk lewat sosmed, bukan Google",
  ];
  return {
    id: 200 + i,
    title: titles[i % titles.length] + (i >= titles.length ? ` (${Math.floor(i / titles.length) + 1})` : ""),
    url: `${src.siteUrl}/topik-${i}`,
    sourceName: src.name,
    category: src.category,
    fetchedAt: ago(15 + i * 37),
    score,
    scoreReason:
      score === null
        ? null
        : score >= 70
        ? "Relevan untuk audiens marketing, ada sudut praktis, momentum tinggi."
        : "Terlalu teknis / niche, kecil kemungkinan dibagikan audiens.",
    status,
  };
});

export const agents: Agent[] = [
  { key: "scout", name: "Scout", role: "Pemantau topik", status: "standby", lastActiveAt: ago(15) },
  { key: "analis", name: "Analis", role: "Cek potensi viral", status: "standby", lastActiveAt: ago(15) },
  { key: "copywriter", name: "Copywriter", role: "Headline & caption", status: "standby", lastActiveAt: ago(240) },
  { key: "designer", name: "Designer", role: "Render gambar", status: "standby", lastActiveAt: ago(240) },
];

export const activity: Activity[] = [
  { id: 1, agent: "analis", message: "Menilai 3 topik, 0 lolos ambang skor 70", at: ago(16) },
  { id: 2, agent: "scout", message: "Belum ada topik baru", at: ago(16) },
  { id: 3, agent: "scout", message: "Menemukan 2 topik baru", at: ago(46) },
  { id: 4, agent: "scout", message: "Menemukan 1 topik baru", at: ago(76) },
  { id: 5, agent: "scout", message: "Belum ada topik baru", at: ago(106) },
  { id: 6, agent: "scout", message: "Belum ada topik baru", at: ago(136) },
  { id: 7, agent: "designer", message: "Render 2 slide untuk post #37", at: ago(230) },
  { id: 8, agent: "copywriter", message: "Menulis headline & caption untuk 3 topik", at: ago(240) },
  { id: 9, agent: "analis", message: "Menilai 4 topik, 1 lolos ambang skor 70", at: ago(250) },
  { id: 10, agent: "scout", message: "Menemukan 4 topik baru", at: ago(255) },
];

export const team: TeamMember[] = [
  { id: 1, name: "Admin", email: "admin@studio.local", role: "admin", active: true, lastSeenAt: ago(1) },
  { id: 2, name: "Rani", email: "rani@studio.local", role: "editor", active: true, lastSeenAt: ago(180) },
  { id: 3, name: "Dimas", email: "dimas@studio.local", role: "editor", active: false, lastSeenAt: ago(60 * 24 * 9) },
];

export const brain: BrainNote[] = [
  {
    id: 1,
    title: "Persona & suara",
    content:
      "Tulis seperti teman yang kerja di marketing: santai, pakai 'kamu', kalimat pendek. Hindari clickbait yang menipu. Selalu sebut sumber.",
    appliesTo: ["copywriter"],
  },
  {
    id: 2,
    title: "Kriteria skor viral",
    content:
      "Naikkan skor kalau: relevan buat marketer/UMKM Indonesia, ada dampak praktis, tokoh/brand besar terlibat. Turunkan kalau terlalu teknis, rumor, atau sudah basi >48 jam.",
    appliesTo: ["analis"],
  },
  {
    id: 3,
    title: "Aturan visual",
    content:
      "Cover: headline maks 9 kata, huruf kapital. Slide terakhir selalu CTA 'baca lengkapnya di link bio'. Cantumkan 'Sumber: <media>' di footer.",
    appliesTo: ["designer"],
  },
];

export const aiCost = { todayUsd: 0.085, monthUsd: 0.483 };
