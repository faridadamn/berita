/**
 * Template slide untuk renderer PNG (satori). Tata letaknya meniru components/slide-preview.tsx:
 * 1 "cqw" di preview = 10.8px di sini (lebar 1080).
 * Catatan satori: setiap <div> dengan >1 anak wajib display:flex; hanya flexbox.
 */
import type { CSSProperties, ReactNode } from "react";
import { fitScale, headlineIdeal, placeholderGradient } from "../fit";

export const W = 1080;
export const H = 1350;
const u = (n: number) => Math.round(n * 10.8);

const PINK = "#f06bb7";
const ACCENT = "#d6f43c";

export type SlideInput = {
  template: "stabilo" | "putih" | "foto";
  kind: "cover" | "body" | "cta";
  headline: string;
  body?: string;
  index: number; // 1-based
  kicker: string;
  sourceName: string;
  handle: string;
  hue: number;
  /** data URI JPEG yang sudah di-crop, atau null */
  photo: string | null;
};

const col: CSSProperties = { display: "flex", flexDirection: "column" };

function Photo({ src, hue, style }: { src: string | null; hue: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", position: "relative", overflow: "hidden", backgroundImage: placeholderGradient(hue), ...style }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
}

function Header({ s, dark }: { s: SlideInput; dark: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: u(2.6), color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.6)", fontFamily: "Inter", fontWeight: 500 }}>
      <div>{`catatan ${s.handle.replace("@", "")} · ${s.kicker.toLowerCase()}`}</div>
      <div>{String(s.index)}</div>
    </div>
  );
}

function Footer({ s, dark }: { s: SlideInput; dark: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: u(2.4), color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", fontFamily: "Inter", fontWeight: 500 }}>
      <div>{`Sumber: ${s.sourceName}`}</div>
      <div>{s.handle}</div>
    </div>
  );
}

const PAD = u(6);
/** Kanvas W×H; `back` = lapisan latar penuh (foto, gradien), `children` = konten dengan padding. */
const frame = (bg: CSSProperties, children: ReactNode, back?: ReactNode) => (
  <div style={{ display: "flex", width: W, height: H, position: "relative", overflow: "hidden", fontFamily: "Inter", ...bg }}>
    {back}
    <div style={{ ...col, position: "absolute", top: PAD, left: PAD, width: W - 2 * PAD, height: H - 2 * PAD }}>{children}</div>
  </div>
);

const size = (base: number, text: string, ideal: number) => Math.round(u(base) * fitScale(text, ideal));

export function SlideImage(s: SlideInput) {
  const t = s.template;

  if (s.kind === "cta") {
    const dark = t === "foto";
    const bg = t === "putih" ? { backgroundColor: "#ffffff", color: "#000" } : dark ? { backgroundColor: "#0a0a0a", color: "#fff" } : { backgroundColor: PINK, color: "#000" };
    return frame(bg, [
      <Header key="h" s={s} dark={dark} />,
      <div key="m" style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(3) }}>
        <div style={{ fontFamily: "Anton", fontSize: size(10, s.headline, headlineIdeal.cta), lineHeight: 0.95, color: dark ? ACCENT : "#000" }}>
          {s.headline.toUpperCase()}
        </div>
        {s.body ? <div style={{ fontSize: u(3.6), lineHeight: 1.35, opacity: 0.85, fontWeight: 500 }}>{s.body}</div> : null}
      </div>,
      <Footer key="f" s={s} dark={dark} />,
    ]);
  }

  if (t === "foto") {
    return frame({ color: "#fff", backgroundColor: "#000" }, [
      <Header key="h" s={s} dark />,
      <div key="b" style={{ ...col, marginTop: "auto", gap: u(2.5) }}>
        <div style={{ fontWeight: 800, fontSize: size(7.4, s.headline, headlineIdeal.foto), lineHeight: 1.05, color: "#ff6fb5" }}>{s.headline}</div>
        {s.body ? <div style={{ fontSize: u(3.2), lineHeight: 1.35, color: "rgba(255,255,255,.8)", fontWeight: 500 }}>{s.body}</div> : null}
        <Footer s={s} dark />
      </div>,
    ], [
      <Photo key="p" src={s.photo} hue={s.hue} style={{ position: "absolute", top: 0, left: 0, width: W, height: H }} />,
      <div key="g" style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,0) 100%)" }} />,
    ]);
  }

  if (t === "putih") {
    return frame({ backgroundColor: "#ffffff", color: "#000" }, [
      <Header key="h" s={s} dark={false} />,
      <div key="t" style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: u(5), fontFamily: "DM Serif Display", fontSize: size(7.6, s.headline, headlineIdeal.putih), lineHeight: 1.05 }}>
        {s.headline}
      </div>,
      s.body ? (
        <div key="s" style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: u(2.5), alignSelf: "center", maxWidth: "85%", fontSize: u(3), lineHeight: 1.35, color: "rgba(0,0,0,.7)", fontWeight: 500 }}>
          {s.body}
        </div>
      ) : null,
      <Photo key="p" src={s.photo} hue={s.hue} style={{ marginTop: u(4), flexGrow: 1, borderRadius: u(2) }} />,
      <div key="f" style={{ ...col, marginTop: u(3) }}><Footer s={s} dark={false} /></div>,
    ]);
  }

  // stabilo
  return frame({ backgroundColor: PINK, color: "#000" }, [
    <Header key="h" s={s} dark={false} />,
    <div key="t" style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: u(4), fontFamily: "Anton", fontSize: size(9, s.headline, headlineIdeal.stabilo), lineHeight: 0.95 }}>
      {`“${s.headline.toUpperCase()}”`}
    </div>,
    <Photo key="p" src={s.photo} hue={s.hue} style={{ margin: `${u(4)}px ${u(3)}px 0`, flexGrow: 1, borderRadius: u(2), boxShadow: "0 20px 40px rgba(0,0,0,.25)" }} />,
    s.body ? (
      <div key="s" style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: u(4), fontSize: u(3.4), lineHeight: 1.35, fontWeight: 500 }}>
        {s.body}
      </div>
    ) : null,
    <div key="f" style={{ ...col, marginTop: u(3) }}><Footer s={s} dark={false} /></div>,
  ]);
}
