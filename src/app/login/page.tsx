import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { brand } from "@/lib/config";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <p className="eyebrow flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" /> {brand.name} studio
        </p>
        <h1 className="display mt-3 text-6xl">Studio</h1>
        <p className="mt-2 text-sm text-muted">Khusus tim. Akun dibuat oleh admin.</p>
        <div className="card mt-8 p-5">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
