import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="display text-6xl">404</p>
        <p className="mt-2 text-sm text-muted">Halaman tidak ditemukan.</p>
        <Link href="/" className="btn mt-5">Kembali ke Overview</Link>
      </div>
    </main>
  );
}
