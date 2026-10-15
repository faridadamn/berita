import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { getBrandKit } from "@/lib/brand-kit";
import { BrandEditor } from "./brand-editor";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  await requireAdmin();
  const kit = await getBrandKit();
  return (
    <>
      <PageHead eyebrow="Admin" title="Brand Kit">
        Warna, font, logo, dan gaya visual yang dipakai template <b className="text-fg">Brand Kit</b> — dan, kalau diaktifkan, semua template lain.
        Nama, handle & deskripsi akun juga dipakai AI saat menulis.
      </PageHead>
      <BrandEditor initial={kit} />
    </>
  );
}
