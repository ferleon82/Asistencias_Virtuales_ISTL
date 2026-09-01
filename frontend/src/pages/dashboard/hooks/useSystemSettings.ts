import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';
import type { SystemSettings } from '../types';

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

const defaultSettings: SystemSettings = {
  attendance_photo_required: false,
  attendance_entry_before_minutes: 15,
  attendance_entry_after_minutes: 15,
  attendance_exit_before_minutes: 10,
  attendance_exit_after_minutes: 15,
};

export function useSystemSettings(userRole?: string) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSystemSettings = useCallback(async () => {
    if (!userRole) return;

    setError('');

    try {
      const { data } = await api.get('/admin/system-settings');
      setSettings({
        attendance_photo_required:
          data.data?.attendance_photo_required ?? defaultSettings.attendance_photo_required,
        attendance_entry_before_minutes: data.data?.attendance_entry_before_minutes ?? defaultSettings.attendance_entry_before_minutes,
        attendance_entry_after_minutes: data.data?.attendance_entry_after_minutes ?? defaultSettings.attendance_entry_after_minutes,
        attendance_exit_before_minutes: data.data?.attendance_exit_before_minutes ?? defaultSettings.attendance_exit_before_minutes,
        attendance_exit_after_minutes: data.data?.attendance_exit_after_minutes ?? defaultSettings.attendance_exit_after_minutes,
      });
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo cargar la configuraciÃƒÂ³n del sistema.'));
    }
  }, [userRole]);

  useEffect(() => {
    void loadSystemSettings();
  }, [loadSystemSettings]);

  const updateSystemSettings = async (nextSettings: SystemSettings) => {
    if (userRole !== 'tics') return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.put('/admin/system-settings', nextSettings);
      setSettings({
        attendance_photo_required:
          data.data?.attendance_photo_required ?? nextSettings.attendance_photo_required,
        attendance_entry_before_minutes: data.data?.attendance_entry_before_minutes ?? nextSettings.attendance_entry_before_minutes,
        attendance_entry_after_minutes: data.data?.attendance_entry_after_minutes ?? nextSettings.attendance_entry_after_minutes,
        attendance_exit_before_minutes: data.data?.attendance_exit_before_minutes ?? nextSettings.attendance_exit_before_minutes,
        attendance_exit_after_minutes: data.data?.attendance_exit_after_minutes ?? nextSettings.attendance_exit_after_minutes,
      });
      setMessage(data.message ?? 'ConfiguraciÃƒÂ³n del sistema actualizada correctamente.');
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo guardar la configuraciÃƒÂ³n del sistema.'));
    } finally {
      setLoading(false);
    }
  };

  return {
    systemSettings: settings,
    systemSettingsLoading: loading,
    systemSettingsMessage: message,
    systemSettingsError: error,
    setSystemSettings: setSettings,
    updateSystemSettings,
    loadSystemSettings,
  };
}
