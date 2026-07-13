import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/axios';
import type { ModulePermission } from '../types';

const defaultPermissions: Record<string, string[]> = {
  docente: ['teacher_attendance', 'teacher_day', 'reports'],
  coordinador: ['academic', 'schedules', 'reports'],
  tics: ['analytics', 'users', 'academic', 'schedules', 'reports', 'system_status', 'module_permissions'],
  rectorado: ['analytics', 'users', 'academic', 'schedules', 'reports'],
  talento_humano: ['analytics', 'users', 'academic', 'schedules', 'reports'],
};

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function useModulePermissions(userRole?: string) {
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [allPermissions, setAllPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPermissions = useCallback(async () => {
    if (!userRole) return;

    setError('');

    try {
      const { data } = await api.get('/admin/module-permissions/current');
      setPermissions(data.data as ModulePermission[]);
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo cargar la configuracion de modulos.'));
    }
  }, [userRole]);

  const loadAllPermissions = useCallback(async () => {
    if (userRole !== 'tics') return;

    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/admin/module-permissions');
      setAllPermissions(data.data as ModulePermission[]);
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo cargar la matriz de modulos.'));
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    void loadPermissions();
    void loadAllPermissions();
  }, [loadAllPermissions, loadPermissions]);

  const hasModule = useCallback(
    (moduleKey: string) => {
      if (!userRole) return false;
      if (userRole === 'tics' && moduleKey === 'module_permissions') return true;
      if (permissions.length === 0) return defaultPermissions[userRole]?.includes(moduleKey) ?? false;
      return permissions.some((permission) => permission.module_key === moduleKey && permission.enabled);
    },
    [permissions, userRole]
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, ModulePermission[]>();
    allPermissions.forEach((permission) => {
      const current = groups.get(permission.module_key) ?? [];
      current.push(permission);
      groups.set(permission.module_key, current);
    });
    return Array.from(groups.entries()).map(([moduleKey, items]) => ({
      moduleKey,
      label: items[0]?.module_label ?? moduleKey,
      items,
    }));
  }, [allPermissions]);

  const togglePermission = (permissionId: string, enabled: boolean) => {
    setAllPermissions((current) =>
      current.map((permission) => (permission.id === permissionId ? { ...permission, enabled } : permission))
    );
  };

  const savePermissions = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.put('/admin/module-permissions', {
        permissions: allPermissions.map((permission) => ({
          module_key: permission.module_key,
          rol: permission.rol,
          enabled: permission.enabled,
        })),
      });
      setAllPermissions(data.data as ModulePermission[]);
      setMessage(data.message ?? 'Configuracion de modulos actualizada correctamente.');
      await loadPermissions();
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo guardar la configuracion de modulos.'));
    } finally {
      setLoading(false);
    }
  };

  return {
    permissions,
    allPermissions,
    groupedPermissions,
    modulePermissionsLoading: loading,
    modulePermissionsMessage: message,
    modulePermissionsError: error,
    hasModule,
    togglePermission,
    savePermissions,
    loadAllPermissions,
  };
}
