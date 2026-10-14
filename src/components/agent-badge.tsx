import { Radar, ScanSearch, PenLine, Palette } from "lucide-react";
import type { AgentKey } from "@/lib/types";

export const agentStyle: Record<AgentKey, { label: string; text: string; bg: string; Icon: typeof Radar }> = {
  scout: { label: "Scout", text: "text-scout", bg: "bg-scout/10", Icon: Radar },
  analis: { label: "Analis", text: "text-analis", bg: "bg-analis/10", Icon: ScanSearch },
  copywriter: { label: "Copywriter", text: "text-copy", bg: "bg-copy/10", Icon: PenLine },
  designer: { label: "Designer", text: "text-design", bg: "bg-design/10", Icon: Palette },
};

export function AgentIcon({ agent, size = 16 }: { agent: AgentKey; size?: number }) {
  const s = agentStyle[agent];
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${s.bg} ${s.text}`}>
      <s.Icon size={size} />
    </span>
  );
}
