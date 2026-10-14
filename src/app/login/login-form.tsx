"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <label className="block space-y-1.5">
        <span className="text-xs text-muted">Email</span>
        <input name="email" type="email" autoComplete="email" required className="input" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs text-muted">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-60">
        {pending ? "Masuk…" : "Masuk ke HQ"}
      </button>
    </form>
  );
}
