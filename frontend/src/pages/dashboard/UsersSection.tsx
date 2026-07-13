import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { rolLabels } from './constants';
import type { UsuarioForm, UsuarioItem } from './types';

interface UsersSectionProps {
  usuarios: UsuarioItem[];
  filteredUsuarios: UsuarioItem[];
  usuarioForm: UsuarioForm;
  setUsuarioForm: Dispatch<SetStateAction<UsuarioForm>>;
  usuarioMessage: string;
  usuarioError: string;
  usuarioLoading: boolean;
  editingUsuarioId: string | null;
  usuarioRolFilter: string;
  setUsuarioRolFilter: Dispatch<SetStateAction<string>>;
  saveUsuario: () => Promise<void>;
  resetUsuarioForm: () => void;
  editUsuario: (usuario: UsuarioItem) => void;
  toggleUsuarioActivo: (usuario: UsuarioItem) => Promise<void>;
  resetUsuarioPassword: (usuario: UsuarioItem) => Promise<void>;
}

export function UsersSection({
  usuarios,
  filteredUsuarios,
  usuarioForm,
  setUsuarioForm,
  usuarioMessage,
  usuarioError,
  usuarioLoading,
  editingUsuarioId,
  usuarioRolFilter,
  setUsuarioRolFilter,
  saveUsuario,
  resetUsuarioForm,
  editUsuario,
  toggleUsuarioActivo,
  resetUsuarioPassword,
}: UsersSectionProps) {
  const usersPageSize = 10;
  const [usersPage, setUsersPage] = useState(1);
  const totalVisibleUsers = filteredUsuarios.length;
  const totalUsersPages = Math.max(1, Math.ceil(totalVisibleUsers / usersPageSize));
  const safeUsersPage = Math.min(usersPage, totalUsersPages);
  const usersStartIndex = (safeUsersPage - 1) * usersPageSize;
  const usersEndIndex = Math.min(usersStartIndex + usersPageSize, totalVisibleUsers);
  const visibleUsuarios = filteredUsuarios.slice(usersStartIndex, usersEndIndex);

  useEffect(() => {
    setUsersPage(1);
  }, [usuarioRolFilter]);

  useEffect(() => {
    setUsersPage((current) => Math.min(current, totalUsersPages));
  }, [totalUsersPages]);

  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Gestión de usuarios</h2>
          <p className="section-subtitle">
            Cree cuentas institucionales para docentes, coordinacion, TICs, rectorado o talento humano.
          </p>
        </div>
        <div className="text-sm text-slate-500">{usuarios.length} usuarios registrados</div>
      </div>

      {usuarioMessage && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
          {usuarioMessage}
        </div>
      )}
      {usuarioError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {usuarioError}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-sm text-slate-600 md:col-span-2">
          Email institucional
          <input
            type="email"
            value={usuarioForm.email}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="usuario@tecnologicoloja.edu.ec"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Nombre
          <input
            value={usuarioForm.nombre}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, nombre: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Apellido
          <input
            value={usuarioForm.apellido}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, apellido: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Cédula
          <input
            value={usuarioForm.cedula}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, cedula: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Rol
          <select
            value={usuarioForm.rol}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, rol: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {Object.entries(rolLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Teléfono
          <input
            value={usuarioForm.telefono}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, telefono: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          {editingUsuarioId ? 'Nueva contraseña' : 'Contraseña inicial'}
          <input
            type="password"
            value={usuarioForm.password}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={editingUsuarioId ? 'Dejar vacia para conservarla' : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={usuarioForm.activo}
            onChange={(event) => setUsuarioForm((current) => ({ ...current, activo: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
          />
          Activo
        </label>
        <button
          type="button"
          onClick={() => void saveUsuario()}
          disabled={usuarioLoading}
          className="btn-primary self-end"
        >
          {usuarioLoading ? 'Guardando...' : editingUsuarioId ? 'Actualizar usuario' : 'Crear usuario'}
        </button>
        {editingUsuarioId && (
          <button
            type="button"
            onClick={resetUsuarioForm}
            className="btn-secondary self-end"
          >
            Cancelar edición
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm text-slate-600">
          Filtrar por rol
          <select
            value={usuarioRolFilter}
            onChange={(event) => setUsuarioRolFilter(event.target.value)}
            className="mt-1 w-full min-w-52 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            <option value="todos">Todos</option>
            {Object.entries(rolLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            {totalVisibleUsers === 0
              ? '0 visibles'
              : `${usersStartIndex + 1}-${usersEndIndex} de ${totalVisibleUsers} visibles`}
          </span>
          <button
            type="button"
            onClick={() => setUsersPage((current) => Math.max(1, current - 1))}
            disabled={safeUsersPage === 1 || totalVisibleUsers === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior de usuarios"
          >
            &lt;
          </button>
          <span className="min-w-12 text-center text-xs">
            {safeUsersPage}/{totalUsersPages}
          </span>
          <button
            type="button"
            onClick={() => setUsersPage((current) => Math.min(totalUsersPages, current + 1))}
            disabled={safeUsersPage === totalUsersPages || totalVisibleUsers === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente de usuarios"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="table-container mt-4">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Usuario</th>
              <th className="py-2 pr-4">Rol</th>
              <th className="py-2 pr-4">Cédula</th>
              <th className="py-2 pr-4">Último acceso</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleUsuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="py-2 pr-4">
                  <p className="font-medium text-slate-700">{usuario.nombre} {usuario.apellido}</p>
                  <p className="text-xs text-slate-500">{usuario.email}</p>
                </td>
                <td className="py-2 pr-4 text-slate-500">{rolLabels[usuario.rol] ?? usuario.rol}</td>
                <td className="py-2 pr-4 text-slate-500">{usuario.cedula}</td>
                <td className="py-2 pr-4 text-slate-500">
                  {usuario.ultimo_acceso
                    ? new Date(usuario.ultimo_acceso).toLocaleDateString('es-EC')
                    : 'Sin ingreso'}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${usuario.activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => editUsuario(usuario)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleUsuarioActivo(usuario)}
                      disabled={usuarioLoading}
                      className="rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:text-slate-400"
                    >
                      {usuario.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void resetUsuarioPassword(usuario)}
                      disabled={usuarioLoading}
                      className="rounded-md border border-brand-navy px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50 disabled:text-slate-400"
                    >
                      Reiniciar clave
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsuarios.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={6}>No hay usuarios registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
