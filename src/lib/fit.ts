/** Skala ukuran font berdasarkan panjang teks (dipakai preview browser & renderer PNG supaya sama). */
export function fitScale(text: string, idealChars: number, min = 0.55) {
  const len = Math.max(1, text.trim().length);
  return Math.max(min, Math.min(1, Math.sqrt(idealChars / len)));
}

export const headlineIdeal = { stabilo: 42, putih: 55, foto: 55, cta: 28 } as const;

/** hsl → hex (satori tidak selalu paham hsl()) */
export function hslHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

export const placeholderGradient = (hue: number) =>
  `linear-gradient(135deg, ${hslHex(hue, 45, 32)}, ${hslHex((hue + 40) % 360, 35, 14)})`;
