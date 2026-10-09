interface DashboardWelcomeProps {
  nombre?: string;
  fechaPanel: string;
  hora: string;
}

export function DashboardWelcome({ nombre, fechaPanel, hora }: DashboardWelcomeProps) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-brand-navy text-white shadow-sm">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-istl-200">Panel institucional</p>
          <h1 className="mt-2 font-brand text-3xl font-bold leading-tight sm:text-4xl">
            Hola, {nombre}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
            Gestiona asistencia, horarios y reportes desde una vista ordenada según tu rol.
          </p>
        </div>
        <div className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm">
          <p className="text-white">{fechaPanel}</p>
          <p className="mt-1 font-semibold text-istl-100">{hora} hora Ecuador</p>
        </div>
      </div>
    </section>
  );
}
