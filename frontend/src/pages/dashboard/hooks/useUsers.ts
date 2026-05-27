import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/axios';
import type { UsuarioForm, UsuarioItem } from '../types';

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

const initialUsuarioForm: UsuarioForm = {
  email: '',
  nombre: '',
  apellido: '',
  cedula: '',
  password: 'Password123',
  rol: 'docente',
  telefono: '',
  activo: true,
};

export function useUsers(canManageUsers: boolean, onUsersChanged?: () => Promise<void>) {
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [usuarioMessage, setUsuarioMessage] = useState('');
  const [usuarioError, setUsuarioError] = useState('');
  const [usuarioLoading, setUsuarioLoading] = useState(false);
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [usuarioRolFilter, setUsuarioRolFilter] = useState('todos');
  const [usuarioForm, setUsuarioForm] = useState<UsuarioForm>(() => initialUsuarioForm);

  const filteredUsuarios = useMemo(
    () => (usuarioRolFilter === 'todos' ? usuarios : usuarios.filter((item) => item.rol === usuarioRolFilter)),
    [usuarioRolFilter, usuarios]
  );

  const resetUsuarioForm = useCallback(() => {
    setUsuarioForm(initialUsuarioForm);
    setEditingUsuarioId(null);
  }, []);

  const loadUsuarios = useCallback(async () => {
    if (!canManageUsers) return;

    setUsuarioError('');

    try {
      const { data } = await api.get('/admin/usuarios');
      setUsuarios(data.data);
    } catch (error) {
      setUsuarioError(getApiMessage(error, 'No se pudo cargar la lista de usuarios.'));
    }
  }, [canManageUsers]);

  useEffect(() => {
    void loadUsuarios();
  }, [loadUsuarios]);

  useEffect(() => {
    if (!canManageUsers) return undefined;

    const refreshVisibleData = () => {
      if (document.visibilityState === 'visible') {
        void loadUsuarios();
      }
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadUsuarios();
      }
    }, 30_000);

    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
    };
  }, [canManageUsers, loadUsuarios]);

  const saveUsuario = async () => {
    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const payload = {
        ...usuarioForm,
        telefono: usuarioForm.telefono || undefined,
        password: editingUsuarioId && !usuarioForm.password ? undefined : usuarioForm.password,
      };
      const { data } = editingUsuarioId
        ? await api.put(`/admin/usuarios/${editingUsuarioId}`, payload)
        : await api.post('/admin/usuarios', payload);
      setUsuarioMessage(data.message ?? (editingUsuarioId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'));
      resetUsuarioForm();
      await loadUsuarios();
      await onUsersChanged?.();
    } catch (error) {
      setUsuarioError(getApiMessage(error, 'No se pudo guardar el usuario.'));
    } finally {
      setUsuarioLoading(false);
    }
  };

  const editUsuario = (usuario: UsuarioItem) => {
    setUsuarioMessage('');
    setUsuarioError('');
    setEditingUsuarioId(usuario.id);
    setUsuarioForm({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula,
      password: '',
      rol: usuario.rol,
      telefono: usuario.telefono ?? '',
      activo: usuario.activo,
    });
  };

  const toggleUsuarioActivo = async (usuario: UsuarioItem) => {
    const action = usuario.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`Confirme que desea ${action} este usuario.`)) return;

    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const { data } = await api.put(`/admin/usuarios/${usuario.id}`, { activo: !usuario.activo });
      setUsuarioMessage(data.message ?? (usuario.activo ? 'Usuario desactivado correctamente.' : 'Usuario activado correctamente.'));
      if (editingUsuarioId === usuario.id) resetUsuarioForm();
      await loadUsuarios();
      await onUsersChanged?.();
    } catch (error) {
      setUsuarioError(getApiMessage(error, 'No se pudo cambiar el estado del usuario.'));
    } finally {
      setUsuarioLoading(false);
    }
  };

  const resetUsuarioPassword = async (usuario: UsuarioItem) => {
    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const { data } = await api.put(`/admin/usuarios/${usuario.id}`, { password: 'Password123' });
      setUsuarioMessage(data.message ?? 'Contrasena reiniciada correctamente.');
      await loadUsuarios();
      await onUsersChanged?.();
    } catch (error) {
      setUsuarioError(getApiMessage(error, 'No se pudo reiniciar la contrasena.'));
    } finally {
      setUsuarioLoading(false);
    }
  };

  return {
    usuarios,
    filteredUsuarios,
    usuarioMessage,
    usuarioError,
    usuarioLoading,
    editingUsuarioId,
    usuarioRolFilter,
    setUsuarioRolFilter,
    usuarioForm,
    setUsuarioForm,
    loadUsuarios,
    saveUsuario,
    resetUsuarioForm,
    editUsuario,
    toggleUsuarioActivo,
    resetUsuarioPassword,
  };
}
