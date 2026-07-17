import type { ModulePermission } from './types';
import { rolLabels } from './constants';

interface ModulePermissionGroup {
  moduleKey: string;
  label: string;
  items: ModulePermission[];
}

interface ModulePermissionsSectionProps {
  groupedPermissions: ModulePermissionGroup[];
  loading: boolean;
  message: string;
  error: string;
  togglePermission: (permissionId: string, enabled: boolean) => void;
  savePermissions: () => Promise<void>;
}

const roles = ['docente', 'coordinador', 'rectorado', 'talento_humano', 'tics'];

export function ModulePermissionsSection({
  groupedPermissions,
  loading,
  message,
  error,
  togglePermission,
  savePermissions,
}: ModulePermissionsSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Configuración de módulos</h2>
          <p className="section-subtitle">
            Habilite los módulos visibles para cada rol institucional.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-istl-700">TICs</span>
      </div>

      {message && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="table-container mt-5">
        <table className="min-w-[860px] divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Módulo</th>
              {roles.map((role) => (
                <th key={role} className="py-2 pr-4 text-center">
                  {rolLabels[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedPermissions.map((group) => (
              <tr key={group.moduleKey}>
                <td className="py-3 pr-4 font-medium text-slate-700">{group.label}</td>
                {roles.map((role) => {
                  const permission = group.items.find((item) => item.rol === role);
                  const locked = group.moduleKey === 'module_permissions' && role === 'tics';

                  return (
                    <td key={`${group.moduleKey}-${role}`} className="py-3 pr-4 text-center">
                      {permission && (
                        <input
                          type="checkbox"
                          checked={permission.enabled}
                          disabled={loading || locked}
                          onChange={(event) => togglePermission(permission.id, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal disabled:cursor-not-allowed"
                          aria-label={`${group.label} ${rolLabels[role]}`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {groupedPermissions.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={roles.length + 1}>
                  No hay módulos configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={() => void savePermissions()} disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </section>
  );
}
