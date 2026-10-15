"use client";
import { KeyRound } from "lucide-react";
import { ActButton } from "@/components/forms";
import { resetPassword, setUserActive, setUserRole } from "@/app/actions/admin";
import type { TeamMember } from "@/lib/types";

export function TeamList({ team, meId, seen }: { team: TeamMember[]; meId: string; seen: Record<number, string> }) {
  return (
    <div className="card divide-y divide-line/60">
      {team.map((m) => {
        const me = String(m.id) === meId;
        return (
          <div key={m.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.active ? "" : "opacity-60"}`}>
            <span className="grid size-9 place-items-center rounded-full bg-panel-2 text-sm font-bold">{m.name[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">
                {m.name} {me && <span className="text-[11px] text-dim">(kamu)</span>}
              </p>
              <p className="truncate text-[11px] text-dim">
                {m.email} · {m.active ? `terakhir masuk ${seen[m.id]}` : "nonaktif"}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-1.5">
              <ActButton
                run={() => setUserRole(m.id, m.role === "admin" ? "editor" : "admin")}
                className="btn !px-2 !py-1 text-[11px] capitalize"
                title="Klik untuk ganti role"
                confirm={`Ubah ${m.name} jadi ${m.role === "admin" ? "editor" : "admin"}?`}
              >
                {m.role}
              </ActButton>
              <ActButton
                run={async () => {
                  const pw = window.prompt(`Password baru untuk ${m.email} (min 8 karakter):`);
                  return pw ? resetPassword(m.id, pw) : undefined;
                }}
                className="btn !px-2 !py-1 text-[11px]"
                title="Reset password"
              >
                <KeyRound size={12} />
              </ActButton>
              {!me && (
                <ActButton
                  run={() => setUserActive(m.id, !m.active)}
                  className={`btn !px-2 !py-1 text-[11px] ${m.active ? "btn-danger" : ""}`}
                  confirm={m.active ? `Nonaktifkan ${m.name}? Dia langsung keluar.` : undefined}
                >
                  {m.active ? "Nonaktifkan" : "Aktifkan"}
                </ActButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
