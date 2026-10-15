export function BarList({
  title, sub, rows,
}: {
  title: string;
  sub?: string;
  rows: { name: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-dim">{sub}</p>}
      {!rows.length && <p className="mt-4 text-[12px] text-dim">Belum ada data.</p>}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 text-[12px]">
            <span className="w-28 shrink-0 truncate text-muted">{r.name}</span>
            <span className="h-3 flex-1">
              <span
                className="block h-full rounded-sm bg-[#76b300]"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            </span>
            <span className="w-10 text-right font-mono text-[11px]">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
