import type { AuthUser } from '../../contexts/AuthContext';
import { rolColors, rolLabels } from './constants';

interface DashboardHeaderProps {
  user: AuthUser | null;
  onLogout: () => void;
}

export function DashboardHeader({ user, onLogout: handleLogout }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <img
              src="/brand/istl-icon.png"
              alt="IST-LOJA"
              className="h-10 w-10 object-contain"
            />
            <div>
              <p className="font-brand text-base font-bold text-brand-navy leading-none">IST-LOJA</p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Asistencia Virtual</p>
            </div>
          </div>

          {/* Usuario */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {user?.nombre} {user?.apellido}
              </p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolColors[user?.rol ?? 'docente']}`}>
                {rolLabels[user?.rol ?? 'docente']}
              </span>
            </div>
            <button
              onClick={handleLogout}
              id="btn-logout"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
