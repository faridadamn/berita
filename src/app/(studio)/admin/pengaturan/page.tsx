import { PageHead } from "@/components/page-head";
import { ActionForm, Field } from "@/components/forms";
import { saveSettingsAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { loadChain } from "@/lib/ai";
import { presets } from "@/lib/ai/providers";
import { brand } from "@/lib/config";
import { getProviders } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { ProviderManager } from "./provider-manager";

export default async function PengaturanPage() {
  await requireAdmin();
  const [s, providers] = await Promise.all([getSettings(), getProviders()]);
  const envFallback = providers.length ? [] : (await loadChain()).map((p) => p.name);
  const cronReady = !!process.env.CRON_SECRET;

  return (
    <>
      <PageHead eyebrow="Admin" title="Pengaturan" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ProviderManager providers={providers} presets={presets} envFallback={envFallback} />

        <div className="space-y-4">
          <ActionForm action={saveSettingsAction} className="card grid grid-cols-2 gap-3 p-4">
            <p className="col-span-2 text-sm font-semibold">Redaksi AI</p>
            <Field label="Mode" className="col-span-2" hint="Semi-otomatis: agen jalan sendiri sesuai jadwal, tim tetap approve. Manual: hanya lewat tombol.">
              <select name="mode" defaultValue={s.mode} className="input">
                <option value="semi">Semi-otomatis</option>
                <option value="manual">Manual</option>
                <option value="off">Mati</option>
              </select>
            </Field>
            <Field label="Mulai kerja (jam WIB)"><input name="workStart" type="number" min={0} max={23} defaultValue={s.workStart} className="input" /></Field>
            <Field label="Selesai (jam WIB)"><input name="workEnd" type="number" min={1} max={24} defaultValue={s.workEnd} className="input" /></Field>
            <Field label="Ambang skor lolos"><input name="threshold" type="number" min={0} max={100} defaultValue={s.threshold} className="input" /></Field>
            <Field label="Topik dinilai / putaran"><input name="analyzeBatch" type="number" min={1} max={30} defaultValue={s.analyzeBatch} className="input" /></Field>
            <Field label="Draft ditulis / putaran"><input name="draftsPerRun" type="number" min={0} max={10} defaultValue={s.draftsPerRun} className="input" /></Field>
            <Field label="Umur topik maks (jam)"><input name="maxTopicAgeHours" type="number" min={1} max={336} defaultValue={s.maxTopicAgeHours} className="input" /></Field>
            <Field label="Gaya bahasa" className="col-span-2"><input name="language" defaultValue={s.language} className="input" /></Field>
            <div className="col-span-2"><button className="btn btn-primary">Simpan pengaturan</button></div>
          </ActionForm>

          <div className="card divide-y divide-line/60 text-[12px]">
            <Row k="Brand" v={`${brand.name} · ${brand.handle}`} note="NEXT_PUBLIC_BRAND_NAME / _HANDLE" />
            <Row k="Penjadwal" v={cronReady ? "CRON_SECRET terpasang" : "CRON_SECRET belum diisi"} warn={!cronReady} note="Panggil /api/cron tiap 15 menit (lihat README)" />
            <Row k="Instagram" v="Belum tersambung" note="Tahap 3 — Instagram Graph API" />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, v, note, warn }: { k: string; v: string; note?: string; warn?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
      <div>
        <p className="text-[13px]">{k}</p>
        {note && <p className="text-[11px] text-dim">{note}</p>}
      </div>
      <span className={`font-mono ${warn ? "text-copy" : "text-muted"}`}>{v}</span>
    </div>
  );
}
