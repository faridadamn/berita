export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Berita",
  handle: process.env.NEXT_PUBLIC_BRAND_HANDLE ?? "@akunkamu",
};

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Jam kerja AI (WIB). Agen hanya jalan di rentang ini. */
export const aiWorkHours = { start: 7, end: 22 };

/** Ambang skor minimal topik lolos analis. */
export const scoreThreshold = 70;

export const timezone = "Asia/Jakarta";
