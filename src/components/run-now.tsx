"use client";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { runNow, type ActionState } from "@/app/actions/studio";
import { Msg } from "./forms";

export function RunNowButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionState | null>(null);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button className="btn disabled:opacity-60" disabled={pending} onClick={() => start(async () => setRes(await runNow()))}>
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Redaksi bekerja… (bisa 1–2 menit)" : "Cari topik sekarang"}
      </button>
      {res?.message && <div className="max-w-sm text-right"><Msg ok={res.ok} text={res.message} /></div>}
    </div>
  );
}
