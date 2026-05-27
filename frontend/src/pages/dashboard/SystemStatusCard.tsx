interface SystemStatusCardProps {
  className?: string;
}

export function SystemStatusCard({ className = '' }: SystemStatusCardProps) {
  return (
    <div className={`${className} surface-card p-5`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="section-title">Estado del sistema</h2>
          <p className="section-subtitle">Visibilidad operativa reservada para TICs.</p>
        </div>
        <span className="status-pill bg-istl-50 text-istl-700">TICs</span>
      </div>
      <div className="space-y-3">
        {[
          { label: 'API Backend', status: 'Conectado', ok: true },
          { label: 'Base de datos PostgreSQL', status: 'Conectado', ok: true },
          { label: 'Redis (cache)', status: 'Conectado', ok: true },
        ].map(({ label, status, ok }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-istl-700' : 'text-amber-600'}`}>
              <span className={`w-2 h-2 rounded-full ${ok ? 'bg-brand-teal animate-pulse-slow' : 'bg-amber-400'}`} />
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
