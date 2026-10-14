import { agentStyle } from "@/components/agent-badge";
import { PageHead } from "@/components/page-head";
import { getBrain } from "@/lib/data";

export default async function BrainPage() {
  const notes = await getBrain();
  return (
    <>
      <PageHead eyebrow="Pedoman AI" title="Brain">
        Aturan gaya, persona, dan kriteria yang disuntikkan ke prompt tiap agen.
      </PageHead>
      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <article key={n.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{n.title}</h2>
              <div className="flex gap-1">
                {n.appliesTo.map((a) => (
                  <span key={a} className={`rounded px-1.5 py-0.5 text-[10px] ${agentStyle[a].bg} ${agentStyle[a].text}`}>
                    {agentStyle[a].label}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{n.content}</p>
          </article>
        ))}
      </div>
    </>
  );
}
