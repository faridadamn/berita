import { PageHead } from "@/components/page-head";
import { ActionForm, Field } from "@/components/forms";
import { changeOwnPassword } from "@/app/actions/admin";
import { requireSession } from "@/lib/auth";

export default async function AkunPage() {
  const s = await requireSession();
  return (
    <>
      <PageHead eyebrow={s.email} title="Akun" />
      <ActionForm action={changeOwnPassword} resetOnSuccess className="card max-w-md space-y-3 p-4">
        <p className="text-sm font-semibold">Ganti password</p>
        <Field label="Password lama"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
        <Field label="Password baru" hint="Min 8 karakter"><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
        <button className="btn btn-primary">Simpan</button>
      </ActionForm>
    </>
  );
}
