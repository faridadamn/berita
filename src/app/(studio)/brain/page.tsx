import { PageHead } from "@/components/page-head";
import { requireSession } from "@/lib/auth";
import { getBrain } from "@/lib/data";
import { BrainEditor } from "./brain-editor";

export default async function BrainPage() {
  const s = await requireSession();
  const notes = await getBrain();
  return (
    <>
      <PageHead eyebrow="Pedoman AI" title="Brain">
        Aturan gaya, persona, dan kriteria yang disuntikkan ke prompt tiap agen. Ubah di sini, putaran berikutnya langsung ikut.
      </PageHead>
      <BrainEditor notes={notes} canEdit={s.role === "admin"} />
    </>
  );
}
