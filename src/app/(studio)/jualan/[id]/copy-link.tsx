"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ label, url }: { label: string; url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[12px] text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-panel-2 px-2 py-1 text-[11px]">{url.replace(/^https?:\/\//, "")}</code>
      <button
        type="button"
        className="btn !px-2 !py-1 text-[11px]"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        }}
      >
        {ok ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}
