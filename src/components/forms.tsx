"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions/studio";

/** <form> dengan pesan sukses/gagal dari server action (useActionState). */
export function ActionForm({
  action, children, className, resetOnSuccess,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={run} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.message && <Msg ok={state.ok} text={state.message} />}
    </form>
  );
}

export function Msg({ ok, text }: { ok?: boolean; text: string }) {
  return <p className={`text-[12px] ${ok ? "text-ok" : "text-danger"}`}>{text}</p>;
}

/** Tombol yang memanggil server action langsung; bisa minta konfirmasi & tampilkan hasil. */
export function ActButton({
  run, children, confirm, className = "btn", title,
}: {
  run: () => Promise<ActionState | void>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        title={title}
        disabled={pending}
        className={`${className} disabled:opacity-50`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await run();
            setMsg(r && r.message ? r : null);
          });
        }}
      >
        {children}
      </button>
      {msg?.message && <Msg ok={msg.ok} text={msg.message} />}
    </span>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="eyebrow !text-[9px]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-dim">{hint}</span>}
    </label>
  );
}
