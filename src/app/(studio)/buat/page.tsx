import { PageHead } from "@/components/page-head";
import { CreateForm } from "./create-form";

export default function BuatPage() {
  return (
    <>
      <PageHead eyebrow="Manual" title="Buat Konten">
        Tulis draft dari link pilihanmu — review repo, tutorial, rangkuman video — atau dari ide. Hasilnya masuk Antrian Review seperti biasa.
      </PageHead>
      <div className="card max-w-3xl p-5">
        <CreateForm />
      </div>
    </>
  );
}
