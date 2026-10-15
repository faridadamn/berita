import type { Post, Slide, TemplateKey } from "@/lib/types";
import { brand } from "@/lib/config";
import { fitScale, headlineIdeal, placeholderGradient } from "@/lib/fit";

/**
 * Preview slide di browser (HTML/CSS). Tahap 3, komponen yang sama bisa dipakai
 * renderer server (mis. Satori / Playwright) untuk menghasilkan PNG 1080x1350.
 */
export function SlidePreview({
  post, slide, index = 0, className = "",
}: {
  post: Pick<Post, "template" | "hue" | "sourceName" | "kicker" | "imageUrl">;
  slide: Slide;
  index?: number;
  className?: string;
}) {
  const t: TemplateKey = post.template;
  const gradient = placeholderGradient(post.hue);
  const photo: React.CSSProperties = post.imageUrl
    ? { backgroundImage: `url("${post.imageUrl.replace(/"/g, "%22")}"), ${gradient}`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: gradient };
  const cq = (n: number) => ({ fontSize: `${n}cqw` });
  const hq = (n: number, ideal: number) => cq(n * fitScale(slide.headline, ideal));

  const header = (dark: boolean) => (
    <div className={`flex items-center justify-between ${dark ? "text-white/70" : "text-black/60"}`} style={cq(2.6)}>
      <span>
        catatan {brand.handle.replace("@", "")} · {post.kicker.toLowerCase()}
      </span>
      <span>{index + 1}</span>
    </div>
  );
  const footer = (dark: boolean) => (
    <div className={`flex justify-between ${dark ? "text-white/60" : "text-black/50"}`} style={cq(2.4)}>
      <span>Sumber: {post.sourceName}</span>
      <span>{brand.handle}</span>
    </div>
  );

  const base = "relative h-full w-full overflow-hidden";
  const wrap = (node: React.ReactNode) => (
    <div className={`aspect-[4/5] w-full overflow-hidden rounded-lg [container-type:inline-size] ${className}`}>{node}</div>
  );

  if (slide.kind === "cta") {
    const bg = t === "putih" ? "bg-white text-black" : t === "foto" ? "bg-neutral-950 text-white" : "bg-[#f06bb7] text-black";
    return wrap(
      <div className={`${base} ${bg} flex flex-col p-[6cqw]`}>
        {header(t === "foto")}
        <div className="flex flex-1 flex-col justify-center gap-[3cqw]">
          <p className={`display ${t === "foto" ? "text-accent" : ""}`} style={hq(10, headlineIdeal.cta)}>
            {slide.headline}
          </p>
          <p style={cq(3.6)} className="leading-snug opacity-85">
            {slide.body}
          </p>
        </div>
        {footer(t === "foto")}
      </div>
    );
  }

  if (t === "foto") {
    return wrap(
      <div className={`${base} flex flex-col p-[6cqw] text-white`} style={photo}>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="relative">{header(true)}</div>
        <div className="relative mt-auto space-y-[2.5cqw]">
          <p className="font-extrabold leading-[1.05] text-[#ff6fb5]" style={hq(7.4, headlineIdeal.foto)}>
            {slide.headline}
          </p>
          {slide.body && (
            <p className="leading-snug text-white/80" style={cq(3.2)}>
              {slide.body}
            </p>
          )}
          {footer(true)}
        </div>
      </div>
    );
  }

  if (t === "putih") {
    return wrap(
      <div className={`${base} flex flex-col bg-white p-[6cqw] text-black`}>
        {header(false)}
        <p className="mt-[5cqw] text-center font-[DM_Serif_Display] leading-[1.05]" style={hq(7.6, headlineIdeal.putih)}>
          {slide.headline}
        </p>
        {slide.body && (
          <p className="mx-auto mt-[2.5cqw] max-w-[85%] text-center leading-snug text-black/70" style={cq(3)}>
            {slide.body}
          </p>
        )}
        <div className="mt-[4cqw] flex-1 rounded-[2cqw]" style={photo} />
        <div className="mt-[3cqw]">{footer(false)}</div>
      </div>
    );
  }

  // stabilo (default)
  return wrap(
    <div className={`${base} flex flex-col bg-[#f06bb7] p-[6cqw] text-black`}>
      {header(false)}
      <p className="display mt-[4cqw] text-center" style={hq(9, headlineIdeal.stabilo)}>
        “{slide.headline}”
      </p>
      <div className="mx-[3cqw] mt-[4cqw] flex-1 rounded-[2cqw] shadow-lg" style={photo} />
      {slide.body && (
        <p className="mt-[4cqw] text-center font-medium leading-snug" style={cq(3.4)}>
          {slide.body}
        </p>
      )}
      <div className="mt-[3cqw]">{footer(false)}</div>
    </div>
  );
}
