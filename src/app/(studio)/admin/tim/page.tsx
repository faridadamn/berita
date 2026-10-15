import { UserPlus } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { ActionForm, Field } from "@/components/forms";
import { addUser } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { getTeam } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { TeamList } from "./team-list";

export default async function TimPage() {
  const me = await requireAdmin();
  const team = await getTeam();
  const seen = Object.fromEntries(team.map((m) => [m.id, timeAgo(m.lastSeenAt)]));
  return (
    <>
      <PageHead eyebrow="Admin" title="Tim & Akses">
        Tidak ada pendaftaran publik — akun hanya dibuat admin. Editor bisa review &amp; jadwalkan; admin juga mengatur sumber, tim, AI, dan pengaturan.
      </PageHead>
      <TeamList team={team} meId={me.userId} seen={seen} />

      <ActionForm action={addUser} resetOnSuccess className="card mt-4 grid gap-3 p-4 sm:grid-cols-2">
        <p className="text-sm font-semibold sm:col-span-2">Tambah anggota</p>
        <Field label="Nama"><input name="name" required className="input" /></Field>
        <Field label="Email"><input name="email" type="email" required className="input" /></Field>
        <Field label="Password awal" hint="Min 8 karakter. Minta dia ganti di halaman Akun.">
          <input name="password" type="text" required minLength={8} className="input font-mono" autoComplete="off" />
        </Field>
        <Field label="Role">
          <select name="role" className="input" defaultValue="editor">
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <button className="btn btn-primary"><UserPlus size={13} /> Buat akun</button>
        </div>
      </ActionForm>
    </>
  );
}
