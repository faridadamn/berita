import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { appUrl, getChannelViews } from "@/lib/channels";
import { ChannelCard } from "./channel-card";

const guides = {
  instagram: (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Akun Instagram harus <b>Business</b> atau <b>Creator</b>.</li>
      <li>Di developers.facebook.com buat app → tambahkan produk <b>Instagram</b> → &quot;API setup with Instagram login&quot;.</li>
      <li>Tambahkan akunmu, beri izin <code>instagram_business_basic</code> + <code>instagram_business_content_publish</code> (+ <code>instagram_business_manage_insights</code> untuk analitik).</li>
      <li>Generate access token → salin token dan <b>Instagram User ID</b> ke sini.</li>
    </ol>
  ),
  threads: (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Di developers.facebook.com buat app dengan use case <b>Access the Threads API</b>.</li>
      <li>Tambahkan akun Threads kamu sebagai tester, terima undangannya di pengaturan Threads.</li>
      <li>Beri izin <code>threads_basic</code>, <code>threads_content_publish</code>, <code>threads_manage_insights</code>, lalu buat long-lived token.</li>
    </ol>
  ),
  x: (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Di developer.x.com buat Project + App.</li>
      <li>User authentication settings → App permissions <b>Read and write</b>.</li>
      <li>Keys and tokens → salin API Key &amp; Secret, lalu generate <b>Access Token &amp; Secret</b> (setelah izin diubah ke Read and write).</li>
      <li>Batas posting tergantung paket API X kamu.</li>
    </ol>
  ),
};

export default async function KanalPage() {
  await requireAdmin();
  const channels = await getChannelViews();
  const base = appUrl();
  return (
    <>
      <PageHead eyebrow="Admin" title="Kanal">
        Akun tujuan posting otomatis. Kredensial disimpan terenkripsi. Tanpa kanal pun, tiap post bisa disalin &amp; diposting manual.
      </PageHead>
      {!base?.startsWith("https://") && (
        <p className="mb-4 rounded-xl border border-copy/30 bg-copy/5 px-4 py-3 text-[13px]">
          <b>APP_URL</b> {base ? `= ${base} (bukan https)` : "belum diisi"}. Instagram &amp; Threads mengambil gambar dari URL publik aplikasi ini, jadi isi
          APP_URL dengan domain https kamu (mis. https://studio.domainkamu.com). X tidak butuh ini.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {channels.map((c) => (
          <ChannelCard key={c.platform} c={c} guide={guides[c.platform]} />
        ))}
      </div>
    </>
  );
}
