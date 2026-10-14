export function PageHead({
  eyebrow, title, children, actions,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-1.5 text-4xl lg:text-5xl">{title}</h1>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  label, value, sub, highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "!border-accent/40" : ""}`}>
      <p className="eyebrow !text-[9px]">{label}</p>
      <p className={`display mt-2 text-4xl ${highlight ? "text-accent" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
