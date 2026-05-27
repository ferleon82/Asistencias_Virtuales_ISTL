import type { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ReactNode;
  color: string;
}

export function KpiCard({ title, value, subtitle, icon, color }: KpiCardProps) {
  return (
    <div className="surface-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-brand-navy">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-md p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}
